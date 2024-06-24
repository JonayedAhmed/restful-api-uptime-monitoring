/*
 * Title: Handle Request Response
 * Description: Handle Request and response
 * Author: Jonayed Ahmed Riduan
 * Date: 12/01/2024
 *
 */

// dependencies
const url = require('url');
const { StringDecoder } = require('string_decoder');
const routes = require('../routes');
const { notFoundHandler } = require('../handlers/routeHandlers/notFoundHandler');
const { parseJSON } = require('../helpers/utilities');

// module scaffolding
const handler = {};

// CORS headers middleware
const setCorsHeaders = (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, token');
};

const handlePreflightResponse = (res) => {
    // return the preflight response
    res.writeHead(204);
    res.end();
};

handler.handleReqRes = (req, res) => {

    // Set CORS headers for every request
    setCorsHeaders(res);

    // request handling
    // get the url and parse it.
    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    const trimmedPath = path.replace(/^\/+|\/+$/g, '');
    const method = req.method.toLowerCase();
    const queryStringObject = parsedUrl.query;
    const headersObject = req.headers;

    const requestProperties = {
        parsedUrl,
        path,
        trimmedPath,
        method,
        queryStringObject,
        headersObject
    };

    const decoder = new StringDecoder('utf-8');
    let realData = '';

    const chosenHandler = routes[trimmedPath] ? routes[trimmedPath] : notFoundHandler;

    req.on('data', (buffer) => {
        realData += decoder.write(buffer);
    });

    req.on('end', () => {
        realData += decoder.end();
        requestProperties.body = parseJSON(realData);

        if (method === 'options') {
            handlePreflightResponse(res);
        } else {
            chosenHandler(requestProperties, (statusCode, payload) => {
                statusCode = typeof (statusCode) === 'number' ? statusCode : 500;
                payload = typeof (payload) === 'object' ? payload : {};

                const payloadString = JSON.stringify(payload);

                // return the final response
                res.setHeader('Content-Type', 'application/json');
                res.writeHead(statusCode);
                res.end(payloadString);
            });
        }
    });
};

module.exports = handler;
