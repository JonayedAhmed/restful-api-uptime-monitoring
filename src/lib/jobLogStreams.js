// In-memory registry for job log SSE streams

const streams = new Map(); // jobId -> res

function registerJobLogStream(jobId, res) {
    streams.set(jobId, res);
    res.on('close', () => {
        streams.delete(jobId);
    });
}

function pushJobLog(jobId, event) {
    const res = streams.get(jobId);
    if (!res) return false;
    try {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
        return true;
    } catch (_) {
        return false;
    }
}

module.exports = { registerJobLogStream, pushJobLog };
