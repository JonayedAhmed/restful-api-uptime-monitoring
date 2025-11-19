/**
 * Title: Token Validator
 * Description: Middleware to validate and verify tokens
 * Author: Jonayed Ahmed Riduan
 * Date: 11/18/2025
 */

const mongoose = require('mongoose');
const tokenSchema = require('../schemas/tokenSchema');
const Token = mongoose.model('Token', tokenSchema);

/**
 * Validate token from request headers
 * @param {Object} headersObject - Request headers
 * @returns {Promise<Object>} - { valid: boolean, userId?: string, error?: string }
 */
const validateToken = async (headersObject) => {
    try {
        // Extract token from headers
        const token = typeof headersObject.token === 'string' ? headersObject.token : false;

        if (!token) {
            return { valid: false, error: 'Authentication token missing' };
        }

        // Find token in database
        const tokenData = await Token.find({ token: token });
        
        if (!tokenData || tokenData.length === 0) {
            return { valid: false, error: 'Invalid authentication token' };
        }

        // Verify token expiration
        const tokenExpiry = parseInt(tokenData[0].expires);
        const currentTime = Date.now();

        if (tokenExpiry < currentTime) {
            return { valid: false, error: 'Token has expired. Please log in again.' };
        }

        // Token is valid
        return {
            valid: true,
            userId: tokenData[0].userId,
            email: tokenData[0].email,
            token: tokenData[0].token
        };

    } catch (error) {
        console.error('Token validation error:', error);
        return { valid: false, error: 'Token validation failed' };
    }
};

module.exports = { validateToken };
