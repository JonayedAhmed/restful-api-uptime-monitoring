/**
 * Title: Utilities
 * Description: Handle Utilities
 * Author: Jonayed Ahmed Riduan
 * Date: 12/01/2024
 */

// dependencies 
const crypto = require('crypto');
const environments = require('./environments');

// module scaffolding
const utilities = {};

// Parse JSON string to Object
utilities.parseJSON = (jsonString) => {
    let output;

    try {
        output = JSON.parse(jsonString);
    } catch {
        output = {};
    }
    return output;
}

// Hash String
utilities.hash = (str) => {
    if (typeof (str) === 'string' && str.length > 0) {
        let hash = crypto.createHmac('sha256', environments.secretKey).update(str).digest('hex');
        return hash;
    } else {
        return false;
    }
}

module.exports = utilities;