/**
 * Title: Server file.
 * Description: Server related files.
 * Author: Jonayed Ahmed Riduan
 * Date: 01/16/2024
 */


// dependencies
const http = require('http');
const { handleReqRes } = require('../helpers/handleReqRes');
const environment = require('../helpers/environments');

// server object - module scaffolding
const server = {};

// create server
server.createServer = () => {
    const createServerVariable = http.createServer(server.handleReqRes);
    createServerVariable.listen(environment.port, () => {
        console.log(`[Listening to port ${environment.port}]`);
    });
}

// handle request response
server.handleReqRes = handleReqRes;

// start the server
server.init = () => {
    console.log('Initializing server . . .')
    server.createServer();
}

// export 
module.exports = server;
