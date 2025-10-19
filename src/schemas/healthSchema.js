const mongoose = require('mongoose');

const healthSchema = mongoose.Schema({
    checkId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Check',
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now,
        required: true
    },
    state: {
        type: String,
        enum: ['UP', 'DOWN'],
        required: true
    },
    responseTime: {
        type: Number, // in ms
        required: true
    },
    statusCode: {
        type: Number, // HTTP status code
        required: true
    },
    error: {
        type: String, // e.g. "ETIMEDOUT", "ECONNREFUSED"
        default: null
    },
    isAlertTriggered: {
        type: Boolean,
        default: false
    }
});

module.exports = healthSchema;
