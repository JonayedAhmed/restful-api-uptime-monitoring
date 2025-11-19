const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
    firstName: {
        type: String,
        required: true
    },
    lastName: {
        type: String,
        required: true
    },
    userId: {
        type: String,
        required: true,
        index: true // Index for faster user lookups
    },
    email: {
        type: String,
        required: true,
        unique: true, // Unique index for login queries and preventing duplicates
        index: true
    },
    additionalEmails: Array,
    phone: String,
    password: {
        type: String,
        required: true
    },
    profilePicture: {
        type: String,
        default: null
    },
    tosAgreement: {
        type: Boolean,
        required: true
    },
    checks: Array
});

module.exports = userSchema;