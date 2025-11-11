/**
 * Title: Deployment Logs Handler
 * Description: List logs for a run (polling-based)
 */

const mongoose = require('mongoose');
const deploymentLogSchema = require('../../schemas/deploymentLogSchema');

const DeploymentLog = new mongoose.model('DeploymentLog', deploymentLogSchema);

const handler = {};

handler.deploymentLogsHandler = async (req, callback) => {
    if (req.method === 'options') return callback(204, {});
    if (req.method !== 'get') return callback(405, { error: 'Method Not Allowed' });
    try {
        const runId = typeof req?.queryStringObject?.runId === 'string' ? req.queryStringObject.runId : null;
        if (!runId) return callback(400, { error: 'runId required' });
        const since = req?.queryStringObject?.since ? new Date(Number(req.queryStringObject.since)) : null;
        const filter = { deploymentRunId: runId };
        if (since) filter.timestamp = { $gt: since };
        const logs = await DeploymentLog.find(filter).sort({ timestamp: 1 }).limit(2000);
        callback(200, { data: logs });
    } catch (e) {
        callback(500, { error: 'Failed to get logs' });
    }
};

module.exports = handler;
