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

    try {
      if (data.type === 'deploy') {
        await handleDeployJob(data, cfg);
        return;
      }

      if (data.type === 'start' || data.type === 'stop' || data.type === 'restart') {
        await handleServiceControlJob(data, cfg);
        return;
      }

      // default: simulate quick success for unknown types
      await new Promise((r) => setTimeout(r, 200));
      await request('POST', cfg.serverUrl + '/jobs', { action: 'report', jobId: data.jobId, status: 'SUCCESS', finishedAt: new Date().toISOString() });
    } catch (e) {
      console.error('[agent] job execution error:', e.message);
      console.error('[agent] stack:', e.stack);
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

// ============================================================================
// Docker Utility Functions
// ============================================================================

async function checkDockerInstalled() {
  try {
    await new Promise((resolve, reject) => {
      const child = spawn('docker', ['--version'], { shell: true });
      child.on('close', (code) => (code === 0 ? resolve() : reject(new Error('docker not found'))));
      child.on('error', reject);
    });
    return true;
  } catch (_) {
    return false;
  }
}

async function dockerBuild(imageName, dockerfilePath, buildContext, buildArgs, jobId, cfg) {
  const args = ['build', '-t', imageName];
  
  if (dockerfilePath) {
    args.push('-f', dockerfilePath);
  }
  
  if (Array.isArray(buildArgs)) {
    for (const arg of buildArgs) {
      if (arg && typeof arg === 'object' && arg.key && arg.value) {
        args.push('--build-arg', \`\${arg.key}=\${arg.value}\`);
      }
    }
  }
  
  args.push(buildContext || '.');
  
  await postJobLog(cfg, jobId, 'info', 'Building Docker image: docker ' + args.join(' '));
  return runCommand('docker', args, buildContext, jobId, cfg);
}

async function dockerRun(containerName, imageName, options, jobId, cfg) {
  const args = ['run', '-d', '--name', containerName];
  
  // Port mapping
  if (options.port && options.containerPort) {
    args.push('-p', \`\${options.port}:\${options.containerPort}\`);
  }
  
  // Volume mounts
  if (Array.isArray(options.volumes)) {
    for (const vol of options.volumes) {
      if (typeof vol === 'string') {
        args.push('-v', vol);
      } else if (vol && typeof vol === 'object' && vol.host && vol.container) {
        args.push('-v', \`\${vol.host}:\${vol.container}\`);
      }
    }
  }
  
  // Environment variables
  if (Array.isArray(options.envVars)) {
    for (const env of options.envVars) {
      if (typeof env === 'string') {
        args.push('-e', env);
      } else if (env && typeof env === 'object' && env.key && env.value) {
        args.push('-e', \`\${env.key}=\${env.value}\`);
      }
    }
  }
  
  // Network mode
  if (options.network) {
    args.push('--network', options.network);
  }
  
  // Restart policy
  args.push('--restart', options.restart || 'unless-stopped');
  
  args.push(imageName);
  
  // Command override
  if (options.command) {
    if (typeof options.command === 'string') {
      args.push(...options.command.split(' '));
    } else if (Array.isArray(options.command)) {
      args.push(...options.command);
    }
  }
  
  await postJobLog(cfg, jobId, 'info', 'Starting Docker container: docker ' + args.join(' '));
  return runCommand('docker', args, process.cwd(), jobId, cfg);
}

async function dockerStop(containerName, jobId, cfg) {
  await postJobLog(cfg, jobId, 'info', 'Stopping Docker container: ' + containerName);
  try {
    await runCommand('docker', ['stop', containerName], process.cwd(), jobId, cfg);
    return true;
  } catch (e) {
    await postJobLog(cfg, jobId, 'warn', 'Stop failed: ' + e.message);
    return false;
  }
}

async function dockerRemove(containerName, jobId, cfg) {
  await postJobLog(cfg, jobId, 'info', 'Removing Docker container: ' + containerName);
  try {
    await runCommand('docker', ['rm', '-f', containerName], process.cwd(), jobId, cfg);
    return true;
  } catch (e) {
    await postJobLog(cfg, jobId, 'warn', 'Remove failed: ' + e.message);
    return false;
  }
}

async function dockerIsRunning(containerName) {
  try {
    const result = await new Promise((resolve, reject) => {
      const child = spawn('docker', ['ps', '--filter', \`name=^\${containerName}$\`, '--format', '{{.Names}}'], { shell: true });
      let output = '';
      child.stdout && child.stdout.on('data', (d) => (output += d.toString('utf8')));
      child.on('close', (code) => (code === 0 ? resolve(output.trim()) : reject()));
      child.on('error', reject);
    });
    return result === containerName;
  } catch (_) {
    return false;
  }
}

async function generateDockerfile(repoPath, language, framework, jobId, cfg) {
  await postJobLog(cfg, jobId, 'info', 'Auto-generating Dockerfile for ' + (language || 'detected language') + (framework ? ' (' + framework + ')' : ''));
  
  let template = '';
  
  // Detect language if not provided
  if (!language) {
    try {
      const files = await fs.promises.readdir(repoPath);
      if (files.includes('package.json')) language = 'nodejs';
      else if (files.includes('requirements.txt')) language = 'python';
      else if (files.includes('go.mod')) language = 'go';
      else if (files.includes('pom.xml')) language = 'java';
    } catch (_) {}
  }
  
  // Framework-specific templates
  const frameworkKey = framework ? \`\${language}-\${framework}\` : language;
  
  switch (frameworkKey) {
    // Node.js Frameworks
    case 'nodejs-express':
      template = \`FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "index.js"]\`;
      break;
      
    case 'nodejs-nextjs':
      template = \`FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
ENV NODE_ENV=production
CMD ["npm", "start"]\`;
      break;
      
    case 'nodejs-react':
      template = \`FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]\`;
      break;
      
    case 'nodejs-angular':
      template = \`FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build -- --configuration=production

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]\`;
      break;
      
    case 'nodejs-vue':
      template = \`FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]\`;
      break;
      
    case 'nodejs-nestjs':
      template = \`FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/main"]\`;
      break;
      
    case 'nodejs-nodejs-vanilla':
      template = \`FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "index.js"]\`;
      break;
      
    // Python Frameworks
    case 'python-django':
      template = \`FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]\`;
      break;
      
    case 'python-flask':
      template = \`FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5000
ENV FLASK_APP=app.py
CMD ["flask", "run", "--host=0.0.0.0"]\`;
      break;
      
    case 'python-python-vanilla':
      template = \`FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["python", "main.py"]\`;
      break;
      
    // Java Frameworks
    case 'java-springboot':
      template = \`FROM maven:3.9-eclipse-temurin-17 AS builder
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar
EXPOSE 8080
CMD ["java", "-jar", "app.jar"]\`;
      break;
      
    case 'java-java-vanilla':
      template = \`FROM eclipse-temurin:17-jdk-alpine
WORKDIR /app
COPY . .
RUN javac *.java
EXPOSE 8080
CMD ["java", "Main"]\`;
      break;
      
    // Fallback to language-only templates
    case 'nodejs':
      template = \`FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "index.js"]\`;
      break;
      
    case 'python':
      template = \`FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["python", "app.py"]\`;
      break;
      
    case 'java':
      template = \`FROM eclipse-temurin:17-jdk-alpine
WORKDIR /app
COPY . .
RUN javac *.java
EXPOSE 8080
CMD ["java", "Main"]\`;
      break;
      
    default:
      template = \`FROM alpine:latest
WORKDIR /app
COPY . .
EXPOSE 8080
CMD ["/bin/sh"]\`;
  }
  
  const dockerfilePath = path.join(repoPath, 'Dockerfile.auto');
  await fs.promises.writeFile(dockerfilePath, template, 'utf8');
  await postJobLog(cfg, jobId, 'stdout', 'Generated Dockerfile at: ' + dockerfilePath);
  
  return dockerfilePath;
}

async function handleServiceControlJob(data, cfg) {
  const jobId = data.jobId;
  const type = data.type; // 'start', 'stop', 'restart'
  const payload = data.payload || {};
  const command = payload[type + 'Command'] || '';
  const useDocker = payload.useDocker === true;
  const containerName = payload.containerName || \`\${payload.project || 'app'}-\${payload.environment || 'default'}\`;

  // ============================================================================
  // Docker Service Control
  // ============================================================================
  if (useDocker) {
    await postJobLog(cfg, jobId, 'info', '🐳 Docker service control: ' + type);
    
    const dockerAvailable = await checkDockerInstalled();
    if (!dockerAvailable) {
      await postJobLog(cfg, jobId, 'stderr', 'Docker is not installed');
      try { await request('POST', cfg.serverUrl + '/jobs', { action: 'report', jobId, status: 'FAILED', finishedAt: new Date().toISOString() }); } catch (_) {}
      return;
    }
    
    try {
      if (type === 'stop') {
        await dockerStop(containerName, jobId, cfg);
        await postJobLog(cfg, jobId, 'stdout', '✓ Container stopped: ' + containerName);
        await request('POST', cfg.serverUrl + '/jobs', { action: 'report', jobId, status: 'SUCCESS', finishedAt: new Date().toISOString() });
      }
      else if (type === 'start') {
        const isRunning = await dockerIsRunning(containerName);
        if (isRunning) {
          await postJobLog(cfg, jobId, 'info', 'Container already running: ' + containerName);
          await request('POST', cfg.serverUrl + '/jobs', { action: 'report', jobId, status: 'SUCCESS', finishedAt: new Date().toISOString() });
        } else {
          // Start existing container
          await runCommand('docker', ['start', containerName], process.cwd(), jobId, cfg);
          await postJobLog(cfg, jobId, 'stdout', '✓ Container started: ' + containerName);
          await request('POST', cfg.serverUrl + '/jobs', { action: 'report', jobId, status: 'SUCCESS', finishedAt: new Date().toISOString() });
        }
      }
      else if (type === 'restart') {
        await runCommand('docker', ['restart', containerName], process.cwd(), jobId, cfg);
        await postJobLog(cfg, jobId, 'stdout', '✓ Container restarted: ' + containerName);
        await request('POST', cfg.serverUrl + '/jobs', { action: 'report', jobId, status: 'SUCCESS', finishedAt: new Date().toISOString() });
      }
    } catch (e) {
      await postJobLog(cfg, jobId, 'stderr', 'Docker ' + type + ' failed: ' + e.message);
      try { await request('POST', cfg.serverUrl + '/jobs', { action: 'report', jobId, status: 'FAILED', finishedAt: new Date().toISOString() }); } catch (_) {}
    }
    
    return;
  }

  // ============================================================================
  // Traditional Service Control
  // ============================================================================

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
  
  // Docker configuration
  const useDocker = payload.useDocker === true;
  const dockerImage = payload.dockerImage || \`\${project.toLowerCase().replace(/[^a-z0-9-]/g, '-')}:\${version}\`;
  const dockerfile = payload.dockerfile;
  const dockerBuildArgs = payload.dockerBuildArgs;
  const autoGenerateDockerfile = payload.autoGenerateDockerfile === true;
  
  // Container runtime options
  const port = payload.port;
  const containerPort = payload.containerPort || 3000;
  const dockerVolumes = payload.dockerVolumes;
  const dockerEnvVars = payload.dockerEnvVars;
  const dockerNetwork = payload.dockerNetwork || 'bridge';

  // ============================================================================
  // Docker Deployment Path
  // ============================================================================
  if (useDocker) {
    await postJobLog(cfg, jobId, 'info', '🐳 Docker deployment mode enabled');
    
    // Check if Docker is installed
    const dockerAvailable = await checkDockerInstalled();
    if (!dockerAvailable) {
      await postJobLog(cfg, jobId, 'stderr', 'Docker is not installed or not in PATH');
      try { await request('POST', cfg.serverUrl + '/jobs', { action: 'report', jobId, status: 'FAILED', finishedAt: new Date().toISOString() }); } catch (_) {}
      return;
    }
    
    await postJobLog(cfg, jobId, 'stdout', '✓ Docker is available');
    
    // Clone repository if repository URL provided
    if (payload.repository) {
      const branch = payload.branch || 'main';
      await postJobLog(cfg, jobId, 'info', \`Cloning repository: \${payload.repository} (branch: \${branch})\`);
      try {
        // Create parent directory if it doesn't exist
        await fs.promises.mkdir(path.dirname(repoPath), { recursive: true });
        // Remove existing directory if it exists
        try {
          await fs.promises.rm(repoPath, { recursive: true, force: true });
        } catch (_) {}
        // Clone the repository
        await runCommand('git', ['clone', '-b', branch, '--single-branch', '--depth', '1', payload.repository, repoPath], path.dirname(repoPath), jobId, cfg);
        await postJobLog(cfg, jobId, 'stdout', '✓ Repository cloned successfully');
      } catch (e) {
        await postJobLog(cfg, jobId, 'stderr', 'Failed to clone repository: ' + e.message);
        try { await request('POST', cfg.serverUrl + '/jobs', { action: 'report', jobId, status: 'FAILED', finishedAt: new Date().toISOString() }); } catch (_) {}
        return;
      }
    }
    
    // Determine Dockerfile path
    let dockerfilePath = dockerfile;
    if (autoGenerateDockerfile || (!dockerfilePath && !await fileExists(path.join(repoPath, 'Dockerfile')))) {
      await postJobLog(cfg, jobId, 'info', 'No Dockerfile found, generating one automatically');
      try {
        dockerfilePath = await generateDockerfile(repoPath, payload.language, payload.framework, jobId, cfg);
      } catch (e) {
        await postJobLog(cfg, jobId, 'stderr', 'Failed to generate Dockerfile: ' + e.message);
        try { await request('POST', cfg.serverUrl + '/jobs', { action: 'report', jobId, status: 'FAILED', finishedAt: new Date().toISOString() }); } catch (_) {}
        return;
      }
    } else if (!dockerfilePath) {
      dockerfilePath = 'Dockerfile';
    }
    
    // Run build commands if specified (for installing dependencies, building artifacts, etc.)
    if (commands.length > 0) {
      await postJobLog(cfg, jobId, 'info', 'Running pre-build commands');
      try {
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
      } catch (e) {
        await postJobLog(cfg, jobId, 'stderr', 'Pre-build command failed: ' + e.message);
        try { await request('POST', cfg.serverUrl + '/jobs', { action: 'report', jobId, status: 'FAILED', finishedAt: new Date().toISOString() }); } catch (_) {}
        return;
      }
    }
    
    // Build Docker image
    try {
      await dockerBuild(dockerImage, dockerfilePath, repoPath, dockerBuildArgs, jobId, cfg);
      await postJobLog(cfg, jobId, 'stdout', '✓ Docker image built successfully: ' + dockerImage);
    } catch (e) {
      await postJobLog(cfg, jobId, 'stderr', 'Docker build failed: ' + e.message);
      try { await request('POST', cfg.serverUrl + '/jobs', { action: 'report', jobId, status: 'FAILED', finishedAt: new Date().toISOString() }); } catch (_) {}
      return;
    }
    
    // Stop and remove old container if exists
    const containerName = \`\${project.toLowerCase().replace(/[^a-z0-9-]/g, '-')}-\${payload.environment || 'default'}\`;
    const isRunning = await dockerIsRunning(containerName);
    
    if (isRunning) {
      await postJobLog(cfg, jobId, 'info', 'Stopping existing container: ' + containerName);
      await dockerStop(containerName, jobId, cfg);
    }
    
    // Remove old container (if exists)
    await dockerRemove(containerName, jobId, cfg);
    
    // Run new container
    try {
      const dockerOptions = {
        port,
        containerPort,
        volumes: dockerVolumes,
        envVars: dockerEnvVars,
        network: dockerNetwork,
        restart: 'unless-stopped'
      };
      
      await dockerRun(containerName, dockerImage, dockerOptions, jobId, cfg);
      await postJobLog(cfg, jobId, 'stdout', '✓ Container started successfully: ' + containerName);
      
      if (port) {
        await postJobLog(cfg, jobId, 'stdout', \`🌐 Application available at: http://localhost:\${port}\`);
      }
      
      await request('POST', cfg.serverUrl + '/jobs', { action: 'report', jobId, status: 'SUCCESS', finishedAt: new Date().toISOString() });
    } catch (e) {
      await postJobLog(cfg, jobId, 'stderr', 'Container start failed: ' + e.message);
      try { await request('POST', cfg.serverUrl + '/jobs', { action: 'report', jobId, status: 'FAILED', finishedAt: new Date().toISOString() }); } catch (_) {}
    }
    
    return;
  }

  // ============================================================================
  // Traditional (Non-Docker) Deployment Path
  // ============================================================================

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

async function fileExists(filePath) {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch (_) {
    return false;
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
