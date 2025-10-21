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
        enum: ["http", "https", "tcp", "icmp", "dns"]
    },
    // For HTTP/HTTPS only. Not required for tcp/icmp/dns
    method: {
        type: String,
    },
    successCodes: {
        type: Array,
        default: []
    },
    // For TCP checks
    port: {
        type: Number,
        min: 1,
        max: 65535
    },
    // For DNS checks
    dnsRecordType: {
        type: String,
        enum: ["A", "AAAA", "CNAME", "MX", "TXT"],
    },
    expectedDnsValue: {
        type: String,
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
    },
    // Alert bookkeeping to reduce noise
    lastAlertState: {
        type: String,
        enum: ['UP', 'DOWN'],
    },
    lastAlertAt: Number
});

module.exports = checkSchema;