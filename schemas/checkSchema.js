const mongoose = require('mongoose');

const checkSchema = mongoose.Schema({
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
        required: true
    }
});

module.exports = checkSchema;