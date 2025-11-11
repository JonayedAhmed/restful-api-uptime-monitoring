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
const { deploymentRunsHandler } = require('./handlers/routeHandlers/deploymentRunsHandler');
const { deploymentLogsHandler } = require('./handlers/routeHandlers/deploymentLogsHandler');
const { deploymentAgentsHandler } = require('./handlers/routeHandlers/deploymentAgentsHandler');
const { agentStreamHandler } = require('./handlers/routeHandlers/agentStreamHandler');
const { jobsHandler } = require('./handlers/routeHandlers/jobsHandler');
const { agentCodeHandler } = require('./handlers/routeHandlers/agentCodeHandler');
const { jobLogStreamHandler } = require('./handlers/routeHandlers/jobLogStreamHandler');

const routes = {
    user: userHandler,
    token: tokenHandler,
    check: checkHandler,
    health: healthHandler,
    settings: settingsHandler,
    metrics: metricsHandler,
    deployments: deploymentsHandler,
    terminal: deploymentsHandler,
    pipelines: pipelineTemplatesHandler,
    deploymentProjects: deploymentProjectsHandler,
    deploymentRuns: deploymentRunsHandler,
    deploymentLogs: deploymentLogsHandler,
    deploymentAgents: deploymentAgentsHandler,
    agentStream: agentStreamHandler,
    jobs: jobsHandler,
    agentCode: agentCodeHandler,
    'jobs/stream': jobLogStreamHandler,
}


module.exports = routes;