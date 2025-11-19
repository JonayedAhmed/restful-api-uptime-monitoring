/**
 * Title: Input Validation Middleware
 * Description: Reusable validation schemas using express-validator
 * Author: Jonayed Ahmed Riduan
 * Date: 11/18/2025
 */

const { body, param, query, validationResult } = require('express-validator');

/**
 * Middleware to check validation results and return errors
 */
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'Validation failed',
            details: errors.array()
        });
    }
    next();
};

/**
 * User Registration Validation
 */
const validateUserRegistration = [
    body('firstName')
        .trim()
        .notEmpty().withMessage('First name is required')
        .isLength({ min: 2, max: 50 }).withMessage('First name must be 2-50 characters'),
    
    body('lastName')
        .trim()
        .notEmpty().withMessage('Last name is required')
        .isLength({ min: 2, max: 50 }).withMessage('Last name must be 2-50 characters'),
    
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Must be a valid email address')
        .normalizeEmail(),
    
    body('phone')
        .optional()
        .trim()
        .isMobilePhone().withMessage('Must be a valid phone number'),
    
    body('password')
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
        .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
        .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
        .matches(/[0-9]/).withMessage('Password must contain at least one number')
        .matches(/[@$!%*?&#]/).withMessage('Password must contain at least one special character (@$!%*?&#)'),
    
    body('tosAgreement')
        .notEmpty().withMessage('Terms of service agreement is required')
        .isBoolean().withMessage('Terms of service must be true or false')
        .equals('true').withMessage('You must agree to the terms of service'),
    
    handleValidationErrors
];

/**
 * User Login Validation
 */
const validateUserLogin = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Must be a valid email address')
        .normalizeEmail(),
    
    body('password')
        .notEmpty().withMessage('Password is required'),
    
    handleValidationErrors
];

/**
 * Check Creation Validation
 */
const validateCheckCreation = [
    body('checks')
        .isArray({ min: 1 }).withMessage('At least one check is required')
        .custom((checks) => {
            if (!Array.isArray(checks)) return false;
            return checks.every(check => typeof check === 'object' && check !== null);
        }).withMessage('Each check must be an object'),
    
    body('checks.*.protocol')
        .notEmpty().withMessage('Protocol is required')
        .isIn(['http', 'https', 'tcp', 'icmp', 'dns']).withMessage('Invalid protocol'),
    
    body('checks.*.url')
        .trim()
        .notEmpty().withMessage('URL is required')
        .isLength({ min: 3, max: 500 }).withMessage('URL must be 3-500 characters'),
    
    body('checks.*.serviceName')
        .trim()
        .notEmpty().withMessage('Service name is required')
        .isLength({ min: 2, max: 100 }).withMessage('Service name must be 2-100 characters'),
    
    body('checks.*.group')
        .trim()
        .notEmpty().withMessage('Group is required'),
    
    body('checks.*.timeoutSeconds')
        .notEmpty().withMessage('Timeout is required')
        .isInt({ min: 1, max: 10 }).withMessage('Timeout must be between 1 and 10 seconds'),
    
    // Protocol-specific validations
    body('checks.*.method')
        .if(body('checks.*.protocol').isIn(['http', 'https']))
        .notEmpty().withMessage('HTTP method is required for HTTP/HTTPS protocols')
        .isIn(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).withMessage('Invalid HTTP method'),
    
    body('checks.*.port')
        .if(body('checks.*.protocol').equals('tcp'))
        .notEmpty().withMessage('Port is required for TCP protocol')
        .isInt({ min: 1, max: 65535 }).withMessage('Port must be between 1 and 65535'),
    
    body('checks.*.dnsRecordType')
        .if(body('checks.*.protocol').equals('dns'))
        .notEmpty().withMessage('DNS record type is required')
        .isIn(['A', 'AAAA', 'CNAME', 'MX', 'TXT']).withMessage('Invalid DNS record type'),
    
    handleValidationErrors
];

/**
 * Agent Registration Validation
 */
const validateAgentRegistration = [
    body('name')
        .trim()
        .notEmpty().withMessage('Agent name is required')
        .isLength({ min: 3, max: 100 }).withMessage('Agent name must be 3-100 characters')
        .matches(/^[a-zA-Z0-9\-_\s]+$/).withMessage('Agent name can only contain letters, numbers, hyphens, underscores, and spaces'),
    
    body('hostIp')
        .optional()
        .trim()
        .isIP().withMessage('Must be a valid IP address'),
    
    body('platform')
        .optional()
        .isIn(['linux', 'darwin', 'win32', 'windows', 'macos']).withMessage('Invalid platform'),
    
    handleValidationErrors
];

/**
 * Deployment Project Validation
 */
const validateDeploymentProject = [
    body('name')
        .trim()
        .notEmpty().withMessage('Project name is required')
        .isLength({ min: 3, max: 100 }).withMessage('Project name must be 3-100 characters'),
    
    body('repoUrl')
        .trim()
        .notEmpty().withMessage('Repository URL is required')
        .matches(/^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/).withMessage('Must be a valid repository URL'),
    
    body('branch')
        .trim()
        .notEmpty().withMessage('Branch name is required')
        .isLength({ min: 1, max: 100 }).withMessage('Branch name must be 1-100 characters'),
    
    body('pipelineTemplateId')
        .optional()
        .isMongoId().withMessage('Invalid pipeline template ID'),
    
    body('deploymentTargets')
        .isArray({ min: 1 }).withMessage('At least one deployment target is required'),
    
    body('deploymentTargets.*.environment')
        .notEmpty().withMessage('Environment is required')
        .isIn(['dev', 'staging', 'production']).withMessage('Invalid environment'),
    
    body('deploymentTargets.*.enabled')
        .isBoolean().withMessage('Enabled must be true or false'),
    
    body('deploymentTargets.*.agentId')
        .if(body('deploymentTargets.*.enabled').equals(true))
        .notEmpty().withMessage('Agent ID is required for enabled targets')
        .isMongoId().withMessage('Invalid agent ID'),
    
    handleValidationErrors
];

/**
 * MongoDB ObjectId Validation
 */
const validateObjectId = (paramName) => [
    param(paramName)
        .notEmpty().withMessage(`${paramName} is required`)
        .isMongoId().withMessage(`Invalid ${paramName} format`),
    
    handleValidationErrors
];

/**
 * Email Validation (standalone)
 */
const validateEmail = [
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Must be a valid email address')
        .normalizeEmail(),
    
    handleValidationErrors
];

/**
 * Token Validation
 */
const validateToken = [
    body('token')
        .notEmpty().withMessage('Token is required')
        .isLength({ min: 10 }).withMessage('Invalid token format'),
    
    handleValidationErrors
];

module.exports = {
    validateUserRegistration,
    validateUserLogin,
    validateCheckCreation,
    validateAgentRegistration,
    validateDeploymentProject,
    validateObjectId,
    validateEmail,
    validateToken,
    handleValidationErrors
};
