/**
 * Title: Deployment Project Schema
 * Description: Stores deployable project configuration
 */

const mongoose = require('mongoose');

const envVarSchema = new mongoose.Schema({
    key: { type: String, required: true },
    value: { type: String, default: '' },
    secretFlag: { type: Boolean, default: false },
}, { _id: false });

const deploymentProjectSchema = new mongoose.Schema({
    name: { type: String, required: true, index: true },
    repoUrl: { type: String, required: true },
    branch: { type: String, default: 'main' },
    pipelineTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: 'PipelineTemplate' },
    envVars: { type: [envVarSchema], default: [] },
    environment: { type: String, enum: ['dev', 'staging', 'production'], required: true },
    lastDeployedVersion: { type: String },
    defaultServerId: { type: String }, // reserved for agent-based future
    createdBy: { type: String },
}, { timestamps: true });

module.exports = deploymentProjectSchema;
