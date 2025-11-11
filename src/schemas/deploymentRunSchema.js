/**
 * Title: Deployment Run Schema
 * Description: Records each deployment execution
 */

const mongoose = require('mongoose');

const stepSchema = new mongoose.Schema({
    name: { type: String, required: true },
    status: { type: String, enum: ['PENDING', 'RUNNING', 'SUCCESS', 'FAILED'], default: 'PENDING' },
    exitCode: { type: Number },
    startedAt: { type: Date },
    finishedAt: { type: Date },
}, { _id: false });

const deploymentRunSchema = new mongoose.Schema({
    deploymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeploymentProject', required: true, index: true },
    environment: { type: String, enum: ['dev', 'staging', 'production'], required: true },
    runId: { type: String, required: true, unique: true },
    triggeredBy: { type: String },
    triggerType: { type: String, enum: ['manual', 'webhook', 'schedule'], default: 'manual' },
    commitHash: { type: String },
    versionTag: { type: String },
    status: { type: String, enum: ['PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED'], default: 'PENDING', index: true },
    startedAt: { type: Date },
    finishedAt: { type: Date },
    envSnapshot: { type: Object },
    steps: { type: [stepSchema], default: [] },
    logsLocation: { type: String },
}, { timestamps: true });

module.exports = deploymentRunSchema;
