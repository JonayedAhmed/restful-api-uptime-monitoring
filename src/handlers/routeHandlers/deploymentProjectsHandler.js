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
        const env = typeof req?.queryStringObject?.environment === 'string' ? req.queryStringObject.environment : undefined;
        const filter = env ? { environment: env } : {};
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
                environment: body?.environment,
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
