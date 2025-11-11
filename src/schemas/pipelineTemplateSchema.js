/**
 * Title: Pipeline Template Schema
 * Description: Reusable build/run/stop templates
 */

const mongoose = require('mongoose');

const pipelineTemplateSchema = new mongoose.Schema({
    templateName: { type: String, required: true, index: true },
    language: { type: String },
    framework: { type: String },
    buildCommands: { type: [String], default: [] },
    runCommands: { type: [String], default: [] },
    stopCommands: { type: [String], default: [] },
    defaultBranch: { type: String, default: 'main' },
    createdBy: { type: String },
}, { timestamps: true });

module.exports = pipelineTemplateSchema;
