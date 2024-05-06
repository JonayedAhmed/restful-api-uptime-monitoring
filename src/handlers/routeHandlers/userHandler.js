/**
 * Title: User Handler
 * Description: Route Handler to handle user related routes
 * Author: Jonayed Ahmed Riduan
 * Date: 01/12/2024
 */

// dependencies
const mongoose = require('mongoose');
const { hash, parseJSON } = require('../../helpers/utilities');
const tokenHandler = require('./tokenHandler');
const userSchema = require('../../schemas/userSchema');

// Creating a model based on userSchema
// Model for object mapping (ODM)
const User = new mongoose.model("User", userSchema);


// module scaffolding
const handler = {};

handler.userHandler = (requestProperties, callback) => {

    const acceptedMethods = ['get', 'post', 'put', 'delete'];
    if (acceptedMethods?.includes(requestProperties?.method)) {
        handler._users[requestProperties.method](requestProperties, callback);
    } else {
        callback(405);
    }
}

handler._users = {};

handler._users.post = async (requestProperties, callback) => {

    // Check user table data count for generating userId
    User.countDocuments({}).then(count => {

        // Prepare document to store in user collection
        const userObject = {
            userId: `${1000 + count + 1}`,
            firstName: requestProperties.body.firstName,
            lastName: requestProperties.body.lastName,
            phone: requestProperties.body.phone,
            email: requestProperties.body.email,
            password: hash(requestProperties.body.password),
            tosAgreement: requestProperties.body.tosAgreement,
        }

        // Create new user
        const newUser = new User(userObject);
        newUser.save().then(() => {
            callback(200, {
                message: 'User created successfully.',
            });
        }).catch(err => {
            callback(400, {
                error: 'Bad Request, You have a problem in your request.',
            });
        })
    }).catch(err => {
        console.log(err);
    })

};


handler._users.get = (requestProperties, callback) => {

    try {
        const userId = typeof requestProperties.queryStringObject.userId === 'string' && requestProperties.queryStringObject.userId.trim().length > 0
            ? requestProperties.queryStringObject.userId : false;

        const token = typeof (requestProperties.headersObject.token) === 'string'
            ? requestProperties.headersObject.token : false;

        if (userId && token) {
            // Verify the token
            tokenHandler._token.verify(token, userId, async (tokenIsValid) => {
                if (tokenIsValid) {

                    // { password: 0 } can be replaced by .select({password: 0})
                    User.find({ userId: requestProperties.queryStringObject.userId }, { password: 0 }).then(response => {
                        // response returns list of users that matches userId
                        callback(200, response?.[0]);
                    }).catch(err => {

                        callback(500, {
                            error: 'There was a server side error to get user data.',
                        });
                    })

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
        console.error('Error in _users.get:', err);
        return callback(500, {
            error: 'There was a problem on the server side.',
        });
    }

}


handler._users.put = (requestProperties, callback) => {

    const userId = typeof requestProperties.body.userId === 'string' && requestProperties.body.userId.trim().length > 0
        ? requestProperties.body.userId : false;

    const token = typeof (requestProperties.headersObject.token) === 'string'
        ? requestProperties.headersObject.token : false;

    if (userId && token) {
        // Verify the token
        tokenHandler._token.verify(token, userId, async (tokenIsValid) => {
            if (tokenIsValid) {

                User.find({ userId: requestProperties.body.userId }).then(response => {

                    if (requestProperties.body.password) {
                        let userGivenCurrentPassword = hash(requestProperties.body.currentPassword);
                        if (userGivenCurrentPassword !== response?.[0]?.password) {
                            return callback(400, {
                                error: 'Please enter correct current password.',
                            });
                        }
                    }

                    // response returns list of users that matches userId
                    let updatedUserData = response?.[0]

                    if (requestProperties?.body?.firstName) {
                        updatedUserData.firstName = requestProperties?.body?.firstName
                    }
                    if (requestProperties?.body?.lastName) {
                        updatedUserData.lastName = requestProperties?.body?.lastName
                    }
                    if (requestProperties?.body?.email) {
                        updatedUserData.email = requestProperties?.body?.email
                    }
                    if(requestProperties?.body?.additionalEmails){
                        updatedUserData.additionalEmails = requestProperties?.body?.additionalEmails
                    }
                    if (requestProperties?.body?.phone) {
                        updatedUserData.phone = requestProperties?.body?.phone
                    }
                    if (requestProperties?.body?.phone) {
                        updatedUserData.profilePicture = requestProperties?.body?.profilePicture
                    }
                    if (requestProperties.body.password) {
                        updatedUserData.password = hash(requestProperties.body.password)
                    }


                    User.updateOne({ userId: requestProperties.body.userId }, {
                        $set: { ...updatedUserData }
                    }).then(() => {
                        callback(200, {
                            message: 'User updated successfully.',
                        });
                    }).catch(err => {
                        callback(500, {
                            error: err,
                        });
                    })

                }).catch(err => {

                    callback(500, {
                        error: 'There was a server side error to get user data.',
                    });
                })

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
}


handler._users.delete = (requestProperties, callback) => {

    const userId = typeof requestProperties.queryStringObject.userId === 'string' && requestProperties.queryStringObject.userId.trim().length > 0
        ? requestProperties.queryStringObject.userId : false;

    const token = typeof (requestProperties.headersObject.token) === 'string'
        ? requestProperties.headersObject.token : false;

    if (userId && token) {
        // Verify the token
        tokenHandler._token.verify(token, userId, async (tokenIsValid) => {
            if (tokenIsValid) {

                User.deleteOne({ userId: requestProperties.queryStringObject.userId }, { password: 0 }).then(response => {
                    // response returns list of users that matches userId
                    callback(200, {
                        message: 'User deleted successfully.',
                    });
                }).catch(err => {

                    callback(500, {
                        error: 'There was a server side error to get user data.',
                    });
                })

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
}

module.exports = handler;