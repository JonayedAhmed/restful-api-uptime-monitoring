/**
 * Title: Agent Code Handler
 * Description: Serves the Node.js agent runtime (no external dependencies)
 */

const handler = {};

handler.agentCodeHandler = (req, callback) => {
  if (req.method === 'options') return callback(204, {});
  if (req.method !== 'get') return callback(405, { error: 'Method Not Allowed' });

  const code = `#!/usr/bin/env node
// Minimal SSE + heartbeat agent runtime (no external deps)
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const https = require('https');
const { spawn } = require('child_process');

function readConfig() {
  const homeDir = os.homedir();
  const installDir = path.join(homeDir, '.uptime-agent');
  const cfgPath = path.join(installDir, 'config.json');
  const raw = fs.readFileSync(cfgPath, 'utf8');
  return JSON.parse(raw);
}

function parseUrl(u) {
  try { return new URL(u); } catch (_) { return null; }
}

function request(method, urlStr, data, headers={}) {
  return new Promise((resolve, reject) => {
    const url = parseUrl(urlStr);
    if (!url) return reject(new Error('Invalid URL: ' + urlStr));
    const lib = url.protocol === 'https:' ? https : http;
    const options = {
      method,
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + (url.search || ''),
      headers: Object.assign({ 'Content-Type': 'application/json' }, headers),
    };
    const req = lib.request(options, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
    });
    req.on('error', reject);
    if (data) req.write(typeof data === 'string' ? data : JSON.stringify(data));
    req.end();
  });
}

async function handshake(cfg) {
  try {
    const res = await request('POST', cfg.serverUrl + '/deploymentAgents', { action: 'handshake', agentId: cfg.agentId, token: cfg.token, hostname: os.hostname(), platform: process.platform, arch: process.arch, node: process.version });
    if (res.status >= 200 && res.status < 300) {
      console.log('[agent] handshake ok');
      return JSON.parse(res.body).data;
    }
    console.error('[agent] handshake failed', res.status, res.body);
  } catch (e) { console.error('[agent] handshake error', e.message); }
  return null;
}

function startHeartbeat(cfg, intervalMs) {
  const tick = async () => {
    try {
      await request('POST', cfg.serverUrl + '/deploymentAgents', { action: 'heartbeat', agentId: cfg.agentId, token: cfg.token });
      // console.log('[agent] heartbeat');
    } catch (e) {
      console.error('[agent] heartbeat error', e.message);
    }
  };
  tick();
  return setInterval(tick, intervalMs || 10000);
}

function connectSSE(cfg) {
  const sseUrl = cfg.serverUrl + '/agentStream?id=' + encodeURIComponent(cfg.agentId);
  const url = parseUrl(sseUrl);
  const lib = url.protocol === 'https:' ? https : http;

  const options = {
    method: 'GET',
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname + (url.search || ''),
    headers: {
      'Accept': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Authorization': 'Bearer ' + cfg.token,
    },
  };

  const req = lib.request(options, (res) => {
    if (res.statusCode !== 200) {
      console.error('[agent] SSE failed with status', res.statusCode);
      setTimeout(() => connectSSE(cfg), 5000);
      return;
    }
    console.log('[agent] SSE connected');
    res.setEncoding('utf8');
    let buf = '';
    let event = 'message';
    res.on('data', (chunk) => {
      buf += chunk;
      let pos = 0, index = 0;
  while ((index = buf.indexOf('\\n', pos)) > -1) {
        const line = buf.slice(pos, index).trim();
        pos = index + 1;
        if (line.startsWith('event:')) {
          event = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          try {
            const data = JSON.parse(line.slice(5).trim());
            handleEvent(event, data, cfg);
          } catch (_) {}
        } else if (line === '') {
          event = 'message';
        }
      }
      buf = buf.slice(pos);
    });
    res.on('end', () => {
      console.log('[agent] SSE disconnected, retrying...');
      setTimeout(() => connectSSE(cfg), 3000);
    });
  });
  req.on('error', (e) => {
    console.error('[agent] SSE error', e.message);
    setTimeout(() => connectSSE(cfg), 5000);
  });
  req.end();
}

async function handleEvent(event, data, cfg) {
  if (event === 'job' && data && data.jobId) {
    console.log('[agent] received job', data.jobId, data.type);
    // mark running
    try { await request('POST', cfg.serverUrl + '/jobs', { action: 'report', jobId: data.jobId, status: 'RUNNING' }); } catch (_) {}

    if (data.type === 'deploy') {
      await handleDeployJob(data, cfg);
      return;
    }

    if (data.type === 'start' || data.type === 'stop' || data.type === 'restart') {
      await handleServiceControlJob(data, cfg);
      return;
    }

    // default: simulate quick success for unknown types
    try {
      await new Promise((r) => setTimeout(r, 200));
      await request('POST', cfg.serverUrl + '/jobs', { action: 'report', jobId: data.jobId, status: 'SUCCESS', finishedAt: new Date().toISOString() });
    } catch (e) {
      console.error('[agent] job report error', e.message);
      try { await request('POST', cfg.serverUrl + '/jobs', { action: 'report', jobId: data.jobId, status: 'FAILED', finishedAt: new Date().toISOString() }); } catch (_) {}
    }
  }
}

async function postJobLog(cfg, jobId, type, message) {
  try {
    await request('POST', cfg.serverUrl + '/jobs', { action: 'log', jobId, type, message: String(message) });
  } catch (_) {}
}

function runCommand(cmd, args, cwd, jobId, cfg) {
  return new Promise((resolve, reject) => {
    try {
      const child = spawn(cmd, Array.isArray(args) ? args : [], { cwd: cwd || process.cwd(), shell: true });
      child.stdout && child.stdout.on('data', (d) => postJobLog(cfg, jobId, 'stdout', d.toString('utf8')));
      child.stderr && child.stderr.on('data', (d) => postJobLog(cfg, jobId, 'stderr', d.toString('utf8')));
      child.on('close', (code) => {
        if (code === 0) return resolve();
        reject(new Error(cmd + ' exited with code ' + code));
      });
      child.on('error', (err) => reject(err));
    } catch (e) {
      reject(e);
    }
  });
}

async function ensureDir(dir) {
  try { await fs.promises.mkdir(dir, { recursive: true }); } catch (_) {}
}

async function copyPath(src, dest) {
  try {
    const st = await fs.promises.stat(src);
    if (st.isDirectory()) {
      await ensureDir(dest);
      const entries = await fs.promises.readdir(src);
      for (const e of entries) {
        await copyPath(path.join(src, e), path.join(dest, e));
      }
    } else if (st.isFile()) {
      await ensureDir(path.dirname(dest));
      await fs.promises.copyFile(src, dest);
    }
  } catch (_) {}
}

async function handleServiceControlJob(data, cfg) {
  const jobId = data.jobId;
  const type = data.type; // 'start', 'stop', 'restart'
  const payload = data.payload || {};
  const command = payload[type + 'Command'] || '';

  if (!command) {
    await postJobLog(cfg, jobId, 'warn', type + ' command not configured, skipping');
    try { await request('POST', cfg.serverUrl + '/jobs', { action: 'report', jobId, status: 'SUCCESS', finishedAt: new Date().toISOString() }); } catch (_) {}
    return;
  }

  try {
    await postJobLog(cfg, jobId, 'info', 'Executing ' + type + ': ' + command);
    await runCommand(command, [], payload.workDir || process.cwd(), jobId, cfg);
    await postJobLog(cfg, jobId, 'stdout', 'Service ' + type + ' completed successfully');
    await request('POST', cfg.serverUrl + '/jobs', { action: 'report', jobId, status: 'SUCCESS', finishedAt: new Date().toISOString() });
  } catch (e) {
    await postJobLog(cfg, jobId, 'stderr', 'Service ' + type + ' failed: ' + e.message);
    try { await request('POST', cfg.serverUrl + '/jobs', { action: 'report', jobId, status: 'FAILED', finishedAt: new Date().toISOString() }); } catch (_) {}
  }
}

async function handleDeployJob(data, cfg) {
  const jobId = data.jobId;
  const payload = data.payload || {};
  const project = String(payload.project || 'project');
  const version = String(payload.version || Date.now());
  const repoPath = payload.repoPath || process.cwd();
  const commands = Array.isArray(payload.commands) ? payload.commands : [];
  const artifacts = Array.isArray(payload.artifacts) ? payload.artifacts : [];

  // Determine deploy base directory with overrides and fallbacks
  const defaultDir = '/var/www/deployments';
  const userFallback = path.join(os.homedir(), '.uptime-agent', 'deployments');
  const deployBase = process.env.DEPLOY_DIR || cfg.deployDir || defaultDir;

  let finalDeployBase = deployBase;
  try {
    // Ensure base exists or is writable, else fallback
    try { await fs.promises.mkdir(deployBase, { recursive: true }); } catch (_) {}
    fs.accessSync(deployBase, fs.constants.W_OK);
  } catch (_) {
    finalDeployBase = userFallback;
    try { await fs.promises.mkdir(finalDeployBase, { recursive: true }); } catch (e) {}
  }

  const targetDir = path.join(finalDeployBase, project, version);

  try {
    await ensureDir(targetDir);
  } catch (e) {
    await postJobLog(cfg, jobId, 'stderr', 'Failed to create target dir ' + targetDir + ': ' + e.message);
    try { await request('POST', cfg.serverUrl + '/jobs', { action: 'report', jobId, status: 'FAILED', finishedAt: new Date().toISOString() }); } catch (_) {}
    return;
  }

  await postJobLog(cfg, jobId, 'info', 'Deploying to ' + targetDir + ' (base: ' + finalDeployBase + ')');

  try {
    if (commands.length === 0) {
      await postJobLog(cfg, jobId, 'warn', 'No commands provided. Skipping command execution.');
    } else {
      for (const c of commands) {
        if (typeof c === 'string') {
          await postJobLog(cfg, jobId, 'info', 'Running: ' + c);
          await runCommand(c, [], repoPath, jobId, cfg);
        } else if (c && typeof c === 'object' && c.cmd) {
          const args = Array.isArray(c.args) ? c.args : [];
          await postJobLog(cfg, jobId, 'info', 'Running: ' + c.cmd + ' ' + args.join(' '));
          await runCommand(c.cmd, args, repoPath, jobId, cfg);
        }
      }
    }

    // Copy artifacts if specified (with per-artifact error handling)
    const failedArtifacts = [];
    for (const art of artifacts) {
      let src, dest;
      if (typeof art === 'string') {
        src = path.isAbsolute(art) ? art : path.join(repoPath, art);
        dest = path.join(targetDir, path.basename(src));
      } else if (art && typeof art === 'object') {
        const srcIn = art.src || art.from || '';
        const destIn = art.dest || art.to || '';
        src = path.isAbsolute(srcIn) ? srcIn : path.join(repoPath, srcIn);
        dest = destIn ? (path.isAbsolute(destIn) ? destIn : path.join(targetDir, destIn)) : path.join(targetDir, path.basename(src));
      }
      if (!src || !dest) continue;
      await postJobLog(cfg, jobId, 'info', 'Copying artifact ' + src + ' -> ' + dest);
      try {
        await copyPath(src, dest);
        await postJobLog(cfg, jobId, 'stdout', 'Copied ' + src + ' -> ' + dest);
      } catch (e) {
        failedArtifacts.push(src);
        await postJobLog(cfg, jobId, 'stderr', 'Failed to copy ' + src + ': ' + e.message);
      }
    }
    if (failedArtifacts.length > 0) {
      await postJobLog(cfg, jobId, 'stderr', 'Some artifacts failed: ' + failedArtifacts.join(', '));
      await request('POST', cfg.serverUrl + '/jobs', { action: 'report', jobId, status: 'FAILED', finishedAt: new Date().toISOString() });
      return;
    }

    // Auto-start service if configured
    if (payload.autoStart && payload.startCommand) {
      await postJobLog(cfg, jobId, 'info', 'Auto-starting service: ' + payload.startCommand);
      try {
        await runCommand(payload.startCommand, [], targetDir, jobId, cfg);
        await postJobLog(cfg, jobId, 'stdout', 'Service started successfully');
      } catch (e) {
        await postJobLog(cfg, jobId, 'warn', 'Service start failed: ' + e.message);
      }
    }

    await request('POST', cfg.serverUrl + '/jobs', { action: 'report', jobId, status: 'SUCCESS', finishedAt: new Date().toISOString() });
  } catch (e) {
    await postJobLog(cfg, jobId, 'stderr', 'Deploy failed: ' + e.message);
    try { await request('POST', cfg.serverUrl + '/jobs', { action: 'report', jobId, status: 'FAILED', finishedAt: new Date().toISOString() }); } catch (_) {}
  }
}

(async () => {
  try {
    const cfg = readConfig();
    const hs = await handshake(cfg);
    const hb = startHeartbeat(cfg, (hs && hs.heartbeatIntervalMs) || 10000);
    connectSSE(cfg);
    process.on('SIGINT', () => { clearInterval(hb); process.exit(0); });
    process.on('SIGTERM', () => { clearInterval(hb); process.exit(0); });
  } catch (e) {
    console.error('[agent] fatal error', e.message);
    process.exit(1);
  }
})();
`;

  return callback(200, { __raw: true, contentType: 'text/javascript; charset=utf-8', body: code });
};

module.exports = handler;
