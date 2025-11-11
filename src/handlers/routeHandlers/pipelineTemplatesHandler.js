/**
 * Title: Pipeline Templates Handler
 * Description: CRUD for pipeline templates
 */

const mongoose = require('mongoose');
const pipelineTemplateSchema = require('../../schemas/pipelineTemplateSchema');
const tokenHandler = require('./tokenHandler');

const PipelineTemplate = new mongoose.model('PipelineTemplate', pipelineTemplateSchema);

const handler = {};

handler.pipelineTemplatesHandler = (requestProperties, callback) => {
    const accepted = ['get', 'post', 'put', 'delete', 'options'];
    if (accepted.includes(requestProperties?.method)) {
        if (requestProperties.method === 'options') return callback(204, {});
        return handler._impl[requestProperties.method](requestProperties, callback);
    }
    callback(405, { error: 'Method Not Allowed' });
};

handler._impl = {};

// GET: list all templates
handler._impl.get = async (_req, callback) => {
    try {
        const list = await PipelineTemplate.find({}).sort({ createdAt: -1 });
        callback(200, { data: list });
    } catch (e) {
        callback(500, { error: 'Failed to list templates' });
    }
};

// POST: create template (requires token)
handler._impl.post = async (req, callback) => {
    try {
        const { body, headersObject } = req;
        const token = typeof headersObject?.token === 'string' ? headersObject.token : false;
        const userId = typeof body?.createdBy === 'string' ? body.createdBy : (typeof body?.userId === 'string' ? body.userId : false);
        if (!token || !userId) return callback(403, { error: 'Auth required' });

        tokenHandler._token.verify(token, userId, async (ok) => {
            if (!ok) return callback(403, { error: 'Authentication failed.' });
            const doc = new PipelineTemplate({
                templateName: body?.templateName,
                language: body?.language,
                framework: body?.framework,
                buildCommands: body?.buildCommands || [],
                runCommands: body?.runCommands || [],
                stopCommands: body?.stopCommands || [],
                defaultBranch: body?.defaultBranch || 'main',
                createdBy: userId,
            });
            await doc.save();
            callback(201, { data: doc });
        });
    } catch (e) {
        callback(500, { error: 'Failed to create template' });
    }
};

// PUT: update by _id
handler._impl.put = async (req, callback) => {
    try {
        const { body, headersObject } = req;
        const token = typeof headersObject?.token === 'string' ? headersObject.token : false;
        const userId = typeof body?.userId === 'string' ? body.userId : false;
        const _id = typeof body?._id === 'string' ? body._id : (body?._id?._id || null);
        if (!token || !userId || !_id) return callback(400, { error: 'Missing fields' });
        tokenHandler._token.verify(token, userId, async (ok) => {
            if (!ok) return callback(403, { error: 'Authentication failed.' });
            const updated = await PipelineTemplate.findByIdAndUpdate(_id, { $set: { ...body, updatedAt: new Date() } }, { new: true });
            callback(200, { data: updated });
        });
    } catch (e) {
        callback(500, { error: 'Failed to update template' });
    }
};

// DELETE: by id via query ?id=
handler._impl.delete = async (req, callback) => {
    try {
        const id = typeof req?.queryStringObject?.id === 'string' ? req.queryStringObject.id : null;
        if (!id) return callback(400, { error: 'id required' });
        await PipelineTemplate.findByIdAndDelete(id);
        callback(200, { data: 'Deleted' });
    } catch (e) {
        callback(500, { error: 'Failed to delete template' });
    }
};

module.exports = handler;
