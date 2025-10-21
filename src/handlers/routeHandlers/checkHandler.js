/**
 * Title: Check Handler
 * Description: Handler to handle user defined checks
 * Author: Jonayed Ahmed Riduan
 * Date: 01/16/2024
 */

// dependencies
const mongoose = require('mongoose');
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

handler._check.post = async (requestProperties, callback) => {

    try {

        const token = typeof (requestProperties.headersObject.token) === 'string'
            ? requestProperties.headersObject.token : false;

        if (!token) {
            return callback(403, { error: 'Authentication Failed.' });
        }

        const tokenData = await Token.find({ token: token });
        if (!tokenData || tokenData.length === 0) {
            return callback(403, { error: 'Authentication failed.' });
        }

        const userId = tokenData?.[0]?.userId;

        let userData = await User.find({ userId: userId });

        if (!userData || userData?.length === 0) {
            callback(404, {
                error: 'User not found.'
            });
        }

        // @TODO: Need to verify token

        let userChecks = typeof (userData[0].checks) === 'object' && Array.isArray(userData[0].checks)
            ? userData[0].checks : [];

        if (userChecks.length < maxChecks) {

            if (Array.isArray(requestProperties.body.checks) && requestProperties.body.checks?.length > 0) {

                // Validate each check and keep only well-formed ones (protocol-specific rules)
                let badRequests = [];
                let checkList = requestProperties.body.checks.map(check => {
                    // validate inputs
                    let protocol = typeof (check.protocol) === 'string' && ['http', 'https', 'tcp', 'icmp', 'dns'].includes(check.protocol)
                        ? check.protocol : false;

                    let group = typeof (check.group) === 'string' && check.group.trim().length > 0
                        ? check.group : false;

                    let url = typeof (check.url) === 'string' && check.url.trim().length > 0
                        ? check.url : false;

                    // Conditional fields based on protocol
                    let method = (protocol === 'http' || protocol === 'https')
                        ? (typeof (check.method) === 'string' && ['GET', 'POST', 'PUT', 'DELETE'].includes(check.method) ? check.method : false)
                        : true; // not required for other protocols

                    let successCodes = (protocol === 'http' || protocol === 'https')
                        ? (typeof (check.successCodes) === 'object' && Array.isArray(check.successCodes) ? check.successCodes : false)
                        : (Array.isArray(check.successCodes) ? check.successCodes : []);

                    let portOk = (protocol === 'tcp') ? (typeof check.port === 'number' && check.port >= 1 && check.port <= 65535) : true;
                    let dnsOk = (protocol === 'dns') ? (typeof check.dnsRecordType === 'string' && ['A', 'AAAA', 'CNAME', 'MX', 'TXT'].includes(check.dnsRecordType)) : true;

                    let timeoutSeconds = typeof (check.timeoutSeconds) === 'number' && check.timeoutSeconds % 1 === 0
                        && check.timeoutSeconds >= 1 && check.timeoutSeconds <= 10
                        ? check.timeoutSeconds : false;

                    if (group && protocol && url && method && successCodes !== false && timeoutSeconds && portOk && dnsOk) {
                        const checkObject = { ...check, userId };
                        return checkObject;
                    } else {
                        badRequests.push(check);
                        return false;
                    }
                })?.filter(check => check !== false);



                const checkListResponse = await Check.insertMany(checkList);

                if (!checkListResponse || checkListResponse.length === 0) {
                    return callback(500, { error: 'There was a server side error to store check data.' });
                }

                const checkListIds = checkListResponse.map(checkResponse => checkResponse._id.valueOf());

                let userObject = userData[0];
                // add check id to the users object
                userObject.checks = userChecks;
                userObject.checks.push(...checkListIds);

                User.updateOne({ userId: userId }, {
                    $set: userObject
                }).then(() => {
                    // return the data about the new checks created
                    callback(200, {
                        checks: checkListResponse
                    });
                }).catch(err => {
                    callback(500, {
                        error: err,
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
    } catch (error) {
        callback(500, { error: 'There was a server-side error.' });
    }
};

handler._check.get = async (requestProperties, callback) => {
    try {
        const userId = typeof requestProperties.queryStringObject.userId === 'string' && requestProperties.queryStringObject.userId.trim().length > 0
            ? requestProperties.queryStringObject.userId : false;

        const token = typeof (requestProperties.headersObject.token) === 'string'
            ? requestProperties.headersObject.token : false;

        if (userId && token) {
            // Verify the token
            tokenHandler._token.verify(token, userId, async (tokenIsValid) => {
                if (tokenIsValid) {
                    try {
                        // Lookup the checks
                        const userCheckData = await User.find({ userId }, { checks: 1 });

                        if (!userCheckData || userCheckData.length === 0) {
                            return callback(404, {
                                error: 'User not found.',
                            });
                        }

                        const userCheckIds = userCheckData[0].checks;
                        const checks = await Check.find({ _id: { $in: userCheckIds } });

                        if (checks && checks.length > 0) {
                            return callback(200, checks);
                        } else {
                            return callback(404, {
                                error: `This user doesn't have existing checks`,
                            });
                        }
                    } catch (err) {
                        console.error('Error in user check lookup:', err);
                        return callback(500, {
                            error: 'There was a server-side error',
                        });
                    }
                } else {
                    return callback(403, {
                        error: 'Authentication failed.',
                    });
                }
            });
        } else {
            return callback(400, {
                error: 'Invalid or missing parameters.',
            });
        }
    } catch (err) {
        console.error('Error in _check.get:', err);
        return callback(500, {
            error: 'There was a problem on the server side.',
        });
    }
};


handler._check.put = async (requestProperties, callback) => {

    const id = requestProperties.body.checks[0]._id;
    const group = requestProperties.body.checks[0].group;
    const protocol = requestProperties.body.checks[0].protocol;
    const url = requestProperties.body.checks[0].url;
    const method = requestProperties.body.checks[0].method;
    const successCodes = requestProperties.body.checks[0].successCodes;
    const port = requestProperties.body.checks[0].port;
    const dnsRecordType = requestProperties.body.checks[0].dnsRecordType;
    const expectedDnsValue = requestProperties.body.checks[0].expectedDnsValue;
    const timeoutSeconds = requestProperties.body.checks[0].timeoutSeconds;
    const isActive = requestProperties.body.checks[0].isActive || false;
    const serviceName = requestProperties.body.checks[0].serviceName;

    if (id && (protocol || url || method || successCodes || timeoutSeconds || isActive || serviceName || group || port || dnsRecordType || expectedDnsValue)) {

        const checkData = await Check.find({ _id: id });

        if (!checkData || checkData?.length === 0) {
            return callback(404, {
                error: `Could not find check with id ${id}.`,
            });
        }

        let checkObject = checkData?.[0];

        // sanity check of token
        const token = typeof (requestProperties.headersObject.token) === 'string'
            ? requestProperties.headersObject.token : false;

        if (!token) {
            return callback(403, { error: 'Authentication Failed.' });
        }

        // verify the token
        tokenHandler._token.verify(token, checkObject.userId, (tokenIsValid) => {
            if (tokenIsValid) {
                // Update the check object
                if (group) {
                    checkObject.group = group
                }
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
                if (typeof port === 'number') {
                    checkObject.port = port
                }
                if (dnsRecordType) {
                    checkObject.dnsRecordType = dnsRecordType
                }
                if (expectedDnsValue !== undefined) {
                    checkObject.expectedDnsValue = expectedDnsValue
                }
                if (serviceName) {
                    checkObject.serviceName = serviceName
                }
                checkObject.isActive = isActive;

                Check.updateOne({ _id: id }, {
                    $set: checkObject
                }).then((response) => {
                    callback(200, {
                        checks: [checkObject]
                    });
                }).catch(err => {
                    callback(500, {
                        error: err,
                    });
                })
            } else {
                return callback(403, {
                    error: 'Authentication failed.',
                });
            }
        })
    } else {
        callback(400, {
            error: 'You have a problem in your request',
        });
    }

}

handler._check.delete = async (requestProperties, callback) => {

    const id = typeof requestProperties.queryStringObject.id === 'string'
        ? requestProperties.queryStringObject.id : false;

    if (id) {
        // sanity check of token
        const token = typeof (requestProperties.headersObject.token) === 'string'
            ? requestProperties.headersObject.token : false;

        if (!token) {
            return callback(403, { error: 'Authentication Failed.' });
        }

        const checkData = await Check.find({ _id: id });
        let checkObject = checkData?.[0];

        if (!checkData || checkData?.length === 0) {
            return callback(404, {
                error: `Could not find check with id ${id}.`,
            });
        }

        tokenHandler._token.verify(token, checkObject.userId, async (tokenIsValid) => {
            if (tokenIsValid) {

                const deletedData = await Check.deleteOne({ _id: id });
                if (!deletedData || deletedData?.length === 0) {
                    return callback(500, {
                        error: `There was a server side error to delete check`,
                    });
                }

                const userData = await User.find({ userId: checkObject.userId });
                if (!userData || userData?.length === 0) {
                    return callback(500, {
                        error: `There was a server side error to get user data`,
                    });
                }

                let userObject = userData?.[0];
                let updatedChecks = userObject?.checks?.filter(check => check !== id);
                userObject.checks = updatedChecks;

                const updatedUserData = await User.updateOne({ userId: userObject.userId }, {
                    $set: userObject
                })
                if (!updatedUserData || updatedUserData?.length === 0) {
                    return callback(500, {
                        error: `There was a server side error to update user`,
                    });
                }

                return callback(200);

            } else {
                callback(403, {
                    error: 'Authentication failed.',
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