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

const routes = {
    user: userHandler,
    token: tokenHandler,
    check: checkHandler,
    health: healthHandler,
    settings: settingsHandler,
    metrics: metricsHandler,
    deployments: deploymentsHandler,
    terminal: deploymentsHandler,
}


module.exports = routes;