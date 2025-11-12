/**
 * Migration Script: Convert Old Project Schema to New Schema
 * Run once: node migration/convertProjectsSchema.js
 */

const mongoose = require('mongoose');

// MongoDB connection string (same as in server.js)
const mongoString = 'mongodb+srv://jonayedahmed99455:kNgWOh0uZbOAvsey@cluster0.v5mb8h1.mongodb.net/api-uptime-monitoring';

// Import schema
const deploymentProjectSchema = require('../src/schemas/deploymentProjectSchema');
const DeploymentProject = mongoose.model('DeploymentProject', deploymentProjectSchema);

async function migrateProjects() {
    console.log('🔄 Starting project schema migration...');
    console.log(`Environment: ${process.env.NODE_ENV || 'staging'}`);
    
    try {
        // Connect to MongoDB
        await mongoose.connect(mongoString);
        console.log('✅ Connected to MongoDB');

        // Find all projects that need migration
        const allProjects = await DeploymentProject.find({});
        console.log(`\nTotal projects in database: ${allProjects.length}`);

        const projectsToMigrate = allProjects.filter(p => {
            // Check if old schema (has 'environment' field or missing deploymentTargets)
            const hasOldEnvironmentField = p.environment !== undefined;
            const missingTargets = !p.deploymentTargets || p.deploymentTargets.length === 0;
            return hasOldEnvironmentField || missingTargets;
        });

        console.log(`Projects needing migration: ${projectsToMigrate.length}\n`);

        if (projectsToMigrate.length === 0) {
            console.log('✨ No projects need migration. All projects are already using the new schema!');
            return;
        }

        let migratedCount = 0;
        let errorCount = 0;

        for (const project of projectsToMigrate) {
            try {
                console.log(`\n📦 Migrating: "${project.name}" (ID: ${project._id})`);
                console.log(`   Old environment: ${project.environment || 'not set'}`);
                console.log(`   Old defaultServerId: ${project.defaultServerId || 'not set'}`);

                // Create deployment target from old data
                const deploymentTarget = {
                    agentId: project.defaultServerId || '', // Use old field if exists
                    environment: project.environment || 'dev', // Use old environment
                    branch: project.branch || 'main',
                    buildCommand: '',
                    startCommand: '',
                    stopCommand: '',
                    restartCommand: '',
                    artifacts: [],
                    deployPath: '',
                    envVars: [], // Target-specific env vars (separate from global)
                    autoStart: false
                };

                // Update project with new structure
                project.deploymentTargets = [deploymentTarget];
                
                // Remove old fields (they'll be undefined in new schema anyway)
                // Note: Mongoose will ignore undefined fields on save
                project.environment = undefined;
                project.defaultServerId = undefined;

                await project.save();
                
                console.log(`   ✅ Migrated successfully!`);
                console.log(`   New deploymentTargets: ${JSON.stringify(deploymentTarget, null, 2)}`);
                migratedCount++;
            } catch (error) {
                console.error(`   ❌ Failed to migrate "${project.name}":`, error.message);
                errorCount++;
            }
        }

        console.log('\n' + '='.repeat(60));
        console.log('📊 Migration Summary:');
        console.log(`   Total projects: ${allProjects.length}`);
        console.log(`   Successfully migrated: ${migratedCount}`);
        console.log(`   Errors: ${errorCount}`);
        console.log(`   Already migrated: ${allProjects.length - projectsToMigrate.length}`);
        console.log('='.repeat(60));
        console.log('\n✨ Migration complete!');

    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        throw error;
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB\n');
    }
}

// Run migration
(async () => {
    try {
        await migrateProjects();
        process.exit(0);
    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
})();
