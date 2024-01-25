/**
 * Title: Token Handler
 * Description: Route Handler to handle token related routes
 * Author: Jonayed Ahmed Riduan
 * Date: 01/15/2024
 */

// dependencies
const mongoose = require('mongoose');
const data = require('../../lib/data');
const { hash, parseJSON, createRandomString } = require('../../helpers/utilities');
const tokenSchema = require('../../schemas/tokenSchema');
const userSchema = require('../../schemas/userSchema');

// Creating a model based on userSchema and tokenSchema
// Model for object mapping (ODM)
const User = new mongoose.model("User", userSchema);
const Token = new mongoose.model("Token", tokenSchema);


// module scaffolding
const handler = {};

handler.tokenHandler = (requestProperties, callback) => {

    const acceptedMethods = ['get', 'post', 'put', 'delete'];
    if (acceptedMethods?.includes(requestProperties?.method)) {
        handler._token[requestProperties.method](requestProperties, callback);
    } else {
        callback(405);
    }
}

handler._token = {};

handler._token.post = (requestProperties, callback) => {


    // Sanity checking
    const userId = typeof requestProperties.body.userId === 'string' && requestProperties.body.userId.trim().length > 0
        ? requestProperties.body.userId : false;

    const password = typeof requestProperties.body.password === 'string' && requestProperties.body.password.trim().length > 0
        ? requestProperties.body.password : false;


    if (userId && password) {

        // Lookup the user
        User.find({ userId: userId }).then(response => {

            if (response?.length > 0 && response?.[0]?.password === hash(password)) {

                const tokenObject = {
                    userId: userId,
                    token: createRandomString(20),
                    expires: Date.now() + 60 * 60 * 24 * 1000
                }

                // Create new token
                const newToken = new Token(tokenObject);
                newToken.save().then(() => {
                    callback(200, {
                        data: { ...tokenObject },
                    });
                }).catch(err => {
                    callback(500, {
                        error: 'There was a server side error.',
                    });
                })
            } else {
                callback(404, {
                    error: 'User id or password is incorrect.',
                });
            }
        }).catch(err => {

            callback(500, {
                error: 'There was a server side error to get user data.',
            });
        })
    } else {
        callback(400, {
            error: 'Bad Request.',
        });
    }
};

handler._token.get = (requestProperties, callback) => {
    // check the id is valid.
    const id = typeof requestProperties.queryStringObject.id === 'string' && requestProperties.queryStringObject.id.trim().length === 20
        ? requestProperties.queryStringObject.id : false;

    if (id) {

        // lookup the token
        Token.find({ token: id }).then(response => {

            if (response?.length > 0) {
                callback(200, {
                    data: response?.[0],
                });
            } else {
                callback(404, {
                    error: 'Requested token was not found.',
                });
            }
        }).catch(err => {

            callback(500, {
                error: 'There was a server side error.',
            });
        })
    } else {
        callback(404, {
            error: 'Requested token was not found.',
        });
    }
}

handler._token.put = (requestProperties, callback) => {
    const id = typeof requestProperties.body.id === 'string' && requestProperties.body.id.trim().length === 20
        ? requestProperties.body.id : false;

    const extend = typeof requestProperties.body.extend === 'boolean' && requestProperties.body.extend === true
        ? true : false;

    if (id && extend) {

        // lookup the token
        Token.find({ token: id }).then(response => {

            if (response?.length > 0) {
                let tokenObject = response?.[0]

                if (tokenObject.expires > Date.now()) {

                    tokenObject.expires = Date.now() + 60 * 60 * 24 * 1000;

                    // store the updated token
                    Token.updateOne({ token: id }, {
                        $set: { ...tokenObject }
                    }).then(() => {
                        callback(200, {
                            data: 'Token Updated.',
                        });
                    }).catch(err => {
                        callback(500, {
                            error: 'There was a server side error.',
                        });
                    })

                } else {
                    callback(400, {
                        error: 'Token already expired.',
                    });
                }
            } else {
                callback(404, {
                    error: 'Requested token was not found.',
                });
            }
        }).catch(err => {

            callback(500, {
                error: 'There was a server side error.',
            });
        })

    } else {
        callback(400, {
            error: 'There was a problem in your request.',
        });
    }
}

handler._token.delete = (requestProperties, callback) => {
    const id = typeof requestProperties.queryStringObject.id === 'string' && requestProperties.queryStringObject.id.trim().length === 20
        ? requestProperties.queryStringObject.id : false;

    if (id) {

        Token.deleteOne({ token: id }).then(() => {
            callback(200, {
                data: 'Token Deleted.',
            });
        }).catch(err => {
            callback(500, {
                error: 'There was a server side error.',
            });
        })
    } else {
        callback(400, {
            error: 'There was a problem in your request.'
        });
    }
}

// This is a general purpose function, not called from API
handler._token.verify = (id, userId, callback) => {

    Token.find({ token: id }).then(response => {

        if (response?.length > 0) {

            if (response?.[0]?.userId === userId && response?.[0]?.expires > Date.now()) {
                callback(true);
            } else {
                callback(false);
            }

        } else {
            callback(404, {
                error: 'Requested token was not found.',
            });
        }
    }).catch(err => {

        callback(500, {
            error: 'There was a server side error.',
        });
    })
}

module.exports = handler;