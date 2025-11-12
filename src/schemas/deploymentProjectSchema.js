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

const deploymentTargetSchema = new mongoose.Schema({
    agentId: { type: String, default: '' }, // Which agent (server) to deploy to (optional during setup)
    environment: { type: String, enum: ['dev', 'staging', 'production'], required: true },
    artifacts: { type: [String], default: [] }, // e.g., ["dist/**", "package.json"]
    deployPath: { type: String, default: '' }, // Where on agent server, e.g., "/var/www/staging/my-api"
    autoStart: { type: Boolean, default: false }, // Auto-start service after deployment (uses pipeline's run command)
}, { _id: false });

const deploymentProjectSchema = new mongoose.Schema({
    name: { type: String, required: true, index: true },
    repoUrl: { type: String, required: true },
    branch: { type: String, default: 'main' }, // Default branch (can be overridden per target)
    pipelineTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: 'PipelineTemplate' },
    envVars: { type: [envVarSchema], default: [] }, // Global environment variables
    deploymentTargets: { type: [deploymentTargetSchema], default: [] }, // Agent mappings
    lastDeployedVersion: { type: String },
    createdBy: { type: String },
}, { timestamps: true });

module.exports = deploymentProjectSchema;
