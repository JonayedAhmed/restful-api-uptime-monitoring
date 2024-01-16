/**
 * Title: Check Handler
 * Description: Handler to handle user defined checks
 * Author: Jonayed Ahmed Riduan
 * Date: 01/16/2024
 */

// dependencies
const data = require('../../lib/data');
const { hash, parseJSON, createRandomString } = require('../../helpers/utilities');
const tokenHandler = require('./tokenHandler');
const { maxChecks } = require('../../helpers/environments');

// module scaffolding
const handler = {};

handler.checkHandler = (requestProperties, callback) => {

    const acceptedMethods = ['get', 'post', 'put', 'delete'];
    if (acceptedMethods?.includes(requestProperties?.method)) {
        handler._check[requestProperties.method](requestProperties, callback);
    } else {
        callback(405);
    }
}

handler._check = {};

handler._check.post = (requestProperties, callback) => {
    // validate inputs
    let protocol = typeof (requestProperties.body.protocol) === 'string' && ['http', 'https'].includes(requestProperties.body.protocol)
        ? requestProperties.body.protocol : false;

    let url = typeof (requestProperties.body.url) === 'string' && requestProperties.body.url.trim().length > 0
        ? requestProperties.body.url : false;

    let method = typeof (requestProperties.body.method) === 'string' && ['GET', 'POST', 'PUT', 'DELETE'].includes(requestProperties.body.method)
        ? requestProperties.body.method : false;

    let successCodes = typeof (requestProperties.body.successCodes) === 'object' && Array.isArray(requestProperties.body.successCodes)
        ? requestProperties.body.successCodes : false;

    let timeoutSeconds = typeof (requestProperties.body.timeoutSeconds) === 'number' && requestProperties.body.timeoutSeconds % 1 === 0
        && requestProperties.body.timeoutSeconds >= 1 && requestProperties.body.timeoutSeconds <= 10
        ? requestProperties.body.timeoutSeconds : false;


    if (protocol && url && method && successCodes && timeoutSeconds) {
        // token sanity check
        let token = typeof (requestProperties.headersObject.token) === 'string'
            ? requestProperties.headersObject.token : false;

        // Lookup the user phone by reading the token.
        data.read('tokens', token, (err1, tokenData) => {
            if (!err1 && tokenData) {
                let userPhone = parseJSON(tokenData).phone;
                // lookup the user data
                data.read('users', userPhone, (err2, userData) => {
                    if (!err2 && userData) {
                        // verify the token
                        tokenHandler._token.verify(token, userPhone, (tokenIsValid) => {
                            if (tokenIsValid) {

                                let userObject = parseJSON(userData);
                                let userChecks = typeof (userObject.checks) === 'object' && Array.isArray(userObject.checks)
                                    ? userObject.checks : [];

                                if (userChecks.length < maxChecks) {
                                    let checkId = createRandomString(20);
                                    let checkObject = {
                                        id: checkId,
                                        userPhone,
                                        protocol,
                                        url,
                                        method,
                                        successCodes,
                                        timeoutSeconds
                                    }

                                    //  save the object
                                    data.create('checks', checkId, checkObject, (err3) => {
                                        if (!err3) {
                                            // add check id to the users object
                                            userObject.checks = userChecks;
                                            userObject.checks.push(checkId);

                                            // save the new user data
                                            data.update('users', userPhone, userObject, (err4) => {
                                                if (!err4) {
                                                    // return the data about the new check
                                                    callback(200, checkObject);
                                                } else {
                                                    callback(500, {
                                                        error: 'There was a server side error.'
                                                    });
                                                }
                                            })
                                        } else {
                                            callback(500, {
                                                error: 'There was a server side error.'
                                            });
                                        }
                                    })
                                } else {
                                    callback(401, {
                                        error: 'User has already reached maximum check limit.'
                                    });
                                }
                            } else {
                                callback(403, {
                                    error: 'Authentication failed.'
                                });
                            }
                        });
                    } else {
                        callback(404, {
                            error: 'User not found.'
                        });
                    }
                })
            } else {
                callback(403, {
                    error: 'Authentication failed.'
                });
            }
        })
    } else {
        callback(400, {
            error: 'You have a problem in your request',
        });
    }
};

handler._check.get = (requestProperties, callback) => {
    const id = typeof requestProperties.queryStringObject.id === 'string' && requestProperties.queryStringObject.id.trim().length === 20
        ? requestProperties.queryStringObject.id : false;

    if (id) {
        // lookup the check
        data.read('checks', id, (err, checkData) => {
            if (!err && checkData) {
                // sanity check of token
                const token = typeof (requestProperties.headersObject.token) === 'string'
                    ? requestProperties.headersObject.token : false;

                // verify the token
                tokenHandler._token.verify(token, parseJSON(checkData).userPhone, (tokenIsValid) => {
                    if (tokenIsValid) {
                        callback(200, parseJSON(checkData));
                    } else {
                        callback(403, {
                            error: 'Authentication failed.',
                        });
                    }
                })
            } else {
                callback(500, {
                    error: 'There was a problem in server side.',
                });
            }
        })
    } else {
        callback(400, {
            error: 'You have a problem in your request',
        });
    }

}

