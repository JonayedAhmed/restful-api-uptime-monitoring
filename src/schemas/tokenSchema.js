const mongoose = require('mongoose');

const tokenSchema = mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true // Index for finding tokens by user
    },
    email: {
        type: String,
        required: true
    },
    token: {
        type: String,
        required: true,
        unique: true, // Unique index for fast token lookups during authentication
        index: true
    },
    expires: {
        type: String,
        required: true,
        index: true // Index for TTL queries and cleanup of expired tokens
    }
});

module.exports = tokenSchema;