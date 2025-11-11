/**
 * Title: Job Log Stream Handler (SSE)
 * Description: Streams job logs to frontend clients per jobId
 */

const { registerJobLogStream } = require('../../lib/jobLogStreams');

const handler = {};

handler.jobLogStreamHandler = (req, callback) => {
    if (req.method === 'options') return callback(204, {});
    if (req.method !== 'get') return callback(405, { error: 'Method Not Allowed' });

    const jobId = typeof req?.queryStringObject?.jobId === 'string' ? req.queryStringObject.jobId : null;
    if (!jobId) return callback(400, { error: 'Missing jobId' });

    callback(200, {
        __sse: true,
        setup: (res) => {
            registerJobLogStream(jobId, res);
            // initial ping
            try {
                res.write(`event: ready\n`);
                res.write(`data: ${JSON.stringify({ ok: true, jobId })}\n\n`);
            } catch (_) { }
        }
    });
};

module.exports = handler;
