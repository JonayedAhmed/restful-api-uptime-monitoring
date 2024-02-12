/**
 * Title: worker file.
 * Description: Worker related files.
 * Author: Jonayed Ahmed Riduan
 * Date: 01/16/2024
 */


// dependencies
const mongoose = require('mongoose');
const url = require('url');
const http = require('http');
const https = require('https');
const { parseJSON } = require('../helpers/utilities');
const data = require('./data');
const userSchema = require('../schemas/userSchema');
const checkSchema = require('../schemas/checkSchema');

// Creating a model based on userSchema
// Model for object mapping (ODM)
const User = new mongoose.model("User", userSchema);
const Check = new mongoose.model("Check", checkSchema);

// worker object - module scaffolding
const worker = {};


// perform check
worker.performCheck = (checkData) => {

    // prepare the initial check outcome
    let checkOutCome = {
        error: false,
        responseCode: false
    };
    // mark the outcome has not been set yet
    let outcomeSent = false;

    // parse the hostname and full url from original data
    const parsedUrl = url.parse(checkData.protocol + '://' + checkData.url, true);
    const hostname = parsedUrl.hostname;
    const path = parsedUrl.path;

    // construct the request
    const requestDetails = {
        protocol: checkData.protocol + ':',
        hostname: hostname,
        method: checkData.method.toUpperCase(),
        path: path,
        timeout: checkData.timeoutSeconds * 1000 //taking it in ms
    }

    const protocolToUse = checkData.protocol === 'http' ? http : https;

    let req = protocolToUse.request(requestDetails, (res) => {
        // grab the status of the response 
        const status = res.statusCode;

        // update the check outcome and pass to the next process.
        checkOutCome.responseCode = status;

        if (!outcomeSent) {
            worker.processCheckOutcome(checkData, checkOutCome);
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
            worker.processCheckOutcome(checkData, checkOutCome);
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
            worker.processCheckOutcome(checkData, checkOutCome);
            outcomeSent = true;
        }
    })

    // req send
    req.end();
}

// save check outcome to database and send to next process
worker.processCheckOutcome = async (checkData, checkOutCome) => {
    // check if check outcome is up or down
    let state = !checkOutCome.error && checkOutCome.responseCode && checkData.successCodes.includes(checkOutCome.responseCode)
        ? 'up' : 'down';

    // decide we should alert the user or not
    // checkData.lastChecked is required as initial state we considered that as down but first time it may go to up, whether its first time or not is checked by checkData.lastChecked
    let alertRequired = checkData.lastChecked && checkData.state !== state ? true : false

    // update the check data
    let newCheckData = checkData;
    newCheckData.state = state;
    newCheckData.lastChecked = Date.now();


    Check.updateOne({ _id: newCheckData._id }, {
        $set: newCheckData
    }).then((response) => {
        if (alertRequired) {
            console.log(`Alert is needed as there is state change for ${checkData.url}.`);
            worker.alertUserToStatusChange(newCheckData);
        } else {
            console.log(`Alert is not needed as there is no state change for ${checkData.url}.`)
        }
    }).catch(err => {
        console.log('Error: failed to update check data state and lastChecked.')
    })

}

// validate individual check data
worker.validateCheckData = (checkData) => {
    if (checkData && checkData._id) {
        // assigning state and last checked in checks if first time checked else checking state and last checked time
        checkData.state = typeof (checkData.state) === 'string' && ['up', 'down'].includes(checkData.state)
            ? checkData.state : 'down';

        checkData.lastChecked = typeof (checkData.lastChecked) === 'number' && checkData.lastChecked > 0
            ? checkData.lastChecked : false;

        // pass to the next process
        worker.performCheck(checkData);
    } else {
        console.log('Error: Could not process check as the was not properly formatted.')
    }
}

// send notification sms / email to user if state changes
worker.alertUserToStatusChange = (newCheckData) => {
    // TODO: WILL COMPLETE THIS SECTION LATER ON
}

// lookup all the checks 
worker.gatherAllChecks = async () => {

    // Get all the checks
    const checks = await Check.find({});

    if (typeof (checks) === 'object' && Array.isArray(checks) && checks?.length > 0) {
        checks.forEach(checkData => {
            // pass the data to the next process.
            worker.validateCheckData(checkData);
        });
    } else {
        console.log('Could not find any checks to process.');
    }
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
