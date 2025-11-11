/**
 * Title: Jobs Handler
 * Description: Dispatch jobs to agents and collect reports
 */

const mongoose = require('mongoose');
const { pushJob } = require('../../lib/agentStreams');
const { pushJobLog } = require('../../lib/jobLogStreams');
const deploymentJobSchema = require('../../schemas/deploymentJobSchema');

const DeploymentJob = new mongoose.model('DeploymentJob', deploymentJobSchema);

const handler = {};

handler.jobsHandler = (req, callback) => {
    const accepted = ['post', 'options'];
    if (accepted.includes(req?.method)) {
        if (req.method === 'options') return callback(204, {});
        return handler._impl[req.method](req, callback);
    }
    callback(405, { error: 'Method Not Allowed' });
};

handler._impl = {};

// POST: dispatch or report or log
// dispatch Body: { agentId, type, projectId, payload }
// report   Body: { action: 'report', jobId, status?, log?, stage?, finishedAt? }
// log      Body: { action: 'log', jobId, type?, message }
handler._impl.post = async (req, callback) => {
    try {
        const action = typeof req?.body?.action === 'string' ? req.body.action : 'dispatch';
        if (action === 'dispatch') {
            const agentId = typeof req?.body?.agentId === 'string' ? req.body.agentId : null;
            const type = typeof req?.body?.type === 'string' ? req.body.type : null;
            const projectId = typeof req?.body?.projectId === 'string' ? req.body.projectId : null;
            const payload = req?.body?.payload || {};
            if (!agentId || !type) return callback(400, { error: 'agentId and type required' });

            const jobId = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const doc = new DeploymentJob({ jobId, agentId, projectId, type, payload, status: 'DISPATCHED', startedAt: new Date() });
            await doc.save();

            // Push to agent SSE
            const pushed = pushJob(agentId, { jobId, type, projectId, payload });
            callback(200, { data: { jobId, pushed } });
        } else if (action === 'report') {
            const jobId = typeof req?.body?.jobId === 'string' ? req.body.jobId : null;
            if (!jobId) return callback(400, { error: 'jobId required' });
            const status = typeof req?.body?.status === 'string' ? req.body.status : undefined;
            const finishedAt = req?.body?.finishedAt ? new Date(req.body.finishedAt) : undefined;
            const update = {};
            if (status) update.status = status;
            if (finishedAt) update.finishedAt = finishedAt;
            await DeploymentJob.updateOne({ jobId }, { $set: update });
            callback(200, { data: 'ok' });
        } else if (action === 'log') {
            const jobId = typeof req?.body?.jobId === 'string' ? req.body.jobId : null;
            if (!jobId) return callback(400, { error: 'jobId required' });
            const type = typeof req?.body?.type === 'string' ? req.body.type : 'info';
            const message = typeof req?.body?.message === 'string' ? req.body.message : '';
            // For MVP, just log to server console; can be extended to DB or UI SSE later
            if (message) {
                try { console.log(`[job ${jobId}] [${type}] ${message}`); } catch (_) { }
            }
            // Push to any SSE subscribers for live UI logs
            pushJobLog(jobId, { type, message, ts: Date.now() });
            callback(200, { data: 'ok' });
        } else {
            callback(400, { error: 'Unknown action' });
        }
    } catch (e) {
        callback(500, { error: 'Failed to process job request' });
    }
};

module.exports = handler;
