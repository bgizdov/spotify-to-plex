import type { SlskdTrackData } from '@spotify-to-plex/shared-types/slskd/SlskdTrackData';

/**
 * Generate a YouTube search query from track metadata
 * Format: "artist - track" which is optimized for music searches
 */
export function generateYoutubeQuery(track: SlskdTrackData): string {
    return `${track.artist_name} - ${track.track_name}`;
}
