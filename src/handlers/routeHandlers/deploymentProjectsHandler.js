/**
 * Title: Deployment Projects Handler
 * Description: CRUD for deployment projects
 */

const mongoose = require('mongoose');
const tokenHandler = require('./tokenHandler');
const deploymentProjectSchema = require('../../schemas/deploymentProjectSchema');

const DeploymentProject = new mongoose.model('DeploymentProject', deploymentProjectSchema);

const handler = {};

handler.deploymentProjectsHandler = (requestProperties, callback) => {
    const accepted = ['get', 'post', 'put', 'delete', 'options'];
    if (accepted.includes(requestProperties?.method)) {
        if (requestProperties.method === 'options') return callback(204, {});
        return handler._impl[requestProperties.method](requestProperties, callback);
    }
    callback(405, { error: 'Method Not Allowed' });
};

handler._impl = {};

// GET list (optional environment filter)
handler._impl.get = async (req, callback) => {
    try {
        // Check if requesting details for a specific project
        const projectId = typeof req?.queryStringObject?.id === 'string' ? req.queryStringObject.id : undefined;

        if (projectId) {
            // Return detailed information for a specific project
            const DeploymentJob = mongoose.model('DeploymentJob');
            const PipelineTemplate = mongoose.model('PipelineTemplate');
            const DeploymentAgent = mongoose.model('DeploymentAgent');

            const project = await DeploymentProject.findById(projectId);
            if (!project) return callback(404, { error: 'Project not found' });

            // Get pipeline template details
            let pipelineTemplate = null;
            if (project.pipelineTemplateId) {
                pipelineTemplate = await PipelineTemplate.findById(project.pipelineTemplateId);
            }

            // Get recent deployment history (last 20 jobs)
            const deploymentHistory = await DeploymentJob.find({ projectId })
                .sort({ createdAt: -1 })
                .limit(20)
                .lean();

            // Get deployment statistics per environment
            const stats = {};
            for (const target of project.deploymentTargets || []) {
                const env = target.environment;
                const totalDeployments = await DeploymentJob.countDocuments({ projectId, environment: env });
                const successfulDeployments = await DeploymentJob.countDocuments({ projectId, environment: env, status: 'success' });
                const failedDeployments = await DeploymentJob.countDocuments({ projectId, environment: env, status: 'failed' });
                const lastDeployment = await DeploymentJob.findOne({ projectId, environment: env }).sort({ createdAt: -1 });

                // Get agent details
                let agent = null;
                if (target.agentId) {
                    agent = await DeploymentAgent.findById(target.agentId).select('name hostType status lastCheckIn');
                }

                stats[env] = {
                    totalDeployments,
                    successfulDeployments,
                    failedDeployments,
                    successRate: totalDeployments > 0 ? ((successfulDeployments / totalDeployments) * 100).toFixed(1) : '0.0',
                    lastDeployment: lastDeployment ? {
                        status: lastDeployment.status,
                        createdAt: lastDeployment.createdAt,
                        finishedAt: lastDeployment.finishedAt,
                        duration: lastDeployment.finishedAt && lastDeployment.startedAt
                            ? Math.round((new Date(lastDeployment.finishedAt) - new Date(lastDeployment.startedAt)) / 1000)
                            : null
                    } : null,
                    agent
                };
            }

            return callback(200, {
                data: {
                    project,
                    pipelineTemplate,
                    deploymentHistory,
                    stats
                }
            });
        }

        // Original list logic
        const env = typeof req?.queryStringObject?.environment === 'string' ? req.queryStringObject.environment : undefined;
        const filter = env ? { 'deploymentTargets.environment': env } : {};
        const list = await DeploymentProject.find(filter).sort({ createdAt: -1 });
        callback(200, { data: list });
    } catch (e) {
        callback(500, { error: 'Failed to list projects' });
    }
};

// POST create
handler._impl.post = async (req, callback) => {
    try {
        const { body, headersObject } = req;
        const token = typeof headersObject?.token === 'string' ? headersObject.token : false;
        const userId = typeof body?.createdBy === 'string' ? body.createdBy : (typeof body?.userId === 'string' ? body.userId : false);
        if (!token || !userId) return callback(403, { error: 'Auth required' });
        tokenHandler._token.verify(token, userId, async (ok) => {
            if (!ok) return callback(403, { error: 'Authentication failed.' });
            const doc = new DeploymentProject({
                name: body?.name,
                repoUrl: body?.repoUrl,
                branch: body?.branch || 'main',
                pipelineTemplateId: body?.pipelineTemplateId || null,
                envVars: Array.isArray(body?.envVars) ? body.envVars : [],
                deploymentTargets: Array.isArray(body?.deploymentTargets) ? body.deploymentTargets : [],
                createdBy: userId,
            });
            await doc.save();
            callback(201, { data: doc });
        });
    } catch (e) {
        callback(500, { error: 'Failed to create project' });
    }
};

// PUT update by _id
handler._impl.put = async (req, callback) => {
    try {
        const { body, headersObject } = req;
        const token = typeof headersObject?.token === 'string' ? headersObject.token : false;
        const userId = typeof body?.userId === 'string' ? body.userId : false;
        const _id = typeof body?._id === 'string' ? body._id : (body?._id?._id || null);
        if (!token || !userId || !_id) return callback(400, { error: 'Missing fields' });
        tokenHandler._token.verify(token, userId, async (ok) => {
            if (!ok) return callback(403, { error: 'Authentication failed.' });
            const updated = await DeploymentProject.findByIdAndUpdate(_id, { $set: { ...body, updatedAt: new Date() } }, { new: true });
            callback(200, { data: updated });
        });
    } catch (e) {
        callback(500, { error: 'Failed to update project' });
    }
};

// DELETE by ?id=
handler._impl.delete = async (req, callback) => {
    try {
        const id = typeof req?.queryStringObject?.id === 'string' ? req.queryStringObject.id : null;
        if (!id) return callback(400, { error: 'id required' });
        await DeploymentProject.findByIdAndDelete(id);
        callback(200, { data: 'Deleted' });
    } catch (e) {
        callback(500, { error: 'Failed to delete project' });
    }
};

module.exports = handler;
