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
    const accepted = ['get', 'post', 'options'];
    if (accepted.includes(req?.method)) {
        if (req.method === 'options') return callback(204, {});
        return handler._impl[req.method](req, callback);
    }
    callback(405, { error: 'Method Not Allowed' });
};

handler._impl = {};

// GET: list jobs with filters
// Query params: projectId, environment, status, agentId, type, limit, skip
handler._impl.get = async (req, callback) => {
    try {
        const { queryStringObject } = req;
        const projectId = typeof queryStringObject?.projectId === 'string' ? queryStringObject.projectId : null;
        const environment = typeof queryStringObject?.environment === 'string' ? queryStringObject.environment : null;
        const status = typeof queryStringObject?.status === 'string' ? queryStringObject.status : null;
        const agentId = typeof queryStringObject?.agentId === 'string' ? queryStringObject.agentId : null;
        const type = typeof queryStringObject?.type === 'string' ? queryStringObject.type : null;
        const limit = parseInt(queryStringObject?.limit) || 50;
        const skip = parseInt(queryStringObject?.skip) || 0;

        const filter = {};
        if (projectId) filter.projectId = projectId;
        if (environment) filter['payload.environment'] = environment;
        if (status) filter.status = status;
        if (agentId) filter.agentId = agentId;
        if (type) filter.type = type;

        const jobs = await DeploymentJob.find(filter)
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(skip)
            .lean();

        const total = await DeploymentJob.countDocuments(filter);

        callback(200, { data: jobs, total, limit, skip });
    } catch (e) {
        console.error('[jobsHandler.get] error:', e);
        callback(500, { error: 'Failed to fetch jobs' });
    }
};

// POST: dispatch or report or log
// dispatch Body: { agentId, type, projectId, payload, environment? }
//   OR smart dispatch: { projectId, environment, version?, type? }
// report   Body: { action: 'report', jobId, status?, log?, stage?, finishedAt? }
// log      Body: { action: 'log', jobId, type?, message }
handler._impl.post = async (req, callback) => {
    try {
        const action = typeof req?.body?.action === 'string' ? req.body.action : 'dispatch';
        if (action === 'dispatch') {
            // Smart dispatch: find agent from project config
            const projectId = typeof req?.body?.projectId === 'string' ? req.body.projectId : null;
            const environment = typeof req?.body?.environment === 'string' ? req.body.environment : null;
            let agentId = typeof req?.body?.agentId === 'string' ? req.body.agentId : null;
            const type = typeof req?.body?.type === 'string' ? req.body.type : 'deploy';
            let payload = req?.body?.payload || {};

            // If projectId + environment provided, look up deployment target
            if (projectId && environment && !agentId) {
                const deploymentProjectSchema = require('../../schemas/deploymentProjectSchema');
                const pipelineTemplateSchema = require('../../schemas/pipelineTemplateSchema');
                const DeploymentProject = mongoose.model('DeploymentProject', deploymentProjectSchema);
                const PipelineTemplate = mongoose.model('PipelineTemplate', pipelineTemplateSchema);

                const project = await DeploymentProject.findById(projectId);
                if (!project) return callback(404, { error: 'Project not found' });

                const target = project.deploymentTargets.find(t => t.environment === environment);
                if (!target) return callback(400, { error: `No deployment target configured for environment: ${environment}` });

                // Get pipeline template commands
                let buildCommands = [];
                let runCommands = [];
                let stopCommands = [];
                if (project.pipelineTemplateId) {
                    const pipeline = await PipelineTemplate.findById(project.pipelineTemplateId);
                    if (pipeline) {
                        buildCommands = pipeline.buildCommands || [];
                        runCommands = pipeline.runCommands || [];
                        stopCommands = pipeline.stopCommands || [];
                    }
                }

                agentId = target.agentId;

                // Build payload based on job type
                if (type === 'deploy') {
                    payload = {
                        ...payload,
                        repository: project.repoUrl,
                        branch: project.branch || 'main',
                        commands: buildCommands, // Use pipeline's build commands
                        artifacts: target.artifacts || [],
                        deployPath: target.deployPath || '',
                        envVars: project.envVars || [],
                        autoStart: target.autoStart || false,
                        startCommand: target.autoStart && runCommands.length > 0 ? runCommands.join(' && ') : '',
                        version: typeof req?.body?.version === 'string' ? req.body.version : undefined,
                    };
                } else if (type === 'start') {
                    payload = {
                        ...payload,
                        startCommand: runCommands.length > 0 ? runCommands.join(' && ') : '',
                        workDir: target.deployPath || ''
                    };
                } else if (type === 'stop') {
                    payload = {
                        ...payload,
                        stopCommand: stopCommands.length > 0 ? stopCommands.join(' && ') : '',
                        workDir: target.deployPath || ''
                    };
                } else if (type === 'restart') {
                    payload = {
                        ...payload,
                        restartCommand: stopCommands.length > 0 && runCommands.length > 0
                            ? `${stopCommands.join(' && ')} && ${runCommands.join(' && ')}`
                            : '',
                        workDir: target.deployPath || ''
                    };
                }
            }

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
