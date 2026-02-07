import { schedule } from 'node-cron';
import { spawn } from 'node:child_process';
import { getLidarrSettings } from '@spotify-to-plex/plex-config/functions/getLidarrSettings';
import { getSlskdSettings } from '@spotify-to-plex/plex-config/functions/getSlskdSettings';

type YtdlpSettings = {
    enabled: boolean;
    auto_sync: boolean;
    [key: string]: any;
};

async function getYtdlpSettings(): Promise<YtdlpSettings> {
    try {
        // Try to read from environment or config
        return {
            enabled: process.env.YTDLP_ENABLED === 'true',
            auto_sync: process.env.YTDLP_AUTO_SYNC === 'true'
        };
    } catch {
        return { enabled: false, auto_sync: false };
    }
}

const SYNC_SCHEDULE = '0 2 * * *'; // Every day at 02:00
const SLSKD_SYNC_SCHEDULE = '0 5 * * *'; // Every day at 05:00
const LIDARR_SYNC_SCHEDULE = '0 6 * * *'; // Every day at 06:00
const YTDLP_SYNC_SCHEDULE = '0 7 * * *'; // Every day at 07:00
const MQTT_SYNC_SCHEDULE = '0 * * * *'; // Every hour

console.log('🚀 Sync scheduler started');
console.log(`⏰ Main sync schedule: ${SYNC_SCHEDULE}`);
console.log(`⏰ SLSKD sync schedule: ${SLSKD_SYNC_SCHEDULE}`);
console.log(`⏰ Lidarr sync schedule: ${LIDARR_SYNC_SCHEDULE}`);
console.log(`⏰ YT-DLP sync schedule: ${YTDLP_SYNC_SCHEDULE}`);
console.log(`⏰ MQTT sync schedule: ${MQTT_SYNC_SCHEDULE}`);

// Function to run the sync command
function runSync() {
    console.log(`\n📅 Starting scheduled sync at ${new Date().toISOString()}`);

    // In production, the sync script already uses compiled JS files
    const syncProcess = spawn('npm', ['run', 'sync'], {
        cwd: '/app/apps/sync-worker',
        stdio: 'inherit',
        shell: true
    });

    syncProcess.on('exit', (code) => {
        if (code === 0) {
            console.log(`✅ Sync completed successfully at ${new Date().toISOString()}`);
        } else {
            console.error(`❌ Sync failed with exit code ${code} at ${new Date().toISOString()}`);
        }
    });

    syncProcess.on('error', (error) => {
        console.error(`❌ Failed to start sync process:`, error);
    });
}

// NEW: Function to run SLSKD sync
async function runSlskdSync() {
    console.log(`\n🎵 Checking SLSKD sync settings at ${new Date().toISOString()}`);

    try {
        const settings = await getSlskdSettings();

        if (!settings.enabled) {
            console.log('ℹ️ SLSKD integration is not enabled. Skipping sync.');

            return;
        }

        if (!settings.auto_sync) {
            console.log('ℹ️ SLSKD automatic synchronization is not enabled. Skipping sync.');

            return;
        }

        console.log('✅ SLSKD auto-sync is enabled. Starting sync...');

        const slskdProcess = spawn('npm', ['run', 'sync:slskd'], {
            cwd: '/app/apps/sync-worker',
            stdio: 'inherit',
            shell: true
        });

        slskdProcess.on('exit', (code) => {
            if (code === 0) {
                console.log(`✅ SLSKD sync completed successfully at ${new Date().toISOString()}`);
            } else {
                console.error(`❌ SLSKD sync failed with exit code ${code} at ${new Date().toISOString()}`);
            }
        });

        slskdProcess.on('error', (error) => {
            console.error(`❌ Failed to start SLSKD sync process:`, error);
        });
    } catch (error) {
        console.error('❌ Error checking SLSKD settings:', error);
    }
}

// NEW: Function to run Lidarr sync
async function runLidarrSync() {
    console.log(`\n📀 Checking Lidarr sync settings at ${new Date().toISOString()}`);

    try {
        const settings = await getLidarrSettings();

        if (!settings.enabled) {
            console.log('ℹ️ Lidarr integration is not enabled. Skipping sync.');

            return;
        }

        if (!settings.auto_sync) {
            console.log('ℹ️ Lidarr automatic synchronization is not enabled. Skipping sync.');

            return;
        }

        console.log('✅ Lidarr auto-sync is enabled. Starting sync...');

        const lidarrProcess = spawn('npm', ['run', 'sync:lidarr'], {
            cwd: '/app/apps/sync-worker',
            stdio: 'inherit',
            shell: true
        });

        lidarrProcess.on('exit', (code) => {
            if (code === 0) {
                console.log(`✅ Lidarr sync completed successfully at ${new Date().toISOString()}`);
            } else {
                console.error(`❌ Lidarr sync failed with exit code ${code} at ${new Date().toISOString()}`);
            }
        });

        lidarrProcess.on('error', (error) => {
            console.error(`❌ Failed to start Lidarr sync process:`, error);
        });
    } catch (error) {
        console.error('❌ Error checking Lidarr settings:', error);
    }
}

