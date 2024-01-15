/**
 * Title: Uptime Monitoring Application.
 * Description: A RESTFUL API to monitor up or down time of user defined links.
 * Author: Jonayed Ahmed Riduan
 * Date: 01/01/2024
 */


// dependencies
const http = require('http');
const { handleReqRes } = require('./helpers/handleReqRes');
const environment = require('./helpers/environments');

// app object - module scaffolding
const app = {};

// create server
app.createServer = () => {
    const server = http.createServer(app.handleReqRes);
    server.listen(environment.port, () => {
        console.log(`Listening to port ${environment.port}...`);
    });
}

// handle request response
app.handleReqRes = handleReqRes;

// start the server
app.createServer();