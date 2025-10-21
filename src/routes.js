/**
 * Title: Routes
 * Description: Application Routes
 * Author: Jonayed Ahmed Riduan
 * Date: 01/10/2024
 */


// dependencies
const { sampleHandler } = require('./handlers/routeHandlers/sampleHandler');
const { userHandler } = require('./handlers/routeHandlers/userHandler');
const { tokenHandler } = require('./handlers/routeHandlers/tokenHandler');
const { checkHandler } = require('./handlers/routeHandlers/checkHandler');
const { healthHandler } = require('./handlers/routeHandlers/healthHandler');
const { settingsHandler } = require('./handlers/routeHandlers/settingsHandler');
const { metricsHandler } = require('./handlers/routeHandlers/metricsHandler');

const routes = {
    sample: sampleHandler,
    user: userHandler,
    token: tokenHandler,
    check: checkHandler,
    health: healthHandler,
    settings: settingsHandler,
    metrics: metricsHandler,
}


module.exports = routes;