// Schedule the sync task
const task = schedule(SYNC_SCHEDULE, runSync, {
    scheduled: true,
    timezone: process.env.TZ || 'UTC' // Use TZ env var or default to UTC
});

// NEW: Schedule SLSKD sync task
const slskdTask = schedule(SLSKD_SYNC_SCHEDULE, () => {
    runSlskdSync();
}, {
    scheduled: true,
    timezone: process.env.TZ || 'UTC'
});

// NEW: Schedule Lidarr sync task
const lidarrTask = schedule(LIDARR_SYNC_SCHEDULE, () => {
    runLidarrSync();
}, {
    scheduled: true,
    timezone: process.env.TZ || 'UTC'
});

// NEW: Schedule YT-DLP sync task
const ytdlpTask = schedule(YTDLP_SYNC_SCHEDULE, () => {
    runYtdlpSync();
}, {
    scheduled: true,
    timezone: process.env.TZ || 'UTC'
});

// NEW: Function to run YT-DLP sync
async function runYtdlpSync() {
    console.log(`\n🎬 Checking YT-DLP sync settings at ${new Date().toISOString()}`);

    try {
        const settings = await getYtdlpSettings();

        if (!settings.enabled) {
            console.log('ℹ️ YT-DLP integration is not enabled. Skipping sync.');

            return;
        }

        if (!settings.auto_sync) {
            console.log('ℹ️ YT-DLP automatic synchronization is not enabled. Skipping sync.');

            return;
        }

        console.log('✅ YT-DLP auto-sync is enabled. Starting sync...');

        const ytdlpProcess = spawn('npm', ['run', 'sync:ytdlp'], {
            cwd: '/app/apps/sync-worker',
            stdio: 'inherit',
            shell: true
        });

        ytdlpProcess.on('exit', (code) => {
            if (code === 0) {
                console.log(`✅ YT-DLP sync completed successfully at ${new Date().toISOString()}`);
            } else {
                console.error(`❌ YT-DLP sync failed with exit code ${code} at ${new Date().toISOString()}`);
            }
        });

        ytdlpProcess.on('error', (error) => {
            console.error(`❌ Failed to start YT-DLP sync process:`, error);
        });
    } catch (error) {
        console.error('❌ Error checking YT-DLP settings:', error);
    }
}

// NEW: Function to run MQTT sync
function runMqttSync() {
    console.log(`\n📡 Starting MQTT sync at ${new Date().toISOString()}`);

    const mqttProcess = spawn('npm', ['run', 'mqtt'], {
        cwd: '/app/apps/sync-worker',
        stdio: 'inherit',
        shell: true
    });

    mqttProcess.on('exit', (code) => {
        if (code === 0) {
            console.log(`✅ MQTT sync completed successfully at ${new Date().toISOString()}`);
        } else {
            console.error(`❌ MQTT sync failed with exit code ${code} at ${new Date().toISOString()}`);
        }
    });

    mqttProcess.on('error', (error) => {
        console.error(`❌ Failed to start MQTT sync process:`, error);
    });
}

// NEW: Schedule MQTT sync task
const mqttTask = schedule(MQTT_SYNC_SCHEDULE, runMqttSync, {
    scheduled: true,
    timezone: process.env.TZ || 'UTC'
});

// Run sync immediately on startup if SYNC_ON_STARTUP env var is set
if (process.env.SYNC_ON_STARTUP === 'true') {
    console.log('🔄 Running initial sync on startup...');
    runSync();
}

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Received SIGTERM, stopping scheduler...');
    task.stop();
    slskdTask.stop();
    lidarrTask.stop();
    ytdlpTask.stop();
    mqttTask.stop();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 Received SIGINT, stopping scheduler...');
    task.stop();
    slskdTask.stop();
    lidarrTask.stop();
    ytdlpTask.stop();
    mqttTask.stop();
    process.exit(0);
});

// Keep the process alive
process.stdin.resume();