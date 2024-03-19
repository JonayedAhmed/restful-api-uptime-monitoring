/**
 * Title: Not Found Handler
 * Description: Not Found Handler
 * Author: Jonayed Ahmed Riduan
 * Date: 01/10/2024
 */

// module scaffolding
const handler = {};

handler.notFoundHandler = (requestProperties, callback) => {
    console.log('not found');

    callback(404, {
        message: 'Your Requested URL was not found!'
    })
}

module.exports = handler;