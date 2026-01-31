import type { SlskdTrackData } from '@spotify-to-plex/shared-types/slskd/SlskdTrackData';
import { YtdlpClient } from './client';
import { YtdlpDownloadResponse } from './types';
import { generateYoutubeQuery } from './generateYoutubeQuery';

/**
 * Download a track from YouTube via yt-dlp-host
 */
export async function downloadTrack(
    client: YtdlpClient,
    track: SlskdTrackData,
    options: {
        audio_format?: string;
        audio_container?: string;
    } = {}
): Promise<YtdlpDownloadResponse> {
    const query = generateYoutubeQuery(track);

    const response = await client.download({
        url: query,
        audio_format: options.audio_format,
        output_format: options.audio_container,
    });

    return response;
}
