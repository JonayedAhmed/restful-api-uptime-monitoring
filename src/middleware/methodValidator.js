/**
 * Title: Method-Specific Validation Middleware
 * Description: Apply validation only for specific HTTP methods
 * Author: Jonayed Ahmed Riduan
 * Date: 11/18/2025
 */

const { validationResult } = require('express-validator');

/**
 * Wrapper to apply validation only for specific HTTP methods
 * @param {string} method - HTTP method (POST, PUT, GET, DELETE)
 * @param {Array} validators - Array of express-validator middleware
 */
const validateForMethod = (method, validators) => {
    return async (req, res, next) => {
        // Only validate if the request method matches
        if (req.method.toUpperCase() !== method.toUpperCase()) {
            return next();
        }

        // Run all validators
        for (const validator of validators) {
            await validator.run(req);
        }

        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Validation failed',
                details: errors.array()
            });
        }

        next();
    };
};

module.exports = { validateForMethod };
