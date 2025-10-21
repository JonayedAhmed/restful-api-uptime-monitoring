/**
 * Title: Worker Metrics Handler
 * Description: Returns basic worker health metrics
 */

const worker = require('../../lib/worker');

const handler = {};

handler.metricsHandler = (requestProperties, callback) => {
    const acceptedMethods = ['get'];
    if (acceptedMethods.includes(requestProperties.method)) {
        const m = worker.metrics || {};
        return callback(200, m);
    }
    return callback(405);
};

module.exports = handler;
