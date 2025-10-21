/**
 * Title: Deployments Handler
 * Description: Execute shell commands on the host (for deployments/ops)
 * Author: Added by Copilot
 * Date: 10/21/2025
 */

// dependencies
const { exec } = require('child_process');
const tokenHandler = require('./tokenHandler');

// module scaffolding
const handler = {};

handler.deploymentsHandler = (requestProperties, callback) => {
    const acceptedMethods = ['post', 'options'];
    if (acceptedMethods.includes(requestProperties?.method)) {
        handler._deployments[requestProperties.method](requestProperties, callback);
    } else {
        callback(405, { error: 'Method Not Allowed' });
    }
};

handler._deployments = {};

// Execute a shell command on the server where the backend is running
// Body: { command: string, cwd?: string, userId: string }
handler._deployments.post = (requestProperties, callback) => {
    try {
        const { body, headersObject } = requestProperties;

        const command = typeof body?.command === 'string' && body.command.trim().length > 0 ? body.command.trim() : false;
        const cwd = typeof body?.cwd === 'string' && body.cwd.trim().length > 0 ? body.cwd.trim() : process.cwd();
        const userId = typeof body?.userId === 'string' && body.userId.trim().length > 0 ? body.userId.trim() : false;
        const token = typeof headersObject?.token === 'string' ? headersObject.token : false;

        if (!command || !userId || !token) {
            return callback(400, { error: 'Invalid request. Provide command, userId, and token.' });
        }

        // Verify auth token for the user
        tokenHandler._token.verify(token, userId, (tokenIsValid) => {
            if (tokenIsValid === true) {
                // Execute the command
                exec(command, { cwd, env: process.env, shell: '/bin/bash', timeout: 60_000, maxBuffer: 5 * 1024 * 1024 }, (error, stdout, stderr) => {
                    const response = {
                        stdout: stdout || '',
                        stderr: stderr || '',
                        code: error && typeof error.code !== 'undefined' ? error.code : 0,
                        signal: error && error.signal ? error.signal : null,
                        cwd,
                    };
                    // Use 200 even on non-zero exit to return output cleanly; client can check code
                    callback(200, response);
                });
            } else {
                return callback(403, { error: 'Authentication failed.' });
            }
        });
    } catch (err) {
        console.error('Deployments exec error:', err);
        return callback(500, { error: 'Server error executing command.' });
    }
};

module.exports = handler;
