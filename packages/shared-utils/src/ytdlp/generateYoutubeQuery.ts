import type { SlskdTrackData } from '@spotify-to-plex/shared-types/slskd/SlskdTrackData';

/**
 * Generate a YouTube search query from track metadata
 * Uses ytsearch: prefix which tells yt-dlp to search YouTube for the query
 * The quotes help yt-dlp find exact matches by prioritizing the artist - track pattern
 */
export function generateYoutubeQuery(track: SlskdTrackData): string {
    return `ytsearch:"${track.artist_name} - ${track.track_name}"`;
}
