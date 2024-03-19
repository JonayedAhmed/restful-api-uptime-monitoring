/**
 * Title: Sample Handler
 * Description: Sample Handler
 * Author: Jonayed Ahmed Riduan
 * Date: 01/10/2024
 */

// module scaffolding
const handler = {};

handler.sampleHandler = (requestProperties, callback) => {
    console.log(requestProperties);
    
    callback(200, {
        message: 'this is a sample url.'
    })
}

module.exports = handler;