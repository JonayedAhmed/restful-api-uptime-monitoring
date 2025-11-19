/**
 * Title: Routes
 * Description: Application Routes
 * Author: Jonayed Ahmed Riduan
 * Date: 01/10/2024
 */


// dependencies
const { userHandler } = require('./handlers/routeHandlers/userHandler');
const { tokenHandler } = require('./handlers/routeHandlers/tokenHandler');
const { checkHandler } = require('./handlers/routeHandlers/checkHandler');
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

const routes = {
    user: userHandler,
    token: tokenHandler,
    check: checkHandler,
    'check/ssl': (req, cb) => checkHandler._check.sslDetails(req, cb),
    'check/ssl-renewal': (req, cb) => checkHandler._check.sslRenewal(req, cb),
    'checks/stream': checkUpdateStreamHandler,
    health: healthHandler,
    settings: settingsHandler,
    metrics: metricsHandler,
    deployments: deploymentsHandler,
    terminal: deploymentsHandler,
    pipelines: pipelineTemplatesHandler,
    deploymentProjects: deploymentProjectsHandler,
    deploymentAgents: deploymentAgentsHandler,
    agentStream: agentStreamHandler,
    jobs: jobsHandler,
    agentCode: agentCodeHandler,
    'jobs/stream': jobLogStreamHandler,
}


module.exports = routes;