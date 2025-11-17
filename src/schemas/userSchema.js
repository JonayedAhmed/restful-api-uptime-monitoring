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
        required: true
    },
    email: {
        type: String,
        required: true
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