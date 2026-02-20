import { getStorageDir } from '@spotify-to-plex/shared-utils/utils/getStorageDir';
import { searchAlbum } from "@spotify-to-plex/plex-music-search/functions/searchAlbum";
import { SearchResponse } from "@spotify-to-plex/plex-music-search/types/SearchResponse";
import { getMusicSearchConfig } from "@spotify-to-plex/music-search/functions/getMusicSearchConfig";
import { writeFileSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { findMissingTidalAlbums } from "../utils/findMissingTidalAlbums";
import { getCachedPlexTracks } from "../utils/getCachedPlexTracks";
import { getSavedAlbums } from "../utils/getSavedAlbums";
import { getNestedSyncLogsForType } from "../utils/getNestedSyncLogsForType";
import { startSyncType } from "../utils/startSyncType";
import { clearSyncTypeLogs } from "../utils/clearSyncTypeLogs";
import { completeSyncType } from "../utils/completeSyncType";
import { errorSyncType } from "../utils/errorSyncType";
import { updateSyncTypeProgress } from "../utils/updateSyncTypeProgress";
import { loadSpotifyData } from "../utils/loadSpotifyData";
import { getSettings } from "@spotify-to-plex/plex-config/functions/getSettings";
import { LidarrAlbumData } from "@spotify-to-plex/shared-types/lidarr/LidarrAlbumData";
import { SlskdTrackData } from "@spotify-to-plex/shared-types/slskd/SlskdTrackData";
import { SlskdSyncLog } from "@spotify-to-plex/shared-types/slskd/SlskdSyncLog";
import { getYtdlpSettings } from "@spotify-to-plex/plex-config/functions/getYtdlpSettings";

export async function syncAlbums() {
    // Start sync type logging
    startSyncType('albums');
    clearSyncTypeLogs('albums');

    try {

        // Check if we need to force syncing
        const args = process.argv.slice(2);
        const force = args.includes("force")

        const { toSyncAlbums } = getSavedAlbums()
        const { putLog, logError, logComplete } = getNestedSyncLogsForType('albums')

        const settings = await getSettings();
        if (!settings.uri || !settings.token)
            throw new Error("No plex connection found")

        const missingSpotifyAlbums: string[] = []
        const missingTidalAlbums: string[] = []
        const missingAlbumsLidarr: LidarrAlbumData[] = []
        const missingTracksSlskd: SlskdTrackData[] = []

        for (let i = 0; i < toSyncAlbums.length; i++) {
            const item = toSyncAlbums[i];
            if (!item)
                continue;

            // Update progress
            updateSyncTypeProgress('albums', i + 1, toSyncAlbums.length);

            const { id, title, uri, user, sync_interval } = item;

            //////////////////////////////////
            // Load Plex playlist
            //////////////////////////////////
            const itemLog = putLog(id, title)
            let days = Number(sync_interval)
            if (isNaN(days))
                days = 0;

            // Check if sync interval has elapsed (for cache updates)
            const nextSyncAfter = new Date((itemLog.end || 0) + (days * 24 * 60 * 60 * 1000));
            const shouldUpdateCache = nextSyncAfter.getTime() <= Date.now() || force;

            if (!shouldUpdateCache) {
                console.log(`---- Scanning ${title} (cache update skipped, next sync: ${nextSyncAfter.toDateString()}) ----`)
            } else {
                console.log(`---- Syncing ${title} ----`)
            }

            //////////////////////////////////
            // Load Spotify Data
            // Always load to collect missing tracks for SLSKD/Lidarr
            //////////////////////////////////
            const data = await loadSpotifyData(uri, user)
            if (!data) {
                logError(itemLog, `Spotify data could not be loaded`)
                continue;
            }

            //////////////////////////////////////
            // Load music search configuration and search
            //////////////////////////////////////
            const musicSearchConfig = await getMusicSearchConfig();

            const { searchApproaches } = musicSearchConfig;
            if (!searchApproaches || searchApproaches.length === 0)
                throw new Error(`Search approaches not found`)

            const plexConfig = {
                uri: settings.uri,
                token: settings.token,
                musicSearchConfig,
                searchApproaches
            };
            const result = await searchAlbum(plexConfig, data.tracks);

            //@ts-ignore
            const { add } = await getCachedPlexTracks(plexConfig, data);

            const missingTracks = data.tracks.filter(item => {
                const { title: trackTitle, artists: trackArtists } = item;

                return result.some((track: SearchResponse) => track.title == trackTitle && trackArtists.indexOf(track.artist) > - 1 && track.result.length == 0)
            })

            // Check if album is complete (no missing tracks)
            const albumComplete = !result.some((item: SearchResponse) => item.result.length == 0);

            if (albumComplete) {
                if (shouldUpdateCache) {
                    logComplete(itemLog);
                    // Store album id
                    add(result, 'plex', { id: data.id })
                }
                continue;
            }

            // Album has missing tracks - always collect for SLSKD/Lidarr
            if (!missingSpotifyAlbums.includes(data.id))
                missingSpotifyAlbums.push(data.id)

            console.log(`Some tracks on the album seem to be missing ${data.tracks.length}/ ${missingTracks.length}: ${data.title}`)
            const tidalIds = await findMissingTidalAlbums(missingTracks)
            tidalIds.forEach(tidalId => {
                if (!missingTidalAlbums.includes(tidalId))
                    missingTidalAlbums.push(tidalId)
            })

            // Collect unique albums for Lidarr
            missingTracks.forEach(track => {
                // Skip tracks with unknown album_id (defensive check)
                if (track.album_id === 'unknown') {
                    console.log(`⚠️  Skipping track with unknown album_id: ${track.title} by ${track.artists[0]}`);

                    return;
                }

                const artist = track.artists[0] || 'Unknown Artist';
                const album = track.album || 'Unknown Album';
                const key = `${artist}|${album}`;

                // Check if album already exists in the array
                if (!missingAlbumsLidarr.some(item => `${item.artist_name}|${item.album_name}` === key)) {
                    missingAlbumsLidarr.push({
                        artist_name: artist,
                        album_name: album,
                        spotify_album_id: data.id
                    });
                }
            });

            // Collect track data for SLSKD
            missingTracks.forEach(track => {
                if (!track.id) return; // Skip tracks with null id (local files/unavailable)
                const spotifyId = track.id.indexOf(":") > -1 ? track.id.split(":")[2] : track.id;
                const artist = track.artists[0] || 'Unknown Artist';
                const trackName = track.title || 'Unknown Track';
                const album = track.album || 'Unknown Album';
                const key = `${spotifyId}`;

                // Check if track already exists in the array
                if (spotifyId && !missingTracksSlskd.some(item => item.spotify_id === key)) {
                    missingTracksSlskd.push({
                        spotify_id: spotifyId,
                        artist_name: artist,
                        track_name: trackName,
                        album_name: album
                    });
                }
            });

            /////////////////////////////
            // Store logs (only mark complete if cache was updated)
            /////////////////////////////
            if (shouldUpdateCache) {
                logComplete(itemLog)
            }
        }

        // Store the missing albums and tracks after processing all albums (moved outside loop)
        writeFileSync(join(getStorageDir(), 'missing_albums_spotify.txt'), missingSpotifyAlbums.map(id => `https://open.spotify.com/album/${id}`).join('\n'))
        writeFileSync(join(getStorageDir(), 'missing_albums_tidal.txt'), missingTidalAlbums.map(id => `https://tidal.com/browse/album/${id}`).join('\n'))
        writeFileSync(join(getStorageDir(), 'missing_albums_lidarr.json'), JSON.stringify(missingAlbumsLidarr, null, 2))

        // Merge with existing slskd tracks (written by playlists.ts, which runs before this)
        const slskdPath = join(getStorageDir(), 'missing_tracks_slskd.json');
        let existingSlskdTracks: SlskdTrackData[] = [];
        if (existsSync(slskdPath)) {
            try {
                existingSlskdTracks = JSON.parse(readFileSync(slskdPath, 'utf8'));
            } catch (_e) { /* start fresh if parse fails */ }
        }
        const mergedSlskdTracks = [...existingSlskdTracks];
        for (const track of missingTracksSlskd) {
            if (!mergedSlskdTracks.some(t => t.spotify_id === track.spotify_id)) {
                mergedSlskdTracks.push(track);
            }
        }
        writeFileSync(slskdPath, JSON.stringify(mergedSlskdTracks, null, 2));

        // Generate missing_tracks_ytdlp.json based on fallback_only setting
        const ytdlpSettings = await getYtdlpSettings();
        let missingTracksYtdlp = mergedSlskdTracks;

        if (ytdlpSettings.enabled && ytdlpSettings.fallback_only) {
            // Filter to only include tracks that SLSKD couldn't find
            const slskdLogPath = join(getStorageDir(), 'slskd_sync_log.json');
            if (existsSync(slskdLogPath)) {
                const slskdLogsRaw: Record<string, SlskdSyncLog> = JSON.parse(readFileSync(slskdLogPath, 'utf8'));
                const slskdLogs = Object.values(slskdLogsRaw);

                // Build set of tracks that SLSKD didn't find
                const notFoundInSlskd = new Set(
                    slskdLogs
                        .filter((log) => log.status === 'not_found')
                        .map((log) => `${log.artist_name}||${log.track_name}`)
                );

                // Filter ytdlp tracks to only include those not found by SLSKD
                missingTracksYtdlp = mergedSlskdTracks.filter(track => {
                    const trackKey = `${track.artist_name}||${track.track_name}`;
                    return notFoundInSlskd.has(trackKey);
                });

                console.log(`YT-DLP fallback mode: ${missingTracksYtdlp.length} tracks not found by SLSKD (out of ${mergedSlskdTracks.length} total missing tracks)`);
            } else {
                console.log('YT-DLP fallback mode enabled but no SLSKD log found, including all missing tracks');
            }
        }

        // Merge with existing ytdlp tracks (written by playlists.ts, which runs before this)
        const ytdlpPath = join(getStorageDir(), 'missing_tracks_ytdlp.json');
        let existingYtdlpTracks: SlskdTrackData[] = [];
        if (existsSync(ytdlpPath)) {
            try {
                existingYtdlpTracks = JSON.parse(readFileSync(ytdlpPath, 'utf8'));
            } catch (_e) { /* start fresh if parse fails */ }
        }
        const mergedYtdlpTracks = [...existingYtdlpTracks];
        for (const track of missingTracksYtdlp) {
            if (!mergedYtdlpTracks.some(t => t.spotify_id === track.spotify_id)) {
                mergedYtdlpTracks.push(track);
            }
        }
        writeFileSync(ytdlpPath, JSON.stringify(mergedYtdlpTracks, null, 2));

        // Mark sync as complete
        completeSyncType('albums');
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown error';
        errorSyncType('albums', message);
        throw e;
    }
}


function run() {
    console.log(`Start syncing items`)
    syncAlbums()
        .then(() => {
            console.log(`Sync complete`)
        })
        .catch((e: unknown) => {
            console.log(e)
        })
}

// Only run if this file is executed directly, not when imported
// eslint-disable-next-line unicorn/prefer-module
if (require.main === module) {
    run();
}