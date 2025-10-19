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
const userSchema = require('../schemas/userSchema');
const checkSchema = require('../schemas/checkSchema');
const healthSchema = require('../schemas/healthSchema');
const nodemailer = require('nodemailer');

// Creating a model based on userSchema
// Model for object mapping (ODM)
const User = new mongoose.model("User", userSchema);
const Check = new mongoose.model("Check", checkSchema);
const HealthLog = new mongoose.model("HealthLog", healthSchema);

// worker object - module scaffolding
const worker = {};


// Create a transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'alerts.sys.monitor@gmail.com',
        pass: 'bqzy sefd mdsm wlgq' // Use your app password here
    }
});


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
    const port = parsedUrl.port;

    // record the start time before sending the request
    const startTime = Date.now();

    // construct the request
    const requestDetails = {
        protocol: checkData.protocol + ':',
        hostname: hostname,
        method: checkData.method.toUpperCase(),
        path: path,
        port: port,
        timeout: checkData.timeoutSeconds * 1000 //taking it in ms
    }

    const protocolToUse = checkData.protocol === 'http' ? http : https;

    let req = protocolToUse.request(requestDetails, (res) => {
        // grab the status of the response 
        const status = res.statusCode;

        // calculate the response time
        const responseTime = Date.now() - startTime;

        // update the check outcome and pass to the next process.
        checkOutCome.responseCode = status;
        checkOutCome.responseTime = responseTime;

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
        ? 'UP' : 'DOWN';

    let responseTime = typeof (checkOutCome.responseTime) === 'number' && checkOutCome.responseTime > 0 ? checkOutCome.responseTime : 0

    // decide we should alert the user or not
    // checkData.lastChecked is required as initial state we considered that as down but first time it may go to up, whether its first time or not is checked by checkData.lastChecked
    let alertRequired = checkData.lastChecked && checkData.state !== state ? true : false

    // update the check data
    let newCheckData = checkData;
    newCheckData.state = state;
    newCheckData.lastChecked = Date.now();
    newCheckData.responseTime = responseTime;


    Check.updateOne({ _id: newCheckData._id }, {
        $set: newCheckData
    }).then((response) => {
        // store health log
        try {
            const log = new HealthLog({
                checkId: newCheckData._id,
                timestamp: new Date(newCheckData.lastChecked),
                state,
                responseTime,
                statusCode: checkOutCome.responseCode || 0,
                error: checkOutCome.error ? String(checkOutCome.value || 'UNKNOWN') : null,
                isAlertTriggered: !!alertRequired
            });
            log.save().catch(() => { });
        } catch (_) { }

        if (alertRequired) {
            console.log(`Alert is needed as there is state change for ${checkData.url}.`);
            worker.alertUserToStatusChange(newCheckData, state);
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
        checkData.state = typeof (checkData.state) === 'string' && ['UP', 'DOWN'].includes(checkData.state)
            ? checkData.state : 'DOWN';

        checkData.lastChecked = typeof (checkData.lastChecked) === 'number' && checkData.lastChecked > 0
            ? checkData.lastChecked : false;

        // pass to the next process
        worker.performCheck(checkData);
    } else {
        console.log('Error: Could not process check as the was not properly formatted.')
    }
}

// send notification sms / email to user if state changes
worker.alertUserToStatusChange = async (newCheckData, state) => {

    const userInfo = await User.find({ userId: newCheckData.userId }, { email: 1, additionalEmails: 1 });

    if (userInfo && userInfo.length > 0) {
        const userEmail = userInfo?.[0]?.email;

        const mailOptions = {
            from: 'alerts.sys.monitor@gmail.com',
            to: userEmail,
            subject: 'Service Status Alert',
            html: `
                <html>
                    <head>
                        <style>
                            body {
                                font-family: Arial, sans-serif;
                                margin: 0;
                                padding: 0;
                            }
                            .container {
                                background-color: ${state === 'UP' ? '#00FF00' : '#FF0000'};
                                padding: 20px;
                                border-radius: 5px;
                            }
                            .message {
                                color: #FFFFFF;
                                font-size: 18px;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="message">
                                The service ${newCheckData.protocol}://${newCheckData.url} is ${state.toLowerCase()}.
                            </div>
                        </div>
                    </body>
                </html>
            `
        }

        // Keep additional emails in cc if this user have additional emails.
        if (userInfo?.[0]?.additionalEmails?.length > 0) {
            mailOptions.cc = userInfo?.[0]?.additionalEmails?.join(',')
        }

        // Send email
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log('Error sending email:', error);
            } else {
                console.log('Email sent:', info.response);
            }
        });
    } else {
        console.log('Failed to get user info to send email.')
    }
}

// lookup all the checks 
worker.gatherAllChecks = async () => {

    // Get all the checks
    const checks = await Check.find({ isActive: true });

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
