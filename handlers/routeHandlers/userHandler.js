/**
 * Title: User Handler
 * Description: Route Handler to handle user related routes
 * Author: Jonayed Ahmed Riduan
 * Date: 01/12/2024
 */

// dependencies
const mongoose = require('mongoose');
const data = require('../../lib/data');
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

    // { password: 0 } can be replaced by .select({password: 0})
    User.find({ userId: requestProperties.queryStringObject.userId }, { password: 0 }).then(response => {
        // response returns list of users that matches userId
        callback(200, response?.[0]);
    }).catch(err => {

        callback(500, {
            error: 'There was a server side error to get user data.',
        });
    })

    // check the phone number is valid.
    // const phone = typeof requestProperties.queryStringObject.phone === 'string' && requestProperties.queryStringObject.phone.trim().length === 11
    //     ? requestProperties.queryStringObject.phone : false;

    // if (phone) {

    //     // verify the token
    //     let token = typeof (requestProperties.headersObject.token) === 'string'
    //         ? requestProperties.headersObject.token : false;

    //     tokenHandler._token.verify(token, phone, (tokenIsValid) => {
    //         if (tokenIsValid) {
    //             // look up the user
    //             data.read('users', phone, (err, receivedUserData) => {
    //                 if (!err && receivedUserData) {
    //                     let user = { ...parseJSON(receivedUserData) };
    //                     delete user.password;
    //                     callback(200, user);
    //                 } else {
    //                     callback(404, {
    //                         error: 'Requested user not found!'
    //                     });
    //                 }
    //             })
    //         } else {
    //             callback(403, {
    //                 error: 'Authentication failed.'
    //             });
    //         }
    //     });

    // } else {
    //     callback(404, {
    //         error: 'Requested user not found!'
    //     });
    // }
}

handler._users.put = (requestProperties, callback) => {

    console.log(requestProperties);

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



    // const firstName = typeof requestProperties.body.firstName === 'string' && requestProperties.body.firstName.trim().length > 0
    //     ? requestProperties.body.firstName : false;

    // const lastName = typeof requestProperties.body.lastName === 'string' && requestProperties.body.lastName.trim().length > 0
    //     ? requestProperties.body.lastName : false;

    // const phone = typeof requestProperties.body.phone === 'string' && requestProperties.body.phone.trim().length === 11
    //     ? requestProperties.body.phone : false;

    // const password = typeof requestProperties.body.password === 'string' && requestProperties.body.password.trim().length > 0
    //     ? requestProperties.body.password : false;

    // if (phone) {
    //     if (firstName || lastName || password) {

    //         // verify the token
    //         let token = typeof (requestProperties.headersObject.token) === 'string'
    //             ? requestProperties.headersObject.token : false;

    //         tokenHandler._token.verify(token, phone, (tokenIsValid) => {
    //             if (tokenIsValid) {
    //                 // lookup the user
    //                 data.read('users', phone, (err, receivedUserData) => {

    //                     const userData = { ...parseJSON(receivedUserData) };
    //                     if (!err && userData) {
    //                         if (firstName) {
    //                             userData.firstName = firstName;
    //                         }
    //                         if (lastName) {
    //                             userData.lastName = lastName;
    //                         }
    //                         if (password) {
    //                             userData.password = hash(password);
    //                         }

    //                         // update to database
    //                         data.update('users', phone, userData, (err1) => {
    //                             if (!err1) {
    //                                 callback(200, {
    //                                     message: 'User updated successfully.'
    //                                 });
    //                             } else {
    //                                 callback(500, {
    //                                     error: 'There was a problem in the server side.'
    //                                 });
    //                             }
    //                         })
    //                     } else {
    //                         callback(400, {
    //                             error: 'Invalid Phone number. Please try again!'
    //                         });
    //                     }
    //                 });
    //             } else {
    //                 callback(403, {
    //                     error: 'Authentication failed.'
    //                 });
    //             }
    //         });

    //     } else {
    //         callback(400, {
    //             error: 'You have a problem in your request.'
    //         });
    //     }
    // } else {
    //     callback(400, {
    //         error: 'Invalid Phone number. Please try again!'
    //     });
    // }


}

handler._users.delete = (requestProperties, callback) => {

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

    // const phone = typeof requestProperties.queryStringObject.phone === 'string' && requestProperties.queryStringObject.phone.trim().length === 11
    //     ? requestProperties.queryStringObject.phone : false;

    // if (phone) {

    //     // verify the token
    //     let token = typeof (requestProperties.headersObject.token) === 'string'
    //         ? requestProperties.headersObject.token : false;

    //     tokenHandler._token.verify(token, phone, (tokenIsValid) => {
    //         if (tokenIsValid) {
    //             // lookup the user
    //             data.read('users', phone, (err, userData) => {
    //                 if (!err && userData) {
    //                     data.delete('users', phone, (err1) => {
    //                         if (!err1) {
    //                             callback(200, {
    //                                 message: 'User successfully deleted.'
    //                             })
    //                         } else {
    //                             callback(500, {
    //                                 error: 'There was a server side error.'
    //                             });
    //                         }
    //                     })
    //                 } else {
    //                     callback(500, {
    //                         error: 'There was a server side error.'
    //                     });
    //                 }
    //             })
    //         } else {
    //             callback(403, {
    //                 error: 'Authentication failed.'
    //             });
    //         }
    //     });
    // } else {
    //     callback(400, {
    //         error: 'There was a problem in your request.'
    //     });
    // }
}

module.exports = handler;