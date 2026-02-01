import type { SlskdTrackData } from '@spotify-to-plex/shared-types/slskd/SlskdTrackData';

/**
 * Generate a YouTube search query from track metadata
 * Uses ytsearch: prefix which tells yt-dlp to search YouTube for the track
 * yt-dlp will find the first matching video from the search results
 */
export function generateYoutubeQuery(track: SlskdTrackData): string {
    return `ytsearch1:${track.artist_name} - ${track.track_name}`;
}
