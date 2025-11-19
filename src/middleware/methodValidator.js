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

        // Run all validators sequentially
        try {
            for (const validator of validators) {
                // Express-validator middleware functions return promises when called
                await validator(req, res, () => {});
            }

            // Check for validation errors
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                // Send error response and stop here - don't call next()
                return res.status(400).json({
                    error: 'Validation failed',
                    details: errors.array()
                });
            }

            // Validation passed, continue to next middleware
            next();
        } catch (error) {
            // If there's an error during validation, pass it to error handler
            next(error);
        }
    };
};

module.exports = { validateForMethod };
