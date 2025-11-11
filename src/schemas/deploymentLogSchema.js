/**
 * Title: Deployment Log Schema
 * Description: Stores streamed logs for deployment runs
 */

const mongoose = require('mongoose');

const deploymentLogSchema = new mongoose.Schema({
    deploymentRunId: { type: String, required: true, index: true },
    serverId: { type: String },
    timestamp: { type: Date, default: Date.now, index: true },
    streamType: { type: String, enum: ['stdout', 'stderr'], default: 'stdout' },
    content: { type: String, default: '' },
}, { timestamps: false });

module.exports = deploymentLogSchema;
