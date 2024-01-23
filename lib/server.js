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
const mongoose = require('mongoose');

// server object - module scaffolding
const server = {};


// Database connection with mongoose
server.connectToDatabase = () => {
    mongoose.connect('mongodb://localhost:27017/api-uptime-monitoring')
    .then(() => console.log('Connected to database.'))
    .catch((err) => console.log(err))
}


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
    server.connectToDatabase();
}

// export 
module.exports = server;
