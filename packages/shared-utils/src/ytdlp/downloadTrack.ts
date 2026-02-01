import type { SlskdTrackData } from '@spotify-to-plex/shared-types/slskd/SlskdTrackData';
import { YtdlpClient } from './client';
import { YtdlpDownloadResponse } from './types';
import { generateYoutubeQuery } from './generateYoutubeQuery';

/**
 * Download a track from YouTube via yt-dlp-host
 * @param client YtdlpClient instance
 * @param track Track data containing artist and track name
 * @param options Download options including format and optional custom filename
 * @returns Download response with task ID and status
 */
export async function downloadTrack(
    client: YtdlpClient,
    track: SlskdTrackData,
    options: {
        audio_format?: string;
        audio_container?: string;
        filename?: string; // Optional: custom filename without extension
    } = {}
): Promise<YtdlpDownloadResponse> {
    const query = generateYoutubeQuery(track);

    const response = await client.download({
        url: query,
        audio_format: options.audio_format,
        output_format: options.audio_container,
        filename: options.filename, // Pass custom filename to yt-dlp-host
    });

    return response;
}
