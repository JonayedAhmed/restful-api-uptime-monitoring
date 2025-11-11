/**
 * Title: Deployment Job Schema
 * Description: Jobs dispatched to agents
 */

const mongoose = require('mongoose');

const deploymentJobSchema = new mongoose.Schema({
    jobId: { type: String, required: true, unique: true },
    agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeploymentAgent', required: true, index: true },
    projectId: { type: String },
    type: { type: String, enum: ['deploy', 'build', 'healthCheck'], required: true },
    payload: { type: Object },
    status: { type: String, enum: ['QUEUED', 'DISPATCHED', 'RUNNING', 'SUCCESS', 'FAILED'], default: 'QUEUED', index: true },
    startedAt: { type: Date },
    finishedAt: { type: Date },
}, { timestamps: true });

module.exports = deploymentJobSchema;
