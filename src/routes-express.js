/**
 * Title: Express Routes
 * Description: API route definitions
 * Author: Jonayed Ahmed Riduan
 * Date: 11/18/2025
 */

const express = require('express');
const router = express.Router();

// Import handlers
const { userHandler } = require('./handlers/routeHandlers/userHandler');
const { tokenHandler } = require('./handlers/routeHandlers/tokenHandler');
const checkHandlerModule = require('./handlers/routeHandlers/checkHandler');
const checkHandler = checkHandlerModule.checkHandler;
const { healthHandler } = require('./handlers/routeHandlers/healthHandler');
const { settingsHandler } = require('./handlers/routeHandlers/settingsHandler');
const { metricsHandler } = require('./handlers/routeHandlers/metricsHandler');
const { deploymentsHandler } = require('./handlers/routeHandlers/deploymentsHandler');
const { pipelineTemplatesHandler } = require('./handlers/routeHandlers/pipelineTemplatesHandler');
const { deploymentProjectsHandler } = require('./handlers/routeHandlers/deploymentProjectsHandler');
const { deploymentAgentsHandler } = require('./handlers/routeHandlers/deploymentAgentsHandler');
const { agentStreamHandler } = require('./handlers/routeHandlers/agentStreamHandler');
const { jobsHandler } = require('./handlers/routeHandlers/jobsHandler');
const { agentCodeHandler } = require('./handlers/routeHandlers/agentCodeHandler');
const { jobLogStreamHandler } = require('./handlers/routeHandlers/jobLogStreamHandler');
const { checkUpdateStreamHandler } = require('./handlers/routeHandlers/checkUpdateStreamHandler');

// Import validators
const {
    validateUserRegistration,
    validateUserLogin,
    validateCheckCreation,
    validateAgentRegistration,
    validateDeploymentProject
} = require('./middleware/validators');

const { validateForMethod } = require('./middleware/methodValidator');

// Helper to wrap old callback-based handlers for Express
const wrapHandler = (handler) => {
    return async (req, res, next) => {
        try {
            // Build request object similar to old format
            const requestProperties = {
                method: req.method.toLowerCase(),
                path: req.path,
                trimmedPath: req.path.replace(/^\/+|\/+$/g, ''),
                queryStringObject: req.query,
                headersObject: req.headers,
                body: req.body,
                parsedUrl: req.url
            };

            // Call handler with callback
            handler(requestProperties, (statusCode, payload) => {
                statusCode = typeof statusCode === 'number' ? statusCode : 500;

                // Support SSE takeover
                if (payload && typeof payload === 'object' && payload.__sse === true && typeof payload.setup === 'function') {
                    res.writeHead(200, {
                        'Content-Type': 'text/event-stream',
                        'Cache-Control': 'no-cache',
                        'Connection': 'keep-alive'
                    });
                    res.write(`: connected\n\n`);
                    payload.setup(res);
                    return;
                }

                // Support raw responses
                if (payload && typeof payload === 'object' && payload.__raw === true) {
                    const body = typeof payload.body === 'string' ? payload.body : '';
                    const contentType = typeof payload.contentType === 'string' ? payload.contentType : 'text/plain; charset=utf-8';
                    res.setHeader('Content-Type', contentType);
                    res.status(statusCode).send(body);
                    return;
                }

                // JSON response
                res.status(statusCode).json(payload || {});
            });
        } catch (error) {
            next(error);
        }
    };
};

// Define routes with validation
router.all('/user', 
    validateForMethod('POST', validateUserRegistration),
    wrapHandler(userHandler)
);

router.all('/token',
    validateForMethod('POST', validateUserLogin),
    wrapHandler(tokenHandler)
);

router.all('/check',
    validateForMethod('POST', validateCheckCreation),
    wrapHandler(checkHandler)
);

router.all('/health', wrapHandler(healthHandler));
router.all('/settings', wrapHandler(settingsHandler));
router.all('/metrics', wrapHandler(metricsHandler));
router.all('/deployments', wrapHandler(deploymentsHandler));
router.all('/terminal', wrapHandler(deploymentsHandler));
router.all('/pipelines', wrapHandler(pipelineTemplatesHandler));

router.all('/deploymentProjects',
    validateForMethod('POST', validateDeploymentProject),
    validateForMethod('PUT', validateDeploymentProject),
    wrapHandler(deploymentProjectsHandler)
);

router.all('/deploymentAgents',
    validateForMethod('POST', validateAgentRegistration),
    wrapHandler(deploymentAgentsHandler)
);

router.all('/agentStream', wrapHandler(agentStreamHandler));
router.all('/jobs', wrapHandler(jobsHandler));
router.all('/agentCode', wrapHandler(agentCodeHandler));
router.all('/jobs/stream', wrapHandler(jobLogStreamHandler));
router.all('/checks/stream', wrapHandler(checkUpdateStreamHandler));

// SSL endpoints
router.get('/check/ssl', wrapHandler((requestProperties, callback) => {
    checkHandlerModule._check.sslDetails(requestProperties, callback);
}));

router.put('/check/ssl-renewal', wrapHandler((requestProperties, callback) => {
    checkHandlerModule._check.sslRenewal(requestProperties, callback);
}));

module.exports = router;
