/**
 * Title: Environments
 * Description: Handle all environment related things
 * Author: Jonayed Ahmed Riduan
 * Date: 01/10/2024
 */


// dependencies

// module scaffolding
const environments = {}


environments.staging = {
    port: Number(process.env.PORT) || 5000,
    envName: 'staging',
    secretKey: 'fsdfsdfsd',
    maxChecks: 50
}

environments.production = {
    port: Number(process.env.PORT) || 3000,
    envName: 'production',
    secretKey: 'fsdfsdfsd',
    maxChecks: 50
}

// determine which environment was passed
const currentEnvironment = typeof (process.env.NODE_ENV) === 'string' ? process.env.NODE_ENV : 'staging'


// export corresponding environment object
const environmentsToExport = typeof (environments[currentEnvironment]) === 'object'
    ? environments[currentEnvironment]
    : environments.staging;

// export module
module.exports = environmentsToExport