/**
 * Title: Deployment Agents Handler
 * Description: CRUD-lite for registering/listing deployment agents
 */

const mongoose = require('mongoose');
const utilities = require('../../helpers/utilities');
const tokenHandler = require('./tokenHandler');
const deploymentAgentSchema = require('../../schemas/deploymentAgentSchema');

const DeploymentAgent = new mongoose.model('DeploymentAgent', deploymentAgentSchema);

const handler = {};

handler.deploymentAgentsHandler = (requestProperties, callback) => {
    const accepted = ['get', 'post', 'options'];
    if (accepted.includes(requestProperties?.method)) {
        if (requestProperties.method === 'options') return callback(204, {});
        return handler._impl[requestProperties.method](requestProperties, callback);
    }
    callback(405, { error: 'Method Not Allowed' });
};

handler._impl = {};

// GET: list agents, validate status, or download script
handler._impl.get = async (req, callback) => {
    try {
        const action = typeof req?.queryStringObject?.action === 'string' ? req.queryStringObject.action : null;
        // Manual config for agent (for manual installs)
        if (action === 'config') {
            const id = typeof req?.queryStringObject?.id === 'string' ? req.queryStringObject.id : (typeof req?.queryStringObject?.agentId === 'string' ? req.queryStringObject.agentId : null);
            if (!id) return callback(400, { error: 'agentId (id) required' });
            const agent = await DeploymentAgent.findById(id);
            if (!agent) return callback(404, { error: 'Agent not found' });

            const publicUrl = process.env.BACKEND_PUBLIC_URL;
            let serverUrl;
            if (publicUrl && /^https?:\/\//i.test(publicUrl)) {
                serverUrl = publicUrl.replace(/\/$/, '');
            } else {
                const hostHdr = req?.headersObject?.host || 'localhost:5050';
                const hostNameOnly = hostHdr.split(':')[0] || 'localhost';
                serverUrl = `http://${hostNameOnly}:5050`;
            }
            return callback(200, { serverUrl, agentId: agent._id.toString(), token: agent.token });
        }
        // Download pre-configured setup script
        if (action === 'download') {
            const id = typeof req?.queryStringObject?.id === 'string' ? req.queryStringObject.id : (typeof req?.queryStringObject?.agentId === 'string' ? req.queryStringObject.agentId : null);
            const os = typeof req?.queryStringObject?.os === 'string' ? req.queryStringObject.os : 'linux';
            if (!id) return callback(400, { error: 'id required' });
            const agent = await DeploymentAgent.findById(id);
            if (!agent) return callback(404, { error: 'Agent not found' });

            // Build server URL: prefer BACKEND_PUBLIC_URL, else infer host and force :5050 (http)
            const publicUrl = process.env.BACKEND_PUBLIC_URL;
            let serverUrl;
            if (publicUrl && /^https?:\/\//i.test(publicUrl)) {
                serverUrl = publicUrl.replace(/\/$/, '');
            } else {
                const hostHdr = req?.headersObject?.host || 'localhost:5050';
                const hostNameOnly = hostHdr.split(':')[0] || 'localhost';
                serverUrl = `http://${hostNameOnly}:5050`;
            }

            // Enhanced installer script for Linux/macOS: installs Node-based agent runtime
            if (os && os.toLowerCase().includes('win')) {
                // Minimal PowerShell installer for Windows (best-effort)
                const ps = `# PowerShell Agent Installer\n$ErrorActionPreference = 'Stop'\n$AGENT_ID='${agent._id.toString()}'\n$AGENT_TOKEN='${agent.token}'\n$SERVER_URL='${serverUrl}'\n$INSTALL_DIR=Join-Path $env:USERPROFILE '.uptime-agent'\nNew-Item -ItemType Directory -Force -Path $INSTALL_DIR | Out-Null\n$config = @{ agentId=$AGENT_ID; token=$AGENT_TOKEN; serverUrl=$SERVER_URL } | ConvertTo-Json\nSet-Content -LiteralPath (Join-Path $INSTALL_DIR 'config.json') -Value $config -Encoding UTF8\nInvoke-WebRequest -UseBasicParsing "$SERVER_URL/agentCode" -OutFile (Join-Path $INSTALL_DIR 'agent.js')\n# Stop previous if pidfile exists\n$pidPath = Join-Path $INSTALL_DIR 'agent.pid'\nif (Test-Path $pidPath) { try { $old = Get-Content $pidPath; if ($old) { Stop-Process -Id $old -ErrorAction SilentlyContinue } } catch {} }\n$node = 'node'\n$psi = New-Object System.Diagnostics.ProcessStartInfo\n$psi.FileName = $node\n$psi.Arguments = (Join-Path $INSTALL_DIR 'agent.js')\n$psi.RedirectStandardOutput = $true\n$psi.RedirectStandardError = $true\n$psi.UseShellExecute = $false\n$psi.CreateNoWindow = $true\n$p = [System.Diagnostics.Process]::Start($psi)\n$p.Id | Out-File -FilePath $pidPath -Encoding ascii -Force\nWrite-Output "Agent installed at $INSTALL_DIR and started (PID: $($p.Id))."`;
                return callback(200, { __raw: true, contentType: 'text/plain; charset=utf-8', body: ps });
            }

            // Build JSON config once to embed into installer (idempotent)
            const configJson = JSON.stringify({ agentId: agent._id.toString(), token: agent.token, serverUrl, deployDir: '/var/www/deployments' }, null, 2);

            const script = `#!/usr/bin/env bash\nset -e\n\nAGENT_ID="${agent._id.toString()}"\nAGENT_TOKEN="${agent.token}"\nSERVER_URL="${serverUrl}"\nINSTALL_DIR="$HOME/.uptime-agent"\n\nmkdir -p "$INSTALL_DIR"\n# Write config.json\ncat > "$INSTALL_DIR/config.json" <<'EOF'\n${configJson}\nEOF\n\n# Download agent runtime\nif command -v curl >/dev/null 2>&1; then\n  curl -fsSL "$SERVER_URL/agentCode" -o "$INSTALL_DIR/agent.js"\nelif command -v wget >/dev/null 2>&1; then\n  wget -qO "$INSTALL_DIR/agent.js" "$SERVER_URL/agentCode"\nelse\n  echo "Error: curl or wget required"\n  exit 1\nfi\nchmod +x "$INSTALL_DIR/agent.js" || true\n\n# Stop previous agent if running (idempotent)\nif [ -f "$INSTALL_DIR/agent.pid" ]; then\n  OLD_PID=$(cat "$INSTALL_DIR/agent.pid" 2>/dev/null || true)\n  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" 2>/dev/null; then\n    kill "$OLD_PID" 2>/dev/null || true\n    sleep 1\n  fi\nfi\n\n# Start agent background process\nnohup node "$INSTALL_DIR/agent.js" >> "$INSTALL_DIR/agent.log" 2>&1 & echo $! > "$INSTALL_DIR/agent.pid" || true\n\necho "Agent installed and started (PID $(cat "$INSTALL_DIR/agent.pid" 2>/dev/null))."\necho "Directory: $INSTALL_DIR"\n`;

            return callback(200, { __raw: true, contentType: 'text/plain; charset=utf-8', body: script });
        }
        if (action === 'validate') {
            const id = typeof req?.queryStringObject?.id === 'string' ? req.queryStringObject.id : null;
            if (!id) return callback(400, { error: 'id required' });
            const agent = await DeploymentAgent.findById(id);
            if (!agent) return callback(404, { error: 'Agent not found' });
            const last = agent.lastSeenAt ? new Date(agent.lastSeenAt).getTime() : 0;
            const isOnline = last && (Date.now() - last) < 60_000; // 1 minute threshold
            const status = isOnline ? 'online' : 'offline';
            return callback(200, { data: { status, lastCheckIn: agent.lastSeenAt || null } });
        }
        const list = await DeploymentAgent.find({}).sort({ createdAt: -1 });
        callback(200, { data: list });
    } catch (e) {
        callback(500, { error: 'Failed to process agents request' });
    }
};

