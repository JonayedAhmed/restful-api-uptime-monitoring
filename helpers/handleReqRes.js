// dependencies
const url = require('url');
const { StringDecoder } = require('string_decoder');

// module saffolding
const handler = {};

handler.handleReqRes = (req, res) => {
    // request handling
    // get the url and parse it.
    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    const trimmedPath = path.replace(/^\/+|\/+$/g, '');
    const method = req.method.toLowerCase();
    const queryStringObject = parsedUrl.query;
    const headersObject = req.headers;

    const decoder = new StringDecoder('utf-8');
    let realData = '';

    req.on('data', (buffer) => {
        realData += decoder.write(buffer);
    });

    req.on('end', () => {
        realData += decoder.end();
        console.log(realData);
        res.end('Hello World.');
    })
}

module.exports = handler;