handler._check.put = (requestProperties, callback) => {
    const id = typeof requestProperties.body.id === 'string' && requestProperties.body.id.trim().length === 20
        ? requestProperties.body.id : false;

    // validate inputs
    const protocol = typeof (requestProperties.body.protocol) === 'string' && ['http', 'https'].includes(requestProperties.body.protocol)
        ? requestProperties.body.protocol : false;

    const url = typeof (requestProperties.body.url) === 'string' && requestProperties.body.url.trim().length > 0
        ? requestProperties.body.url : false;

    const method = typeof (requestProperties.body.method) === 'string' && ['GET', 'POST', 'PUT', 'DELETE'].includes(requestProperties.body.method)
        ? requestProperties.body.method : false;

    const successCodes = typeof (requestProperties.body.successCodes) === 'object' && Array.isArray(requestProperties.body.successCodes)
        ? requestProperties.body.successCodes : false;

    const timeoutSeconds = typeof (requestProperties.body.timeoutSeconds) === 'number' && requestProperties.body.timeoutSeconds % 1 === 0
        && requestProperties.body.timeoutSeconds >= 1 && requestProperties.body.timeoutSeconds <= 10
        ? requestProperties.body.timeoutSeconds : false;


    if (id) {
        if (protocol || url || method || successCodes || timeoutSeconds) {
            data.read("checks", id, (err1, checkData) => {
                if (!err1 && checkData) {
                    let checkObject = parseJSON(checkData);

                    // sanity check of token
                    const token = typeof (requestProperties.headersObject.token) === 'string'
                        ? requestProperties.headersObject.token : false;

                    // verify the token
                    tokenHandler._token.verify(token, checkObject.userPhone, (tokenIsValid) => {
                        if (tokenIsValid) {
                            // Update the check object
                            if (protocol) {
                                checkObject.protocol = protocol
                            }
                            if (url) {
                                checkObject.url = url
                            }
                            if (method) {
                                checkObject.method = method
                            }
                            if (successCodes) {
                                checkObject.successCodes = successCodes
                            }
                            if (timeoutSeconds) {
                                checkObject.timeoutSeconds = timeoutSeconds
                            }

                            // store the check object
                            data.update("checks", id, checkObject, (err2) => {
                                if (!err2) {
                                    callback(200, checkObject);
                                } else {
                                    callback(500, {
                                        error: 'There was a server side error.',
                                    });
                                }
                            });

                        } else {
                            callback(403, {
                                error: 'Authentication failed.',
                            });
                        }
                    })
                } else {
                    callback(500, {
                        error: 'There was a server side error.',
                    });
                }
            });
        } else {
            callback(400, {
                error: 'You must provide at least one field to update.',
            });
        }
    } else {
        callback(400, {
            error: 'You have a problem in your request',
        });
    }

}

handler._check.delete = (requestProperties, callback) => {
    const id = typeof requestProperties.queryStringObject.id === 'string' && requestProperties.queryStringObject.id.trim().length === 20
        ? requestProperties.queryStringObject.id : false;

    if (id) {
        // lookup the check
        data.read('checks', id, (err, checkData) => {
            if (!err && checkData) {
                // sanity check of token
                const token = typeof (requestProperties.headersObject.token) === 'string'
                    ? requestProperties.headersObject.token : false;

                // verify the token
                tokenHandler._token.verify(token, parseJSON(checkData).userPhone, (tokenIsValid) => {
                    if (tokenIsValid) {
                        // delete the check data
                        data.delete("checks", id, (err2) => {
                            if (!err2) {
                                data.read("users", parseJSON(checkData).userPhone, (err3, userData) => {

                                    let userObject = parseJSON(userData);

                                    if (!err3 && userData) {
                                        let userChecks = typeof (userObject.checks) === 'object' && Array.isArray(userObject.checks)
                                            ? userObject.checks : [];

                                        // remove the deleted check id from user's list of checks
                                        let checkPosition = userChecks.indexOf(id);
                                        if (checkPosition > -1) {
                                            userChecks.splice(checkPosition, 1);
                                            // resave the user data
                                            userObject.checks = userChecks;
                                            data.update("users", userObject.phone, userObject, (err4) => {
                                                if (!err4) {
                                                    callback(200);
                                                } else {
                                                    callback(500, {
                                                        error: 'There was a problem in server side.',
                                                    });
                                                }
                                            });
                                        } else {
                                            callback(500, {
                                                error: 'The check id that you are trying to remove was not found in user .',
                                            });
                                        }
                                    } else {
                                        callback(500, {
                                            error: 'There was a problem in server side.',
                                        });
                                    }
                                })
                            } else {
                                callback(500, {
                                    error: 'There was a problem in server side.',
                                });
                            }
                        });
                    } else {
                        callback(403, {
                            error: 'Authentication failed.',
                        });
                    }
                })
            } else {
                callback(500, {
                    error: 'There was a problem in server side.',
                });
            }
        })
    } else {
        callback(400, {
            error: 'You have a problem in your request',
        });
    }
}

module.exports = handler;