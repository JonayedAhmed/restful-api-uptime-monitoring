const mongoose = require('mongoose');

const settingsSchema = mongoose.Schema({
    userId: { type: String, required: true, index: true },
    ttlHours: { type: Number, default: 24, min: 1 }, // 24H default
}, { timestamps: true });

module.exports = settingsSchema;
