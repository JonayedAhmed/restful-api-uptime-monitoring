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
const settingsSchema = require('../schemas/settingsSchema');
const nodemailer = require('nodemailer');
const net = require('net');
const dns = require('dns').promises;
let ping;
try { ping = require('ping'); } catch (_) { ping = null; }

// Creating a model based on userSchema
// Model for object mapping (ODM)
const User = new mongoose.model("User", userSchema);
const Check = new mongoose.model("Check", checkSchema);
const HealthLog = new mongoose.model("HealthLog", healthSchema);
const Settings = new mongoose.model("Settings", settingsSchema);

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


// ensure TTL index for HealthLog.timestamp according to per-user settings
worker.ensureTTLIndex = async (userId) => {
    try {
        const s = await Settings.findOne({ userId });
        const ttlHours = s?.ttlHours || 24;
        const expireAfterSeconds = Math.max(3600, Math.floor(ttlHours * 3600));
        const indexes = await HealthLog.collection.indexes();
        const ttlName = 'ttl_timestamp';
        const hasTTL = indexes.some(ix => ix.name === ttlName);
        if (hasTTL) {
            await HealthLog.collection.dropIndex(ttlName).catch(() => { });
        }
        await HealthLog.collection.createIndex({ timestamp: 1 }, { expireAfterSeconds, name: ttlName });
    } catch (e) {
        console.log('TTL index ensure error:', e?.message || e);
    }
}

// performCheck: dispatch by protocol and emit a normalized outcome
worker.performCheck = async (checkData) => {

    // prepare the initial check outcome
    let checkOutcome = {
        error: false,
        responseCode: false
    };
    // mark the outcome has not been set yet
    let outcomeSent = false;

    // parse the hostname and full url from original data
    const parsedUrl = url.parse(checkData.protocol + '://' + checkData.url, true);
    const hostname = parsedUrl.hostname || checkData.url; // for non-http, url may be just hostname
    const path = parsedUrl.path;
    const parsedPort = parsedUrl.port;

    // record the start time before sending the request
    const startTime = Date.now();

    if (checkData.protocol === 'http' || checkData.protocol === 'https') {
        // construct the request
        const requestDetails = {
            protocol: checkData.protocol + ':',
            hostname: hostname,
            method: (checkData.method || 'GET').toUpperCase(),
            path: path,
            port: parsedPort,
            timeout: checkData.timeoutSeconds * 1000 //taking it in ms
        }

        const protocolToUse = checkData.protocol === 'http' ? http : https;

        let req = protocolToUse.request(requestDetails, (res) => {
            // grab the status of the response 
            const status = res.statusCode;

            // calculate the response time
            const responseTime = Date.now() - startTime;

            // update the check outcome and pass to the next process.
            checkOutcome.responseCode = status;
            checkOutcome.responseTime = responseTime;

            if (!outcomeSent) {
                worker.processCheckOutcome(checkData, checkOutcome);
                outcomeSent = true;
            }
        });

        req.on('error', (e) => {
            checkOutcome = {
                error: true,
                value: e
            };

            // update the check outcome and pass to the next process.
            if (!outcomeSent) {
                worker.processCheckOutcome(checkData, checkOutcome);
                outcomeSent = true;
            }
        });

        req.on('timeout', (e) => {
            checkOutcome = {
                error: true,
                value: 'timeout'
            };

            // update the check outcome and pass to the next process.
            if (!outcomeSent) {
                worker.processCheckOutcome(checkData, checkOutcome);
                outcomeSent = true;
            }
        })

        // req send
        req.end();
        return;
    }

    if (checkData.protocol === 'tcp') {
        const port = checkData.port || parsedPort || 80;
        const socket = new net.Socket();
        let finished = false;
        const onDone = (err) => {
            if (finished) return;
            finished = true;
            try { socket.destroy(); } catch (_) { }
            if (err) {
                checkOutcome = { error: true, value: err.message || String(err) };
            } else {
                checkOutcome = { error: false, success: true, responseTime: Date.now() - startTime };
            }
            worker.processCheckOutcome(checkData, checkOutcome);
        };
        socket.setTimeout(checkData.timeoutSeconds * 1000, () => onDone(new Error('timeout')));
        socket.once('error', onDone);
        socket.connect(port, hostname, () => onDone());
        return;
    }

    if (checkData.protocol === 'icmp') {
        if (!ping || !ping.promise || !ping.promise.probe) {
            checkOutcome = { error: true, value: 'ICMP ping not available (missing dependency)' };
            worker.processCheckOutcome(checkData, checkOutcome);
            return;
        }
        try {
            const res = await ping.promise.probe(hostname, { timeout: checkData.timeoutSeconds });
            const responseTime = res?.time && !isNaN(Number(res.time)) ? Number(res.time) : (Date.now() - startTime);
            checkOutcome = { error: false, success: !!res.alive, responseTime };
        } catch (e) {
            checkOutcome = { error: true, value: e.message || String(e) };
        }
        worker.processCheckOutcome(checkData, checkOutcome);
        return;
    }

    if (checkData.protocol === 'dns') {
        const rrtype = checkData.dnsRecordType || 'A';
        try {
            const start = Date.now();
            const records = await dns.resolve(hostname, rrtype);
            const responseTime = Date.now() - start;
            let success = Array.isArray(records) && records.length > 0;
            if (success && checkData.expectedDnsValue) {
                const expected = String(checkData.expectedDnsValue).toLowerCase();
                // Records can be objects (e.g., MX) or strings
                success = records.some((r) => {
                    if (typeof r === 'string') return r.toLowerCase() === expected;
                    if (r && typeof r === 'object') return Object.values(r).some(v => String(v).toLowerCase() === expected);
                    return false;
                });
            }
            checkOutcome = { error: false, success, responseTime };
        } catch (e) {
            checkOutcome = { error: true, value: e.message || String(e) };
        }
        worker.processCheckOutcome(checkData, checkOutcome);
        return;
    }
}

