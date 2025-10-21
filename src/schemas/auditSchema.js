const mongoose = require('mongoose');

const auditSchema = mongoose.Schema({
    userId: { type: String, required: true, index: true },
    entity: { type: String, required: true, enum: ['Check', 'User', 'Settings'] },
    entityId: { type: String, required: true },
    action: { type: String, required: true, enum: ['CREATE', 'UPDATE', 'DELETE'] },
    changes: { type: Object, default: {} },
    timestamp: { type: Date, default: Date.now }
});

module.exports = auditSchema;
