/**
 * Title: Jobs Handler
 * Description: Dispatch jobs to agents and collect reports
 */

const { pushJob } = require('../../lib/agentStreams');
const { pushJobLog, completeJobStream } = require('../../lib/jobLogStreams');
const jobService = require('../../services/jobService');

const handler = {};

handler.jobsHandler = (req, callback) => {
    const accepted = ['get', 'post', 'options'];
    if (accepted.includes(req?.method)) {
        if (req.method === 'options') return callback(204, {});
        return handler._impl[req.method](req, callback);
    }
    callback(405, { error: 'Method Not Allowed' });
};

handler._impl = {};

/**
 * GET: List jobs with filters
 * Query params: jobId, projectId, environment, status, agentId, type, limit, skip
 */
handler._impl.get = async (req, callback) => {
    try {
        const { queryStringObject } = req;
        const jobId = typeof queryStringObject?.jobId === 'string' ? queryStringObject.jobId : null;
        const projectId = typeof queryStringObject?.projectId === 'string' ? queryStringObject.projectId : null;
        const environment = typeof queryStringObject?.environment === 'string' ? queryStringObject.environment : null;
        const status = typeof queryStringObject?.status === 'string' ? queryStringObject.status : null;
        const agentId = typeof queryStringObject?.agentId === 'string' ? queryStringObject.agentId : null;
        const type = typeof queryStringObject?.type === 'string' ? queryStringObject.type : null;
        const limit = parseInt(queryStringObject?.limit) || 50;
        const skip = parseInt(queryStringObject?.skip) || 0;

        const filters = {};
        if (jobId) filters.jobId = jobId;
        if (projectId) filters.projectId = projectId;
        if (environment) filters['payload.environment'] = environment;
        if (status) filters.status = status;
        if (agentId) filters.agentId = agentId;
        if (type) filters.type = type;

        const result = await jobService.listJobs(filters, limit, skip);
        callback(200, { data: result.jobs, total: result.total, limit: result.limit, skip: result.skip });
    } catch (e) {
        console.error('[jobsHandler.get] error:', e);
        callback(500, { error: 'Failed to fetch jobs' });
    }
};

/**
 * POST: Dispatch job, report status, or log message
 * Actions:
 * - dispatch: Create and dispatch job to agent
 *   Body: { projectId, environment, version?, type? } OR { agentId, type, payload, projectId? }
 * - report: Update job status
 *   Body: { action: 'report', jobId, status?, finishedAt? }
 * - log: Add log entry to job
 *   Body: { action: 'log', jobId, type?, message }
 */
handler._impl.post = async (req, callback) => {
    try {
        const action = typeof req?.body?.action === 'string' ? req.body.action : 'dispatch';

        if (action === 'dispatch') {
            return await handleDispatch(req, callback);
        } else if (action === 'report') {
            return await handleReport(req, callback);
        } else if (action === 'log') {
            return await handleLog(req, callback);
        } else {
            callback(400, { error: 'Unknown action' });
        }
    } catch (e) {
        console.error('[jobsHandler.post] error:', e);
        callback(500, { error: 'Failed to process job request' });
    }
};

/**
 * Handle job dispatch (smart dispatch with project config lookup)
 */
async function handleDispatch(req, callback) {
    const projectId = typeof req?.body?.projectId === 'string' ? req.body.projectId : null;
    const environment = typeof req?.body?.environment === 'string' ? req.body.environment : null;
    const version = typeof req?.body?.version === 'string' ? req.body.version : undefined;
    const type = typeof req?.body?.type === 'string' ? req.body.type : 'deploy';
    let agentId = typeof req?.body?.agentId === 'string' ? req.body.agentId : null;
    let payload = req?.body?.payload || {};

    // Smart dispatch: build payload from project configuration
    if (projectId && environment && !agentId) {
        try {
            const result = await jobService.buildDeploymentPayload(projectId, environment, type, version);
            agentId = result.agentId;
            payload = result.payload;
        } catch (err) {
            return callback(err.message.includes('not found') ? 404 : 400, { error: err.message });
        }
    }

    if (!agentId || !type) {
        return callback(400, { error: 'agentId and type required' });
    }

    const { jobId } = await jobService.createJob({ agentId, projectId, type, payload });

    // Push to agent SSE stream
    const pushed = pushJob(agentId, { jobId, type, projectId, payload });
    callback(200, { data: { jobId, pushed } });
}

/**
 * Handle job status report from agent
 */
async function handleReport(req, callback) {
    const jobId = typeof req?.body?.jobId === 'string' ? req.body.jobId : null;
    if (!jobId) return callback(400, { error: 'jobId required' });

    const status = typeof req?.body?.status === 'string' ? req.body.status : undefined;
    const finishedAt = req?.body?.finishedAt ? new Date(req.body.finishedAt) : undefined;

    await jobService.updateJobStatus(jobId, status, finishedAt);

    // Send completion event if job finished
    if (status && (status === 'SUCCESS' || status === 'FAILED')) {
        completeJobStream(jobId, status);
    }

    callback(200, { data: 'ok' });
}

/**
 * Handle log message from agent
 */
async function handleLog(req, callback) {
    const jobId = typeof req?.body?.jobId === 'string' ? req.body.jobId : null;
    if (!jobId) return callback(400, { error: 'jobId required' });

    const type = typeof req?.body?.type === 'string' ? req.body.type : 'info';
    const message = typeof req?.body?.message === 'string' ? req.body.message : '';

    // Log to server console
    if (message) {
        try {
            console.log(`[job ${jobId}] [${type}] ${message}`);
        } catch (_) {}
    }

    // Push to SSE subscribers for live UI logs
    pushJobLog(jobId, { type, message, timestamp: new Date().toISOString() });
    callback(200, { data: 'ok' });
}

module.exports = handler;