// save check outcome to database and send to next process
// processCheckOutcome: persist result, log health, maybe alert on state change
worker.processCheckOutcome = async (checkData, checkOutcome) => {
    // check if check outcome is up or down
    let state = 'DOWN';
    if (checkData.protocol === 'http' || checkData.protocol === 'https') {
        state = !checkOutcome.error && checkOutcome.responseCode && checkData.successCodes.includes(checkOutcome.responseCode)
            ? 'UP' : 'DOWN';
    } else {
        state = !checkOutcome.error && !!checkOutcome.success ? 'UP' : 'DOWN';
    }

    let responseTime = typeof (checkOutcome.responseTime) === 'number' && checkOutcome.responseTime > 0 ? checkOutcome.responseTime : 0

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
            // ensure TTL index for current user's preference (best-effort)
            worker.ensureTTLIndex(newCheckData.userId);
            const log = new HealthLog({
                checkId: newCheckData._id,
                timestamp: new Date(newCheckData.lastChecked),
                state,
                responseTime,
                statusCode: checkOutcome.responseCode || 0,
                error: checkOutcome.error ? String(checkOutcome.value || 'UNKNOWN') : null,
                isAlertTriggered: !!alertRequired
            });
            log.save().catch(() => { });
        } catch (_) { }

        // only trigger email when transitioning INTO DOWN and avoid repeating
        if (alertRequired) {
            const now = Date.now();
            const alreadyAlertedForDown = newCheckData.lastAlertState === 'DOWN';
            const cooldownMs = 1000 * 60 * 15; // 15 minutes cooldown
            const inCooldown = typeof newCheckData.lastAlertAt === 'number' && (now - newCheckData.lastAlertAt) < cooldownMs;
            if (state === 'DOWN' && !alreadyAlertedForDown && !inCooldown) {
                worker.alertUserToStatusChange(newCheckData, state);
                // update alert bookkeeping
                newCheckData.lastAlertState = 'DOWN';
                newCheckData.lastAlertAt = now;
                Check.updateOne({ _id: newCheckData._id }, { $set: { lastAlertState: 'DOWN', lastAlertAt: now } }).catch(() => { });
            }
            if (state === 'UP' && newCheckData.lastAlertState === 'DOWN') {
                // Optional: notify recovery once, then reset alert state
                worker.alertUserToStatusChange(newCheckData, state);
                newCheckData.lastAlertState = 'UP';
                newCheckData.lastAlertAt = now;
                Check.updateOne({ _id: newCheckData._id }, { $set: { lastAlertState: 'UP', lastAlertAt: now } }).catch(() => { });
            }
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
        console.log('Error: Could not process check as the data was not properly formatted.')
    }
}

// send notification sms / email to user if state changes
worker.alertUserToStatusChange = async (newCheckData, state) => {

    const userInfo = await User.find(
        { userId: newCheckData.userId },
        { email: 1, additionalEmails: 1, firstName: 1, lastName: 1 }
    );

    if (userInfo && userInfo.length > 0) {
        const userEmail = userInfo?.[0]?.email;
        const firstName = userInfo?.[0]?.firstName || '';
        const lastName = userInfo?.[0]?.lastName || '';

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
                const cc = Array.isArray(userInfo?.[0]?.additionalEmails) && userInfo[0].additionalEmails.length
                    ? ` (cc: ${userInfo[0].additionalEmails.join(', ')})`
                    : '';
                console.log(`Email alert sent to ${firstName} ${lastName} <${userEmail}>${cc} for ${newCheckData.protocol}://${newCheckData.url} state=${state}.`);
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
        // Print a single line indicating when this batch was executed
        try {
            console.log(`[Checks] Executed at ${new Date().toISOString()} (count=${checks.length})`);
        } catch (_) { }
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
