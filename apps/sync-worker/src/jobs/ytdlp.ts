import { getStorageDir } from "@spotify-to-plex/shared-utils/utils/getStorageDir";
import { SlskdTrackData } from "@spotify-to-plex/shared-types/slskd/SlskdTrackData";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import axios from "axios";
import { getNestedSyncLogsForType } from "../utils/getNestedSyncLogsForType";
import { startSyncType } from "../utils/startSyncType";
import { clearSyncTypeLogs } from "../utils/clearSyncTypeLogs";
import { completeSyncType } from "../utils/completeSyncType";
import { errorSyncType } from "../utils/errorSyncType";
import { updateSyncTypeProgress } from "../utils/updateSyncTypeProgress";

type YtdlpSettings = {
    enabled: boolean;
    api_url: string;
    api_key: string;
    audio_format: string;
    audio_container: string;
    poll_interval: number;
    poll_max_attempts: number;
    retry_limit: number;
    auto_sync: boolean;
    fallback_only: boolean;
};

export async function syncYtdlp() {
    console.log('Starting YT-DLP sync...');

    // Start sync type logging
    startSyncType('ytdlp');
    clearSyncTypeLogs('ytdlp');

    try {
        // Get YT-DLP settings from environment
        const apiUrl = process.env.YTDLP_API_URL;
        const apiKey = process.env.YTDLP_API_KEY;
        const fallbackOnly = process.env.YTDLP_FALLBACK_ONLY === 'true';

        if (!apiUrl || !apiKey) {
            console.log('YT-DLP API URL or API key not configured');
            completeSyncType('ytdlp');
            return;
        }

        // Determine which file to read from
        let tracksPath: string;
        let sourceFile: string;

        if (fallbackOnly) {
            // In fallback mode, only process tracks that SLSKD couldn't find
            tracksPath = join(getStorageDir(), 'missing_tracks_slskd.json');
            sourceFile = 'SLSKD missing tracks (fallback mode)';
            console.log('YT-DLP in fallback mode - will only process tracks SLSKD could not find');
        } else {
            // In direct mode, process all missing Spotify tracks
            tracksPath = join(getStorageDir(), 'missing_tracks_all_spotify.json');
            sourceFile = 'All Spotify missing tracks (direct mode)';
            console.log('YT-DLP in direct mode - will process all missing Spotify tracks');
        }

        let tracks: SlskdTrackData[] = [];

        // Try to read the file if it exists
        if (existsSync(tracksPath)) {
            // Parse the JSON file
            const content = readFileSync(tracksPath, 'utf8');

            try {
                tracks = JSON.parse(content);
            } catch (_e) {
                console.log(`Error parsing ${sourceFile}`);
                errorSyncType('ytdlp', `Failed to parse ${sourceFile}`);
                return;
            }
        } else {
            // File doesn't exist yet - that's okay, no tracks to process
            console.log(`No ${sourceFile} file found - nothing to sync`);
            completeSyncType('ytdlp');
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
        let successCount = 0;
        let notFoundCount = 0;
        let errorCount = 0;
        const missingTracks: SlskdTrackData[] = [];

        for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            if (!track)
                continue;

            // Update progress
            updateSyncTypeProgress('ytdlp', i + 1, tracks.length);

            const trackKey = `${track.artist_name}|${track.track_name}`;
            const logId = `${Date.now()}-${trackKey}`;

            const trackLog: any = {
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
                    trackLog.status = 'error';
                    trackLog.error = 'Missing artist or title information';
                    trackLog.end = Date.now();
                    errorCount++;
                    ytdlpLogs[logId] = trackLog;
                    console.log(`⚠️  Skipping track (missing info): ${track.artist_name} - ${track.track_name}`);
                    continue;
                }

                const searchQuery = `${track.artist_name} - ${track.track_name}`;
                console.log(`🔍 Searching for: ${searchQuery}`);

                // STEP 1: Search for the track
                const searchResponse = await axios.post(
                    `${apiUrl}/search`,
                    { query: searchQuery },
                    {
                        headers: {
                            'X-API-Key': apiKey,
                            'Content-Type': 'application/json'
                        },
                        timeout: 30000
                    }
                );

                if (!searchResponse.data.success) {
                    trackLog.status = 'not_found';
                    trackLog.error = 'No results found on YouTube';
                    trackLog.end = Date.now();
                    notFoundCount++;
                    ytdlpLogs[logId] = trackLog;
                    missingTracks.push(track);

                    console.log(`❌ Not found: ${searchQuery}`);
                    continue;
                }

                const videoUrl = searchResponse.data.url;
                const videoTitle = searchResponse.data.title;
                const videoDuration = searchResponse.data.duration;

                console.log(`✓ Found: ${videoTitle} (${videoDuration}s)`);

                // STEP 2: Queue the video for download
                const queueResponse = await axios.post(
                    `${apiUrl}/queue`,
                    {
                        url: videoUrl,
                        format: process.env.YTDLP_AUDIO_FORMAT || 'bestaudio',
                        audio_container: process.env.YTDLP_AUDIO_CONTAINER || 'mp3'
                    },
                    {
                        headers: {
                            'X-API-Key': apiKey,
                            'Content-Type': 'application/json'
                        },
                        timeout: 10000
                    }
                );

                if (!queueResponse.data.success) {
                    trackLog.status = 'error';
                    trackLog.error = 'Failed to queue download';
                    trackLog.end = Date.now();
                    errorCount++;
                    ytdlpLogs[logId] = trackLog;
                    missingTracks.push(track);

                    console.log(`❌ Failed to queue: ${searchQuery}`);
                    continue;
                }

                // Success!
                trackLog.status = 'queued';
                trackLog.video_url = videoUrl;
                trackLog.video_title = videoTitle;
                trackLog.video_duration = videoDuration;
                trackLog.end = Date.now();
                successCount++;
                ytdlpLogs[logId] = trackLog;

                console.log(`✓ Queued for download: ${videoTitle}`);

            } catch (error: any) {
                trackLog.status = 'error';
                trackLog.error = error.message || 'Unknown error';
                trackLog.end = Date.now();
                errorCount++;
                ytdlpLogs[logId] = trackLog;
                missingTracks.push(track);

                console.log(`❌ Error processing track: ${error.message}`);
            }

            // Rate limit: 1 second delay between tracks
            await new Promise(resolve => { setTimeout(resolve, 1000) });
        }

        // Save YT-DLP logs
        writeFileSync(ytdlpLogsPath, JSON.stringify(ytdlpLogs, null, 2));

        // Save remaining missing tracks (not found or errored)
        if (fallbackOnly) {
            // In fallback mode, update SLSKD missing tracks file with tracks that YT-DLP couldn't find
            console.log(`Saving ${missingTracks.length} tracks that YT-DLP could not find back to SLSKD missing tracks`);
        } else {
            // In direct mode, update YT-DLP missing tracks file
            console.log(`Saving ${missingTracks.length} tracks that YT-DLP could not find for retry`);
        }
        writeFileSync(tracksPath, JSON.stringify(missingTracks, null, 2));

        // Complete sync log
        logComplete(syncLog);

        console.log(`YT-DLP sync complete: ${successCount} queued, ${notFoundCount} not found, ${errorCount} errors`);

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
