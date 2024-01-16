/**
 * Title: worker file.
 * Description: Worker related files.
 * Author: Jonayed Ahmed Riduan
 * Date: 01/16/2024
 */


// dependencies
const url = require('url');
const http = require('http');
const https = require('https');
const { parseJSON } = require('../helpers/utilities');
const data = require('./data');

// worker object - module scaffolding
const worker = {};


// perform check
worker.performCheck = (originalCheckData) => {

    // prepare the initial check outcome
    let checkOutCome = {
        error: false,
        responseCode: false
    };
    // mark the outcome has not been set yet
    let outcomeSent = false;

    // parse the hostname and full url from original data
    const parsedUrl = url.parse(originalCheckData.protocol + '://' + originalCheckData.url, true);
    const hostname = parsedUrl.hostname;
    const path = parsedUrl.path;

    // construct the request
    const requestDetails = {
        protocol: originalCheckData.protocol + ':',
        hostname: hostname,
        method: originalCheckData.method.toUpperCase(),
        path: path,
        timeout: originalCheckData.timeoutSeconds * 1000 //taking it in ms
    }

    const protocolToUse = originalCheckData.protocol === 'http' ? http : https;

    let req = protocolToUse.request(requestDetails, (res) => {
        // grab the status of the response 
        const status = res.statusCode;

        // update the check outcome and pass to the next process.
        checkOutCome.responseCode = status;

        if (!outcomeSent) {
            worker.processCheckOutcome(originalCheckData, checkOutCome);
            outcomeSent = true;
        }
    });

    req.on('error', (e) => {
        checkOutCome = {
            error: true,
            value: e
        };

        // update the check outcome and pass to the next process.
        if (!outcomeSent) {
            worker.processCheckOutcome(originalCheckData, checkOutCome);
            outcomeSent = true;
        }
    });

    req.on('timeout', (e) => {
        checkOutCome = {
            error: true,
            value: 'timeout'
        };

        // update the check outcome and pass to the next process.
        if (!outcomeSent) {
            worker.processCheckOutcome(originalCheckData, checkOutCome);
            outcomeSent = true;
        }
    })

    // req send
    req.end();
}

// save check outcome to database and send to next process
worker.processCheckOutcome = (originalCheckData, checkOutCome) => {
    // check if check outcome is up or down
    let state = !checkOutCome.error && checkOutCome.responseCode && originalCheckData.successCodes.includes(checkOutCome.responseCode)
        ? 'up' : 'down';

    // decide we should alert the user or not
    // originalCheckData.lastChecked is required as initial state we considered that as down but first time it may go to up, whether its first time or not is checked by originalCheckData.lastChecked
    let alertRequired = originalCheckData.lastChecked && originalCheckData.state !== state ? true : false

    // update the check data
    let newCheckData = originalCheckData;
    newCheckData.state = state;
    newCheckData.lastChecked = Date.now();

    // update the check to disk
    data.update('checks', newCheckData.id, newCheckData, (err) => {
        if (!err) {
            // send data to next process
            if (alertRequired) {
                console.log(`Alert is needed as there is state change for ${originalCheckData.url}.`)
                worker.alertUserToStatusChange(newCheckData);
            } else {
                console.log(`Alert is not needed as there is no state change for ${originalCheckData.url}.`)
            }
        } else {
            console.log('Error: failed to update check data state and lastChecked.')
        }
    })
}

// validate individual check data
worker.validateCheckData = (originalCheckData) => {
    const originalData = originalCheckData;
    if (originalData && originalData.id) {

        // assigning state and last checked in checks if first time checked else checking state and last checked time
        originalData.state = typeof (originalData.state) === 'string' && ['up', 'down'].includes(originalData.state)
            ? originalData.state : 'down';

        originalData.lastChecked = typeof (originalData.lastChecked) === 'number' && originalData.lastChecked > 0
            ? originalData.lastChecked : false;

        // pass to the next process
        worker.performCheck(originalData);
    } else {
        console.log('Error: Could not process check as the was not properly formatted.')
    }
}

// send notification sms / email to user if state changes
worker.alertUserToStatusChange = (newCheckData) => {
    // TODO: WILL COMPLETE THIS SECTION LATER ON
}

// lookup all the checks 
worker.gatherAllChecks = () => {
    // get all the checks
    data.list("checks", (err1, checks) => {
        if (!err1 && checks && checks.length > 0) {
            checks.forEach(check => {
                // read the check data
                data.read("checks", check, (err2, originalCheckData) => {
                    if (!err2 && originalCheckData) {
                        // pass the data to the next process.
                        worker.validateCheckData(parseJSON(originalCheckData));
                    } else {
                        console.log('Error reading one of the checks data.')
                    }
                })
            });
        } else {
            console.log('Error: Could not find any checks to process.');
        }
    });
}

// timer to execute the execute process once per minute
worker.loop = () => {
    setInterval(() => {
        worker.gatherAllChecks();
    }, 1000 * 60)
}

// start the worker
worker.init = () => {

    console.log('Initializing server workers . . .');

    // execute all the checks
    worker.gatherAllChecks();

    // call the loop so that checks continue
    worker.loop();
}

// export 
module.exports = worker;
