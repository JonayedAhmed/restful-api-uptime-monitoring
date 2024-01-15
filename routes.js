/**
 * Title: Routes
 * Description: Application Routes
 * Author: Jonayed Ahmed Riduan
 * Date: 01/10/2024
 */


// dependencies
const {sampleHandler} = require('./handlers/routeHandlers/sampleHandler');
const {userHandler} = require('./handlers/routeHandlers/userHandler');
const {tokenHandler} = require('./handlers/routeHandlers/tokenHandler');

const routes = {
    sample: sampleHandler,
    user: userHandler,
    token: tokenHandler
}


module.exports = routes;