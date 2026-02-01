import { YtdlpClient } from "@spotify-to-plex/shared-utils/ytdlp/client";
import { getYtdlpSettings } from "@spotify-to-plex/plex-config/functions/getYtdlpSettings";
import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';
import { generateError } from '@/helpers/errors/generateError';

type SendTrackRequest = {
    title: string;
    artist: string;
    album?: string;
};

type SendTrackResponse = {
    success: boolean;
    message: string;
    task_id?: string;
};

const router = createRouter<NextApiRequest, NextApiResponse<SendTrackResponse>>()
    .post(async (req, res) => {
        try {
            const { title, artist, album } = req.body as SendTrackRequest;

            console.log('[YT-DLP Send] Received request:', { title, artist, album });

            if (!title || !artist) {
                console.log('[YT-DLP Send] Missing required fields');
                return res.status(200).json({
                    success: false,
                    message: 'Title and artist are required'
                });
            }

            // Get settings
            const settings = await getYtdlpSettings();

            if (!settings.enabled) {
                return res.status(200).json({
                    success: false,
                    message: 'YT-DLP is not enabled'
                });
            }

            if (!settings.api_url || !settings.api_key) {
                return res.status(200).json({
                    success: false,
                    message: 'YT-DLP is not configured'
                });
            }

            // Create client and download track
            console.log('[YT-DLP Send] Creating YtdlpClient...');
            const client = new YtdlpClient(settings.api_url, settings.api_key);

            // Generate YouTube search URL
            // yt-dlp-host only accepts direct URLs, so we construct a YouTube search URL
            // that yt-dlp will use to find the best matching video
            const searchQuery = `${artist} - ${title}`;
            const youtubeUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;

            console.log('[YT-DLP Send] Initiating download with YouTube search:', searchQuery);
            const downloadResp = await client.download({
                url: youtubeUrl,
                audio_format: settings.audio_format,
                output_format: settings.audio_container,
                filename: `${artist} - ${title}`, // Filename without extension
            });

            if (!downloadResp.task_id) {
                throw new Error("No task ID returned from download request");
            }

            console.log('[YT-DLP Send] Download initiated:', downloadResp.task_id);

            res.status(200).json({
                success: true,
                message: `Track queued for download: ${artist} - ${title}`,
                task_id: downloadResp.task_id
            });

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('[YT-DLP Send] Error:', errorMessage);
            res.status(200).json({
                success: false,
                message: errorMessage,
            });
        }
    });

export default router.handler({
    onError: (err: unknown, req: NextApiRequest, res: NextApiResponse) => {
        generateError(req, res, "YT-DLP Send Track", err);
    }
});
