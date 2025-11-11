/**
 * Title: Agent Stream Handler (SSE)
 * Description: Keeps an SSE connection open to push jobs to agents
 */

const mongoose = require('mongoose');
const tokenHandler = require('./tokenHandler');
const { registerAgentStream } = require('../../lib/agentStreams');
const deploymentAgentSchema = require('../../schemas/deploymentAgentSchema');

const DeploymentAgent = new mongoose.model('DeploymentAgent', deploymentAgentSchema);

const handler = {};

handler.agentStreamHandler = (req, callback) => {
    if (req.method === 'options') return callback(204, {});
    if (req.method !== 'get') return callback(405, { error: 'Method Not Allowed' });

    const agentId = typeof req?.queryStringObject?.id === 'string' ? req.queryStringObject.id : null;
    const token = typeof req?.headersObject?.authorization === 'string' ? req.headersObject.authorization.replace(/^Bearer\s+/i, '') : null;

    // We return an SSE takeover object; handleReqRes will call setup(res)
    callback(200, {
        __sse: true,
        setup: async (res) => {
            try {
                if (!agentId) {
                    res.write(`event: error\n`);
                    res.write(`data: ${JSON.stringify({ error: 'id required' })}\n\n`);
                    res.end();
                    return;
                }
                const agent = await DeploymentAgent.findById(agentId);
                if (!agent) {
                    res.write(`event: error\n`);
                    res.write(`data: ${JSON.stringify({ error: 'agent not found' })}\n\n`);
                    res.end();
                    return;
                }
                // Optional token check for SSE
                if (token && agent.token && token !== agent.token) {
                    res.write(`event: error\n`);
                    res.write(`data: ${JSON.stringify({ error: 'unauthorized' })}\n\n`);
                    res.end();
                    return;
                }

                registerAgentStream(agentId, res);
                // Announce ready
                res.write(`event: ready\n`);
                res.write(`data: ${JSON.stringify({ ok: true, agentId })}\n\n`);
            } catch (e) {
                try {
                    res.write(`event: error\n`);
                    res.write(`data: ${JSON.stringify({ error: 'internal error' })}\n\n`);
                } finally {
                    res.end();
                }
            }
        }
    });
};

module.exports = handler;
