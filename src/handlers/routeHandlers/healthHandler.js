/**
 * Title: Health Handler
 * Description: Returns health history for a check
 */

const mongoose = require('mongoose');
const tokenHandler = require('./tokenHandler');
const healthSchema = require('../../schemas/healthSchema');
const checkSchema = require('../../schemas/checkSchema');

const HealthLog = new mongoose.model('HealthLog', healthSchema);
const Check = new mongoose.model('Check', checkSchema);

const handler = {};

handler.healthHandler = (requestProperties, callback) => {
    const acceptedMethods = ['get'];
    if (acceptedMethods.includes(requestProperties.method)) {
        handler._health[requestProperties.method](requestProperties, callback);
    } else {
        callback(405);
    }
}

handler._health = {};

handler._health.get = async (requestProperties, callback) => {
    try {
        const checkId = typeof requestProperties.queryStringObject.checkId === 'string'
            ? requestProperties.queryStringObject.checkId : false;

        const token = typeof (requestProperties.headersObject.token) === 'string'
            ? requestProperties.headersObject.token : false;

        if (!checkId || !token) {
            return callback(400, { error: 'Invalid or missing parameters.' });
        }

        // validate ObjectId format early
        if (!mongoose.Types.ObjectId.isValid(checkId)) {
            return callback(400, { error: 'Invalid checkId.' });
        }

        // find the check to get userId and verify token against that user
        const checkData = await Check.find({ _id: checkId }, { userId: 1 });
        if (!checkData || checkData.length === 0) {
            return callback(404, { error: 'Check not found.' });
        }
        const userId = checkData[0].userId;

        tokenHandler._token.verify(token, userId, async (tokenIsValid) => {
            if (!tokenIsValid) {
                return callback(403, { error: 'Authentication failed.' });
            }

            const limit = Number(requestProperties.queryStringObject.limit) || 50;
            const logs = await HealthLog.find({ checkId: new mongoose.Types.ObjectId(checkId) })
                .sort({ timestamp: -1 })
                .limit(limit);
            return callback(200, logs);
        });
    } catch (err) {
        return callback(500, { error: 'There was a server-side error.' });
    }
}

module.exports = handler;
