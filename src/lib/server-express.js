/**
 * Title: Express Server
 * Description: Server initialization with Express
 * Author: Jonayed Ahmed Riduan
 * Date: 11/18/2025
 */

const app = require('../app');
const environment = require('../helpers/environments');
const mongoose = require('mongoose');

const server = {};

// Database connection with mongoose
server.connectToDatabase = () => {
    mongoose.connect('mongodb+srv://jonayedahmed99455:kNgWOh0uZbOAvsey@cluster0.v5mb8h1.mongodb.net/api-uptime-monitoring')
        .then(() => console.log('✅ Connected to database'))
        .catch((err) => console.error('❌ Database connection error:', err));
};

// Start Express server
server.createServer = () => {
    const port = environment.port || 5050;
    app.listen(port, () => {
        console.log(`✅ Server listening on port ${port} [${environment.envName}]`);
    });
};

// Initialize server
server.init = () => {
    console.log('🚀 Initializing Express server...');
    server.connectToDatabase();
    server.createServer();
};

module.exports = server;
