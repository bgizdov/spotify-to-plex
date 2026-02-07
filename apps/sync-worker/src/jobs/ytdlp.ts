import { getStorageDir } from "@spotify-to-plex/shared-utils/utils/getStorageDir";
import { SlskdTrackData } from "@spotify-to-plex/shared-types/slskd/SlskdTrackData";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getNestedSyncLogsForType } from "../utils/getNestedSyncLogsForType";
import { startSyncType } from "../utils/startSyncType";
import { clearSyncTypeLogs } from "../utils/clearSyncTypeLogs";
import { completeSyncType } from "../utils/completeSyncType";
import { errorSyncType } from "../utils/errorSyncType";
import { updateSyncTypeProgress } from "../utils/updateSyncTypeProgress";

export async function syncYtdlp() {
    console.log('Starting YT-DLP sync...');

    // Start sync type logging
    startSyncType('ytdlp');
    clearSyncTypeLogs('ytdlp');

    try {
        // Read missing tracks from JSON file
        const tracksPath = join(getStorageDir(), 'missing_tracks_ytdlp.json');

        if (!existsSync(tracksPath)) {
            console.log('No missing tracks file found');
            completeSyncType('ytdlp');

            return;
        }

        // Parse the JSON file
        const content = readFileSync(tracksPath, 'utf8');
        let tracks: SlskdTrackData[] = [];

        try {
            tracks = JSON.parse(content);
        } catch (_e) {
            console.log('Error parsing missing tracks JSON file');
            errorSyncType('ytdlp', 'Failed to parse missing_tracks_ytdlp.json');

            return;
        }

        if (!Array.isArray(tracks) || tracks.length === 0) {
            console.log('No tracks to sync');
            completeSyncType('ytdlp');

            return;
        }

        // Initialize logs
        const { putLog, logComplete } = getNestedSyncLogsForType('ytdlp');
        const syncLog = putLog('ytdlp-sync', 'YT-DLP Sync');
        const ytdlpLogsPath = join(getStorageDir(), 'ytdlp_sync_log.json');
        const ytdlpLogs: Record<string, any> = {};

        // Process each track
        let processedCount = 0;
        const missingTracks: SlskdTrackData[] = [];

        for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            if (!track)
                continue;

            // Update progress
            updateSyncTypeProgress('ytdlp', i + 1, tracks.length);

            const trackKey = `${track.artist_name}|${track.track_name}`;
            const logId = `${Date.now()}-${trackKey}`;

            // Log track processing
            const trackLog = {
                id: logId,
                spotify_id: track.spotify_id,
                artist_name: track.artist_name,
                track_name: track.track_name,
                album_name: track.album_name,
                start: Date.now(),
                status: 'queued' as const,
                end: Date.now(),
            };

            ytdlpLogs[logId] = trackLog;
            processedCount++;

            console.log(`✓ Queued for download: ${track.artist_name} - ${track.track_name}`);

            // Rate limit: 1 second delay between tracks
            await new Promise(resolve => { setTimeout(resolve, 1000) });
        }

        // Save YT-DLP logs
        writeFileSync(ytdlpLogsPath, JSON.stringify(ytdlpLogs, null, 2));

        // Clear missing tracks file (all queued for download)
        writeFileSync(tracksPath, JSON.stringify(missingTracks, null, 2));

        // Complete sync log
        logComplete(syncLog);

        console.log(`YT-DLP sync complete: ${processedCount} tracks queued for download`);

        // Mark sync as complete
        completeSyncType('ytdlp');
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        errorSyncType('ytdlp', message);
        throw e;
    }
}

function run() {
    syncYtdlp()
        .then(() => {
            console.log('YT-DLP sync completed');
        })
        .catch((e: unknown) => {
            console.error('YT-DLP sync failed:', e);
        });
}

// Only run if this file is executed directly, not when imported
// eslint-disable-next-line unicorn/prefer-module
if (require.main === module) {
    run();
}
