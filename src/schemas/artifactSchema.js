/**
 * Title: Artifact Schema
 * Description: Metadata of built artifacts/images
 */

const mongoose = require('mongoose');

const artifactSchema = new mongoose.Schema({
    deploymentId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeploymentProject', index: true },
    serverId: { type: String },
    versionTag: { type: String, index: true },
    createdAt: { type: Date, default: Date.now },
    storage: {
        type: new mongoose.Schema({
            type: { type: String, enum: ['local', 's3'], default: 'local' },
            path: { type: String },
            url: { type: String },
        }, { _id: false })
    },
    commitHash: { type: String },
    digest: { type: String },
    size: { type: Number },
}, { timestamps: false });

module.exports = artifactSchema;
