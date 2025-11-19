const mongoose = require('mongoose');

const checkSchema = mongoose.Schema({
    userId: {
        type: String,
        required: true,
        index: true // Index for faster user check lookups
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
    // HTTP auth and headers (http/https only)
    authType: { type: String, enum: ['none', 'bearer', 'apiKey'], default: 'none' },
    bearerToken: { type: String },
    apiKeyHeaderName: { type: String },
    apiKeyValue: { type: String },
    headers: { type: Object, default: {} },
    // Optional tags for filtering (e.g., prod, staging, team-x)
    tags: {
        type: [String],
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
    lastChecked: {
        type: Number,
        index: true // Index for worker queries to find checks due for execution
    },
    state: {
        type: String,
        index: true // Index for filtering by UP/DOWN state
    },
    isActive: {
        type: Boolean,
        required: true,
        enum: [true, false],
        index: true // Index for worker to query only active checks
    },
    responseTime: Number,
    serviceName: {
        type: String,
        required: true
    },
    // Flapping control counters
    failureStreak: { type: Number, default: 0 },
    successStreak: { type: Number, default: 0 },
    // Alert bookkeeping to reduce noise
    lastAlertState: {
        type: String,
        enum: ['UP', 'DOWN'],
    },
    lastAlertAt: Number
    ,
    // Alerts-only snooze: when set, alerts are suppressed until this timestamp (ms since epoch)
    snoozeUntil: { type: Number },
    // Track auto-snooze source/time for audit-ability
    autoSnoozedAt: { type: Number },
    autoSnoozeReason: { type: String },
    // Flapping tracking window
    stateChangeCount: { type: Number, default: 0 },
    stateChangeWindowStart: { type: Number },
    lastStateChangedAt: { type: Number },
    // SSL certificate expiry alerts (https only)
    sslExpiryAlerts: { type: Boolean, default: false },
    sslAlertThresholdsSent: { type: [Number], default: [] }, // days thresholds already alerted
    sslLastCertExpiryAt: { type: Number }, // millis since epoch
    sslLastCheckedAt: { type: Number }
});

module.exports = checkSchema;