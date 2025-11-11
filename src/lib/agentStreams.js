// In-memory agent streams registry for SSE connections and job push

const agents = new Map(); // agentId -> { res, lastPing }

function registerAgentStream(agentId, res) {
    agents.set(agentId, { res, lastPing: Date.now() });
    res.on('close', () => {
        agents.delete(agentId);
    });
}

function sendEvent(res, event, data) {
    try {
        res.write(`event: ${event}\n`);
        res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (_) { }
}

function pushJob(agentId, job) {
    const entry = agents.get(agentId);
    if (!entry) return false;
    sendEvent(entry.res, 'job', job);
    return true;
}

function pingAgent(agentId) {
    const entry = agents.get(agentId);
    if (!entry) return false;
    sendEvent(entry.res, 'ping', { t: Date.now() });
    entry.lastPing = Date.now();
    return true;
}

function hasAgent(agentId) {
    return agents.has(agentId);
}

module.exports = { registerAgentStream, pushJob, pingAgent, hasAgent };
