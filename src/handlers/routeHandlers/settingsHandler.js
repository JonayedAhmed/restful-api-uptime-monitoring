/**
 * Title: Settings Handler
 * Description: Manage per-user settings like TTL hours
 */

const mongoose = require('mongoose');
const tokenHandler = require('./tokenHandler');
const settingsSchema = require('../../schemas/settingsSchema');

const Settings = new mongoose.model('Settings', settingsSchema);

const handler = {};

handler.settingsHandler = (requestProperties, callback) => {
    const acceptedMethods = ['get', 'put'];
    if (acceptedMethods.includes(requestProperties.method)) {
        handler._settings[requestProperties.method](requestProperties, callback);
    } else {
        callback(405);
    }
};

handler._settings = {};

handler._settings.get = async (requestProperties, callback) => {
    try {
        const token = typeof (requestProperties.headersObject.token) === 'string'
            ? requestProperties.headersObject.token : false;
        const userId = typeof requestProperties.queryStringObject.userId === 'string'
            ? requestProperties.queryStringObject.userId : false;

        if (!token || !userId) return callback(400, { error: 'Invalid or missing parameters.' });

        tokenHandler._token.verify(token, userId, async (tokenIsValid) => {
            if (!tokenIsValid) return callback(403, { error: 'Authentication failed.' });

            const doc = await Settings.findOne({ userId });
            if (!doc) return callback(200, { userId, ttlHours: 24, sslThresholdDays: [30, 14, 7, 3, 1] });
            return callback(200, { userId: doc.userId, ttlHours: doc.ttlHours, sslThresholdDays: doc.sslThresholdDays || [30, 14, 7, 3, 1] });
        });
    } catch (e) {
        return callback(500, { error: 'There was a server-side error.' });
    }
};

handler._settings.put = async (requestProperties, callback) => {
    try {
        const token = typeof (requestProperties.headersObject.token) === 'string'
            ? requestProperties.headersObject.token : false;
        const userId = typeof requestProperties.body.userId === 'string'
            ? requestProperties.body.userId : false;
        const ttlHoursRaw = requestProperties.body.ttlHours;
        const ttlHours = Number(ttlHoursRaw);
        const sslThresholdDaysRaw = requestProperties.body.sslThresholdDays;
        const sslThresholdDays = Array.isArray(sslThresholdDaysRaw) ? sslThresholdDaysRaw.map(Number).filter(n => Number.isFinite(n) && n > 0) : undefined;

        if (!token || !userId || !Number.isFinite(ttlHours) || ttlHours <= 0) {
            return callback(400, { error: 'Invalid or missing parameters.' });
        }

        tokenHandler._token.verify(token, userId, async (tokenIsValid) => {
            if (!tokenIsValid) return callback(403, { error: 'Authentication failed.' });

            const update = { ttlHours };
            if (sslThresholdDays && sslThresholdDays.length) update.sslThresholdDays = sslThresholdDays;
            const updated = await Settings.findOneAndUpdate(
                { userId },
                { $set: update },
                { new: true, upsert: true }
            );
            return callback(200, { userId: updated.userId, ttlHours: updated.ttlHours, sslThresholdDays: updated.sslThresholdDays || [30, 14, 7, 3, 1] });
        });
    } catch (e) {
        return callback(500, { error: 'There was a server-side error.' });
    }
};

module.exports = handler;
