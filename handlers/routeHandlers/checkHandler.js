/**
 * Title: Check Handler
 * Description: Handler to handle user defined checks
 * Author: Jonayed Ahmed Riduan
 * Date: 01/16/2024
 */

// dependencies
const mongoose = require('mongoose');
const data = require('../../lib/data');
const { hash, parseJSON, createRandomString } = require('../../helpers/utilities');
const tokenHandler = require('./tokenHandler');
const { maxChecks } = require('../../helpers/environments');
const tokenSchema = require('../../schemas/tokenSchema');
const userSchema = require('../../schemas/userSchema');
const checkSchema = require('../../schemas/checkSchema');

// Creating a model based on userSchema and tokenSchema
// Model for object mapping (ODM)
const Token = new mongoose.model("Token", tokenSchema);
const User = new mongoose.model("User", userSchema);
const Check = new mongoose.model("Check", checkSchema);

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

    // token sanity check
    let token = typeof (requestProperties.headersObject.token) === 'string'
        ? requestProperties.headersObject.token : false;

    // Lookup the userId by reading the token.
    Token.find({ token: token }).then(tokenData => {
        if (tokenData?.length > 0) {

            let userId = tokenData?.[0]?.userId;

            User.find({ userId: userId }).then(userData => {
                if (userData?.length > 0) {

                    // @TODO: Need to verify token

                    let userChecks = typeof (userData[0].checks) === 'object' && Array.isArray(userData[0].checks)
                        ? userData[0].checks : [];

                    if (userChecks.length < maxChecks) {

                        if (Array.isArray(requestProperties.body.checks) && requestProperties.body.checks?.length > 0) {

                            let badRequests = [];
                            let checkList = requestProperties.body.checks.map(check => {
                                // validate inputs
                                let protocol = typeof (check.protocol) === 'string' && ['http', 'https'].includes(check.protocol)
                                    ? check.protocol : false;

                                let url = typeof (check.url) === 'string' && check.url.trim().length > 0
                                    ? check.url : false;

                                let method = typeof (check.method) === 'string' && ['GET', 'POST', 'PUT', 'DELETE'].includes(check.method)
                                    ? check.method : false;

                                let successCodes = typeof (check.successCodes) === 'object' && Array.isArray(check.successCodes)
                                    ? check.successCodes : false;

                                let timeoutSeconds = typeof (check.timeoutSeconds) === 'number' && check.timeoutSeconds % 1 === 0
                                    && check.timeoutSeconds >= 1 && check.timeoutSeconds <= 10
                                    ? check.timeoutSeconds : false;

                                if (protocol && url && method && successCodes && timeoutSeconds) {
                                    return check;
                                } else {
                                    badRequests.push(check);
                                    return false;
                                }
                            })?.filter(check => check !== false);

                            // Save to db
                            Check.insertMany(checkList).then(checkListResponse => {

                                const checkListIds = checkListResponse.map(checkResponse => checkResponse._id);

                                let userObject = userData[0];
                                // add check id to the users object
                                userObject.checks = userChecks;
                                userObject.checks.push(...checkListIds);

                                User.updateOne({ userId: userId }, {
                                    $set: userObject
                                }).then(() => {
                                    // return the data about the new check
                                    if (badRequests?.length === 0) {
                                        callback(200, {
                                            data: 'Checks Created successfully.',
                                            checks: checkListResponse
                                        });
                                    } else {
                                        callback(200, {
                                            data: 'Checks Created successfully.',
                                            failedChecks: badRequests
                                        });
                                    }
                                }).catch(err => {
                                    callback(500, {
                                        error: err,
                                    });
                                })

                            }).catch(err => {
                                callback(500, {
                                    error: 'There was a server side error.',
                                });
                            })
                        } else {
                            callback(400, {
                                error: 'There is a problem in your request.'
                            });
                        }
                    } else {
                        callback(401, {
                            error: 'User has already reached maximum check limit.'
                        });
                    }
                } else {
                    callback(404, {
                        error: 'User not found.'
                    });
                }
            }).catch(err => {
                callback(500, {
                    error: 'There was a server side error.',
                });
            })
        } else {
            callback(403, {
                error: 'Authentication failed.'
            });
        }
    }).catch(err => {

        callback(500, {
            error: 'There was a server side error.',
        });
    })
};

handler._check.get = (requestProperties, callback) => {
    const userId = typeof requestProperties.queryStringObject.userId === 'string' && requestProperties.queryStringObject.userId.trim().length > 0
        ? requestProperties.queryStringObject.userId : false;

    if (userId) {
        
    }

    // if (userId) {
    //     // lookup the check
    //     data.read('checks', id, (err, checkData) => {
    //         if (!err && checkData) {
    //             // sanity check of token
    //             const token = typeof (requestProperties.headersObject.token) === 'string'
    //                 ? requestProperties.headersObject.token : false;

    //             // verify the token
    //             tokenHandler._token.verify(token, parseJSON(checkData).userPhone, (tokenIsValid) => {
    //                 if (tokenIsValid) {
    //                     callback(200, parseJSON(checkData));
    //                 } else {
    //                     callback(403, {
    //                         error: 'Authentication failed.',
    //                     });
    //                 }
    //             })
    //         } else {
    //             callback(500, {
    //                 error: 'There was a problem in server side.',
    //             });
    //         }
    //     })
    // } else {
    //     callback(400, {
    //         error: 'You have a problem in your request',
    //     });
    // }

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