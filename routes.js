/**
 * Title: Routes
 * Description: Application Routes
 * Author: Jonayed Ahmed Riduan
 * Date: 01/10/2024
 */


// dependencies
const {sampleHandler} = require('./handlers/routeHandlers/sampleHandler');
const {userHandler} = require('./handlers/routeHandlers/userHandler');

const routes = {
    sample: sampleHandler,
    user: userHandler
}


module.exports = routes;