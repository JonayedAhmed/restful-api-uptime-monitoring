/**
 * Title: Uptime Monitoring Application.
 * Description: A RESTFUL API to monitor up or down time of user defined links.
 * Author: Jonayed Ahmed Riduan
 * Date: 01/01/2024
 */


// dependencies
const http = require('http');
const {handleReqRes} = require('./helpers/handleReqRes');


// app object - module scaffolding
const app = {};

// configuration
app.config = {
    port: 3000
};

// create server
app.createServer = () => {
    const server = http.createServer(app.handleReqRes);
    server.listen(app.config.port, () => {
        console.log(`Listening to port ${app.config.port}...`);
    });
}

// handle request response
app.handleReqRes = handleReqRes;

// start the server
app.createServer();