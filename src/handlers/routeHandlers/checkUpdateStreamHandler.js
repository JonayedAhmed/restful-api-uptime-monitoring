/**
 * Title: Check Update Stream Handler (SSE)
 * Description: Streams real-time check status updates to frontend clients
 * Author: Jonayed Ahmed Riduan
 * Date: 12/20/2024
 */

const mongoose = require('mongoose');
const tokenSchema = require('../../schemas/tokenSchema');
const { registerCheckUpdateStream } = require('../../lib/checkUpdateStreams');

const Token = mongoose.model("Token", tokenSchema);

const handler = {};

handler.checkUpdateStreamHandler = async (req, callback) => {
    if (req.method === 'options') return callback(204, {});
    if (req.method !== 'get') return callback(405, { error: 'Method Not Allowed' });

    // Authenticate user via token - check both headers and query params (EventSource can't send custom headers)
    const token = req?.headersObject?.token || req?.queryStringObject?.token;
    
    if (!token) {
        return callback(403, { error: 'Authentication Failed. Token required.' });
    }

    try {
        const tokenData = await Token.find({ token: token });
        
        if (tokenData.length === 0) {
            return callback(403, { error: 'Authentication Failed.' });
        }

        // Check token expiration
        const tokenExpiry = typeof tokenData[0].expires === 'string' 
            ? parseInt(tokenData[0].expires, 10) 
            : tokenData[0].expires;
        const currentTime = Date.now();

        if (tokenExpiry < currentTime) {
            return callback(403, { error: 'Token has expired. Please login again.' });
        }

        const userId = tokenData[0].userId;

        callback(200, {
            __sse: true,
            setup: (res) => {
                registerCheckUpdateStream(userId, res);
                // Send initial ready event
                try {
                    res.write(`event: ready\n`);
                    res.write(`data: ${JSON.stringify({ ok: true, userId })}\n\n`);
                } catch (err) {
                    // Ignore write errors
                }
            }
        });
    } catch (err) {
        console.error('Check update stream error:', err);
        callback(500, { error: 'Internal server error' });
    }
};

module.exports = handler;