// POST: register agent (OFFLINE by default) or record heartbeat/handshake
// Register Body: { name, hostType, description?, userId }
// Heartbeat Body: { action: 'heartbeat', agentId, token? }
// Handshake Body: { action: 'handshake', agentId, token }
handler._impl.post = async (req, callback) => {
    try {
        const { body, headersObject } = req;
        const action = typeof body?.action === 'string' ? body.action : null;

        // Heartbeat path (agent side)
        if (action === 'heartbeat') {
            const agentId = typeof body?.agentId === 'string' ? body.agentId : null;
            const token = typeof body?.token === 'string' ? body.token : null;
            if (!agentId) return callback(400, { error: 'agentId required' });
            const agent = await DeploymentAgent.findById(agentId);
            if (!agent) return callback(404, { error: 'Agent not found' });
            // If token provided, simple check against stored token (basic auth)
            if (token && agent.token && token !== agent.token) return callback(403, { error: 'Invalid token' });
            agent.lastSeenAt = new Date();
            agent.status = 'ONLINE';
            await agent.save();
            return callback(200, { data: { ok: true, lastSeenAt: agent.lastSeenAt } });
        }

        // Handshake path (agent startup)
        if (action === 'handshake') {
            const agentId = typeof body?.agentId === 'string' ? body.agentId : null;
            const token = typeof body?.token === 'string' ? body.token : null;
            if (!agentId || !token) return callback(400, { error: 'agentId and token required' });
            const agent = await DeploymentAgent.findById(agentId);
            if (!agent) return callback(404, { error: 'Agent not found' });
            if (token !== agent.token) return callback(403, { error: 'Invalid token' });
            agent.lastSeenAt = new Date();
            agent.status = 'ONLINE';
            await agent.save();

            // Build server URL from request headers (fallback to http)
            const host = req?.headersObject?.host || 'localhost:5050';
            const proto = (req?.headersObject?.['x-forwarded-proto'] || 'http');
            const serverUrl = `${proto}://${host}`;
            const sseUrl = `${serverUrl}/agentStream?id=${agentId}`;
            return callback(200, { data: { ok: true, serverUrl, sseUrl, heartbeatIntervalMs: 10000 } });
        }

        // Registration path (control-plane UI)
        const token = typeof headersObject?.token === 'string' ? headersObject.token : false;
        const userId = typeof body?.userId === 'string' ? body.userId : false;
        if (!token || !userId) return callback(403, { error: 'Auth required' });

        tokenHandler._token.verify(token, userId, async (ok) => {
            if (!ok) return callback(403, { error: 'Authentication failed.' });

            const name = typeof body?.name === 'string' && body.name.trim() ? body.name.trim() : null;
            const hostType = ['Linux', 'macOS', 'Windows'].includes(body?.hostType) ? body.hostType : null;
            const description = typeof body?.description === 'string' ? body.description : '';
            if (!name || !hostType) return callback(400, { error: 'name and hostType are required' });

            const tokenStr = utilities.createRandomString(40) || Math.random().toString(36).slice(2) + Date.now();
            const doc = new DeploymentAgent({
                name,
                hostType,
                token: tokenStr,
                status: 'OFFLINE',
                description,
                createdBy: userId,
            });
            await doc.save();
            callback(201, { data: doc });
        });
    } catch (e) {
        callback(500, { error: 'Failed to register agent' });
    }
};

module.exports = handler;
