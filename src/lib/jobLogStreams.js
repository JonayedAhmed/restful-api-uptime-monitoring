// In-memory registry for job log SSE streams

const streams = new Map(); // jobId -> res

function registerJobLogStream(jobId, res) {
    streams.set(jobId, res);
    res.on('close', () => {
        streams.delete(jobId);
    });
}

function pushJobLog(jobId, logData) {
    const res = streams.get(jobId);
    if (!res) return false;
    try {
        res.write(`event: log\n`);
        res.write(`data: ${JSON.stringify(logData)}\n\n`);
        return true;
    } catch (_) {
        return false;
    }
}

function completeJobStream(jobId, status) {
    const res = streams.get(jobId);
    if (!res) return false;
    try {
        res.write(`event: complete\n`);
        res.write(`data: ${JSON.stringify({ status })}\n\n`);
        res.end();
        streams.delete(jobId);
        return true;
    } catch (_) {
        return false;
    }
}

module.exports = { registerJobLogStream, pushJobLog, completeJobStream };
