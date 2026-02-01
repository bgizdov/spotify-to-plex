import type { SlskdTrackData } from '@spotify-to-plex/shared-types/slskd/SlskdTrackData';

/**
 * Generate a YouTube search URL from track metadata
 * yt-dlp-host only accepts direct URLs, so we construct a YouTube search URL
 * that yt-dlp will use to find the best matching video
 */
export function generateYoutubeQuery(track: SlskdTrackData): string {
    const searchQuery = `${track.artist_name} - ${track.track_name}`;
    return `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
}
