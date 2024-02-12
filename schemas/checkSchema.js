const mongoose = require('mongoose');

const checkSchema = mongoose.Schema({
    userId: {
        type: String,
        required: true,
    },
    protocol: {
        type: String,
        required: true,
        enum: ["http", "https"]
    },
    url: {
        type: String,
        required: true
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
    state: String
});

module.exports = checkSchema;