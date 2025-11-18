/**
 * Title: Project Initial File.
 * Description: Initial file to start the node server and workers.
 * Author: Jonayed Ahmed Riduan
 * Date: 01/01/2024
 */

// dependencies
const server = require('./src/lib/server-express');
const workers = require('./src/lib/worker');

// app object - module scaffolding
const app = {};

app.init = () => {
    // start the server
    server.init();
    // start the workers
    workers.init();
}

app.init();

// export the app
module.exports = app;