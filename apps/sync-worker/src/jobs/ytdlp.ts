import { getYtdlpSettings } from "@spotify-to-plex/plex-config/functions/getYtdlpSettings";
import { getStorageDir } from "@spotify-to-plex/shared-utils/utils/getStorageDir";
import { YtdlpSyncLog } from "@spotify-to-plex/shared-types/ytdlp/YtdlpSyncLog";
import { SlskdTrackData } from "@spotify-to-plex/shared-types/slskd/SlskdTrackData";
import { YtdlpClient } from "@spotify-to-plex/shared-utils/ytdlp/client";
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

    // Check YT-DLP settings
    const settings = await getYtdlpSettings();
    if (!settings.enabled) {
        console.log('YT-DLP sync is disabled');

        return;
    }

    // Start sync type logging
    startSyncType('ytdlp');
    clearSyncTypeLogs('ytdlp');

    try {
        if (!settings.api_url || !settings.api_key) {
            console.log('YT-DLP API URL or API key not configured');
            errorSyncType('ytdlp', 'YT-DLP API URL or API key not configured');

            return;
        }

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

        // Read existing YT-DLP logs
        const ytdlpLogsPath = join(getStorageDir(), 'ytdlp_sync_log.json');
        const ytdlpLogs: Record<string, YtdlpSyncLog> = {};

        // Initialize YT-DLP client
        const client = new YtdlpClient(settings.api_url, settings.api_key);

        // Verify connection
        try {
            await client.health();
        } catch (error: any) {
            console.log('Failed to connect to YT-DLP API:', error.message);
            errorSyncType('ytdlp', `Failed to connect to YT-DLP API: ${error.message}`);

            return;
        }

        // Process each track
        let successCount = 0;
        let errorCount = 0;
        let skippedCount = 0;

        for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            if (!track)
                continue;

            // Update progress
            updateSyncTypeProgress('ytdlp', i + 1, tracks.length);

            const trackKey = `${track.artist_name}|${track.track_name}`;
            const logId = `${Date.now()}-${trackKey}`;

            const trackLog: YtdlpSyncLog = {
                id: logId,
                spotify_id: track.spotify_id,
                artist_name: track.artist_name,
                track_name: track.track_name,
                album_name: track.album_name,
                start: Date.now(),
                status: 'error',
            };

            try {
                // Skip tracks without proper info
                if (!track.artist_name || !track.track_name) {
                    trackLog.status = 'skipped';
                    trackLog.error = 'Missing artist or title information';
                    trackLog.end = Date.now();
                    skippedCount++;
                    ytdlpLogs[logId] = trackLog;
                    console.log(`⚠️  Skipping track (missing info): ${track.artist_name} - ${track.track_name}`);
                    continue;
                }

                // Generate YouTube search query
                const youtubeQuery = `${track.artist_name} - ${track.track_name}`;
                trackLog.youtube_query = youtubeQuery;

                console.log(`🔍 Searching YouTube for: ${youtubeQuery}`);

                // Search for video
                const searchResult = await client.search(youtubeQuery);

                if (!searchResult.success || !searchResult.url) {
                    trackLog.status = 'error';
                    trackLog.error = searchResult.message || 'No video found';
                    trackLog.end = Date.now();
                    errorCount++;
                    ytdlpLogs[logId] = trackLog;
                    console.log(`❌ No video found: ${youtubeQuery}`);
                    continue;
                }

                trackLog.youtube_url = searchResult.url;
                trackLog.youtube_title = searchResult.title;
                trackLog.youtube_duration = searchResult.duration;

                console.log(`✓ Found video: ${searchResult.title} (${searchResult.url})`);

                // Download track
                const filename = `${track.artist_name} - ${track.track_name}`;

                const downloadResult = await client.download({
                    url: searchResult.url,
                    output_filename: filename,
                    audio_format: settings.audio_format,
                    output_format: settings.audio_container
                });

                if (downloadResult.status === 'error') {
                    trackLog.status = 'error';
                    trackLog.error = downloadResult.error || downloadResult.message || 'Download failed';
                    trackLog.end = Date.now();
                    errorCount++;
                    ytdlpLogs[logId] = trackLog;
                    console.log(`❌ Download failed: ${downloadResult.error || downloadResult.message}`);
                    continue;
                }

                trackLog.status = 'queued';
                trackLog.file_path = downloadResult.task_id;
                trackLog.end = Date.now();
                successCount++;
                ytdlpLogs[logId] = trackLog;

                console.log(`✓ Queued download: ${filename} (Task ID: ${downloadResult.task_id})`);

            } catch (error: any) {
                trackLog.status = 'error';
                trackLog.error = error.message || 'Unknown error';
                trackLog.end = Date.now();
                errorCount++;
                ytdlpLogs[logId] = trackLog;

                console.log(`❌ Error processing track: ${error.message}`);
            }

            // Rate limit: 1 second delay between tracks
            await new Promise(resolve => { setTimeout(resolve, 1000) });
        }

        // Save YT-DLP logs
        writeFileSync(ytdlpLogsPath, JSON.stringify(ytdlpLogs, null, 2));

        // Complete sync log
        logComplete(syncLog);

        console.log(`YT-DLP sync complete: ${successCount} queued, ${skippedCount} skipped, ${errorCount} errors`);

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
