/**
 * Title: Deployment Agent Schema
 * Description: Registered deployment agents that can execute jobs remotely
 */

const mongoose = require('mongoose');

const deploymentAgentSchema = new mongoose.Schema({
    name: { type: String, required: true },
    hostType: { type: String, enum: ['Linux', 'macOS', 'Windows'], required: true },
    status: { type: String, enum: ['ONLINE', 'OFFLINE'], default: 'OFFLINE', index: true },
    token: { type: String, required: true, unique: true },
    description: { type: String },
    lastSeenAt: { type: Date },
    createdBy: { type: String },
}, { timestamps: true });

module.exports = deploymentAgentSchema;
