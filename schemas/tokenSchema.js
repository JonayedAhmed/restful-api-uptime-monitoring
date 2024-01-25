const mongoose = require('mongoose');

const tokenSchema = mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    token: {
        type: String,
        required: true
    },
    expires: {
        type: String,
        required: true
    }
});

module.exports = tokenSchema;