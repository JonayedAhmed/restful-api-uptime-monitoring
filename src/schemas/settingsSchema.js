const mongoose = require('mongoose');

const settingsSchema = mongoose.Schema({
    userId: { type: String, required: true, index: true },
    ttlHours: { type: Number, default: 24, min: 1 }, // 24H default
    // Global interval (minutes) for running checks; worker will skip checks not due yet
    globalIntervalMinutes: { type: Number, default: 1, min: 1 },
    sslThresholdDays: {
        type: [Number],
        default: [30, 14, 7, 3, 1],
        validate: {
            validator: (arr) => Array.isArray(arr) && arr.every(n => Number.isFinite(n) && n > 0),
            message: 'sslThresholdDays must be an array of positive numbers'
        }
    }
}, { timestamps: true });

module.exports = settingsSchema;
