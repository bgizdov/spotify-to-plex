/* eslint-disable max-depth */
import { getYtdlpSettings } from "@spotify-to-plex/plex-config/functions/getYtdlpSettings";
import { getStorageDir } from "@spotify-to-plex/shared-utils/utils/getStorageDir";
import { SlskdSyncLog } from "@spotify-to-plex/shared-types/slskd/SlskdSyncLog";
import { SlskdTrackData } from "@spotify-to-plex/shared-types/slskd/SlskdTrackData";
import { YtdlpClient } from "@spotify-to-plex/shared-utils/ytdlp/client";
import { downloadTrack } from "@spotify-to-plex/shared-utils/ytdlp/downloadTrack";
import { waitForDownloadComplete } from "@spotify-to-plex/shared-utils/ytdlp/waitForDownloadComplete";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getNestedSyncLogsForType } from "../utils/getNestedSyncLogsForType";
import { startSyncType } from "../utils/startSyncType";
import { clearSyncTypeLogs } from "../utils/clearSyncTypeLogs";
import { completeSyncType } from "../utils/completeSyncType";
import { errorSyncType } from "../utils/errorSyncType";
import { updateSyncTypeProgress } from "../utils/updateSyncTypeProgress";

export async function syncYtdlp() {
    console.log("Starting yt-dlp sync...");

    // Check yt-dlp settings
    const settings = await getYtdlpSettings();
    if (!settings.enabled) {
        console.log("yt-dlp sync is disabled");
        return;
    }

    // Start sync type logging
    startSyncType("ytdlp");
    clearSyncTypeLogs("ytdlp");

    try {
        // Validate configuration
        if (!settings.api_url) {
            throw new Error("yt-dlp API URL not configured");
        }

        if (!settings.api_key) {
            throw new Error("yt-dlp API key not configured");
        }

        // Initialize client
        const client = new YtdlpClient(settings.api_url, settings.api_key);

        // Test connection
        console.log("Testing connection to yt-dlp-host...");
        const health = await client.health();
        console.log(`Connected to yt-dlp-host: ${health.version}`);

        // Read ALL missing tracks from JSON file
        const tracksPath = join(getStorageDir(), "missing_tracks_slskd.json");
        if (!existsSync(tracksPath)) {
            console.log("No missing tracks file found");
            completeSyncType("ytdlp");
            return;
        }

        const content = readFileSync(tracksPath, "utf8");
        let tracks: SlskdTrackData[] = [];

        try {
            tracks = JSON.parse(content);
        } catch (_e) {
            throw new Error("Failed to parse missing tracks JSON");
        }

        if (tracks.length === 0) {
            console.log("No missing tracks to process");
            completeSyncType("ytdlp");
            return;
        }

        console.log(`Found ${tracks.length} missing tracks to process`);

        // Read SLSKD sync log to check which tracks were 'not_found'
        const slskdLogPath = join(getStorageDir(), "slskd_sync_log.json");
        const slskdLogs: SlskdSyncLog[] = existsSync(slskdLogPath)
            ? JSON.parse(readFileSync(slskdLogPath, "utf8"))
            : [];

        // Build set of track keys that SLSKD didn't find
        const notFoundTracks = new Set(
            slskdLogs
                .filter((log) => log.status === "not_found")
                .map((log) => `${log.artist_name}||${log.track_name}`)
        );

        console.log(
            `SLSKD found ${slskdLogs.length - notFoundTracks.size} tracks, ${notFoundTracks.size} not found`
        );

        // Initialize logs
        const { putLog, logComplete, logError } = getNestedSyncLogsForType("ytdlp");
        const syncLog = putLog("ytdlp-sync", "YT-DLP Sync");

        let successCount = 0;
        let failureCount = 0;
        let skippedCount = 0;

        // Process tracks
        for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            if (!track) continue;

            const trackKey = `${track.artist_name}||${track.track_name}`;

            // Skip if SLSKD found the track (fallback_only mode)
            if (settings.fallback_only && !notFoundTracks.has(trackKey)) {
                skippedCount++;
                updateSyncTypeProgress("ytdlp", i + 1, tracks.length);
                continue;
            }

            const trackLog = putLog(
                `${track.artist_name} - ${track.track_name}`,
                `${track.artist_name} - ${track.track_name}`
            );

            try {
                // Attempt download with retries
                let downloadSuccess = false;

                for (let retryAttempt = 0; retryAttempt <= settings.retry_limit; retryAttempt++) {
                    try {
                        if (retryAttempt > 0) {
                            console.log(
                                `[${track.artist_name} - ${track.track_name}] Retry attempt ${retryAttempt}/${settings.retry_limit}`
                            );
                        }

                        // Initiate download with custom filename
                        const downloadResp = await downloadTrack(client, track, {
                            audio_format: settings.audio_format,
                            audio_container: settings.audio_container,
                            filename: `${track.artist_name} - ${track.track_name}`, // Filename without extension
                        });

                        if (!downloadResp.task_id) {
                            throw new Error("No task ID returned from download request");
                        }

                        // Wait for completion
                        console.log(
                            `[${track.artist_name} - ${track.track_name}] Waiting for download...`
                        );
                        const statusResp = await waitForDownloadComplete(client, downloadResp.task_id, {
                            pollInterval: settings.poll_interval,
                            maxAttempts: settings.poll_max_attempts,
                        });

                        // Check if download was successful
                        if (statusResp.status === "error") {
                            throw new Error(statusResp.error || "Download failed");
                        }

                        if (statusResp.status === "completed" && statusResp.file) {
                            console.log(
                                `[${track.artist_name} - ${track.track_name}] ✓ Downloaded successfully`
                            );
                            downloadSuccess = true;
                            successCount++;
                            break; // Exit retry loop on success
                        } else {
                            throw new Error(`Unexpected status: ${statusResp.status}`);
                        }
                    } catch (retryError) {
                        const errorMsg =
                            retryError instanceof Error ? retryError.message : String(retryError);

                        if (retryAttempt === settings.retry_limit) {
                            throw retryError;
                        }

                        console.log(
                            `[${track.artist_name} - ${track.track_name}] Attempt failed: ${errorMsg}`
                        );

                        // Wait before retry
                        await new Promise((resolve) => setTimeout(resolve, 2000));
                    }
                }

                if (!downloadSuccess) {
                    throw new Error("All download attempts exhausted");
                }

                logComplete(trackLog);
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : String(error);
                failureCount++;

                console.log(
                    `[${track.artist_name} - ${track.track_name}] ✗ Failed: ${errorMsg}`
                );
                logError(trackLog, errorMsg);
            }

            // Update progress
            updateSyncTypeProgress("ytdlp", i + 1, tracks.length);
        }

        console.log(
            `yt-dlp sync complete: ${successCount} succeeded, ${failureCount} failed, ${skippedCount} skipped`
        );

        logComplete(syncLog);
        completeSyncType("ytdlp");
    } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error("yt-dlp sync error:", errorMsg);
        errorSyncType("ytdlp", errorMsg);
    }
}
