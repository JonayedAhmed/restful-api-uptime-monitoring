const mongoose = require('mongoose');

const checkSchema = mongoose.Schema({
    userId: {
        type: String,
        required: true,
    },
    group: {
        type: String,
        required: true
    },
    url: {
        type: String,
        required: true
    },
    protocol: {
        type: String,
        required: true,
        enum: ["http", "https"]
    },
    method: {
        type: String,
        required: true
    },
    successCodes: {
        type: Array,
        required: true
    },
    timeoutSeconds: {
        type: Number,
        required: true,
        validate: {
            validator: function (value) {
                return value >= 1 && value <= 10;
            },
            message: 'Timeout seconds must be between 1 and 10.'
        }
    },
    lastChecked: Number,
    state: String,
    isActive: {
        type: Boolean,
        required: true,
        enum: [true, false]
    },
    responseTime: Number,
    serviceName: {
        type: String,
        required: true
    }
});

module.exports = checkSchema;