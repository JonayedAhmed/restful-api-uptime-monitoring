/**
 * Title: Deployment Runs Handler
 * Description: Trigger and list deployment runs (local execution placeholder before agent)
 */

const mongoose = require('mongoose');
const { spawn } = require('child_process');
const fs = require('fs');
const { rm } = require('fs/promises');
const tokenHandler = require('./tokenHandler');
const deploymentProjectSchema = require('../../schemas/deploymentProjectSchema');
const deploymentRunSchema = require('../../schemas/deploymentRunSchema');
const deploymentLogSchema = require('../../schemas/deploymentLogSchema');
const pipelineTemplateSchema = require('../../schemas/pipelineTemplateSchema');

const DeploymentProject = new mongoose.model('DeploymentProject', deploymentProjectSchema);
const DeploymentRun = new mongoose.model('DeploymentRun', deploymentRunSchema);
const DeploymentLog = new mongoose.model('DeploymentLog', deploymentLogSchema);
const PipelineTemplate = new mongoose.model('PipelineTemplate', pipelineTemplateSchema);

const handler = {};

handler.deploymentRunsHandler = (requestProperties, callback) => {
    const accepted = ['get', 'post', 'options'];
    if (accepted.includes(requestProperties?.method)) {
        if (requestProperties.method === 'options') return callback(204, {});
        return handler._impl[requestProperties.method](requestProperties, callback);
    }
    callback(405, { error: 'Method Not Allowed' });
};

handler._impl = {};

// GET: list runs for a deploymentId (query deploymentId)
handler._impl.get = async (req, callback) => {
    try {
        const deploymentId = typeof req?.queryStringObject?.deploymentId === 'string' ? req.queryStringObject.deploymentId : null;
        const list = await DeploymentRun.find(deploymentId ? { deploymentId } : {}).sort({ createdAt: -1 }).limit(50);
        callback(200, { data: list });
    } catch (e) {
        callback(500, { error: 'Failed to list runs' });
    }
};

// POST: trigger run (local execution)
// Body: { deploymentId, environment, versionTag?, triggeredBy }
handler._impl.post = async (req, callback) => {
    try {
        const { body, headersObject } = req;
        const token = typeof headersObject?.token === 'string' ? headersObject.token : false;
        const userId = typeof body?.triggeredBy === 'string' ? body.triggeredBy : (typeof body?.userId === 'string' ? body.userId : false);
        if (!token || !userId) return callback(403, { error: 'Auth required' });

        tokenHandler._token.verify(token, userId, async (ok) => {
            if (!ok) return callback(403, { error: 'Authentication failed.' });

            const deploymentId = body?.deploymentId;
            const env = body?.environment;
            if (!deploymentId || !env) return callback(400, { error: 'deploymentId and environment required' });

            const project = await DeploymentProject.findById(deploymentId);
            if (!project) return callback(404, { error: 'Project not found' });

            // Create run
            const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const versionTag = body?.versionTag || `${project.name}:v${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 12)}`;

            const runDoc = new DeploymentRun({
                deploymentId: project._id,
                environment: env,
                runId,
                triggeredBy: userId,
                triggerType: 'manual',
                versionTag,
                status: 'RUNNING',
                startedAt: new Date(),
                envSnapshot: (project.envVars || []).map(({ key, value, secretFlag }) => ({ key, value: secretFlag ? '***' : value, secretFlag })),
                steps: [],
            });
            await runDoc.save();

            // Fire-and-forget execution sequence (no SSE yet). We log to DB.
            (async () => {
                const baseDir = process.env.DEPLOY_BASE_DIR || '/tmp/workspaces';
                const workspace = `${baseDir}/${project._id}/${runId}`;
                const steps = [];
                const enqueueLog = async (streamType, content) => {
                    try { await new DeploymentLog({ deploymentRunId: runId, streamType, content }).save(); } catch { }
                };
                const runStep = (name, cmd, cwd) => new Promise((resolve) => {
                    const step = { name, status: 'RUNNING', startedAt: new Date() };
                    steps.push(step);
                    const child = spawn('/bin/bash', ['-lc', cmd], { cwd });
                    child.stdout.on('data', (d) => enqueueLog('stdout', d.toString()));
                    child.stderr.on('data', (d) => enqueueLog('stderr', d.toString()));
                    child.on('close', async (code) => {
                        step.status = code === 0 ? 'SUCCESS' : 'FAILED';
                        step.exitCode = code;
                        step.finishedAt = new Date();
                        resolve(code);
                    });
                });

                try {
                    await enqueueLog('stdout', `Starting run ${runId} for ${project.name} on ${env}\n`);
                    // Prepare workspace (ensure recursively)
                    try { fs.mkdirSync(workspace, { recursive: true }); } catch { }
                    // Clone or fetch
                    const repoDir = `${workspace}/repo`;
                    await runStep('clone', `if [ ! -d "${repoDir}/.git" ]; then git clone --depth 1 -b ${project.branch} ${project.repoUrl} ${repoDir}; else echo repo exists; fi`, '/');
                    await runStep('checkout', `cd ${repoDir} && git fetch --all --prune && git checkout ${project.branch} && git pull --ff-only`, '/');

                    // Build commands from template if any
                    let buildCommands = [];
                    let runCommands = [];
                    if (project.pipelineTemplateId) {
                        try {
                            const tpl = await PipelineTemplate.findById(project.pipelineTemplateId);
                            if (tpl) {
                                buildCommands = Array.isArray(tpl.buildCommands) ? tpl.buildCommands : [];
                                runCommands = Array.isArray(tpl.runCommands) ? tpl.runCommands : [];
                            }
                        } catch { }
                    }

                    for (const cmd of buildCommands) {
                        const code = await runStep(`build: ${cmd}`, cmd, repoDir);
                        if (code !== 0) throw new Error(`Build step failed: ${cmd}`);
                    }

                    for (const cmd of runCommands) {
                        const code = await runStep(`run: ${cmd}`, cmd, repoDir);
                        if (code !== 0) throw new Error(`Run step failed: ${cmd}`);
                    }

                    await DeploymentRun.updateOne({ runId }, { $set: { steps, status: 'SUCCESS', finishedAt: new Date() } });
                    await enqueueLog('stdout', `Run ${runId} finished SUCCESS\n`);
                    // Cleanup workspace for local runs only (agent support later)
                    const isLocalExecution = true;
                    if (isLocalExecution) {
                        try {
                            await enqueueLog('stdout', `Cleaning up workspace: ${workspace}\n`);
                            await rm(workspace, { recursive: true, force: true });
                        } catch (e) {
                            await enqueueLog('stderr', `Cleanup failed: ${e.message}\n`);
                        }
                    }
                } catch (err) {
                    await enqueueLog('stderr', `Error: ${err.message}\n`);
                    await DeploymentRun.updateOne({ runId }, { $set: { steps, status: 'FAILED', finishedAt: new Date() } });
                }
            })();

            callback(202, { data: runDoc });
        });
    } catch (e) {
        callback(500, { error: 'Failed to trigger run' });
    }
};

module.exports = handler;
