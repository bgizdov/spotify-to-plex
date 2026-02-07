import { generateError } from '@/helpers/errors/generateError';
import axios from 'axios';
import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';

type SendTrackRequest = {
    id: string;
    title: string;
    artist: string;
    album?: string;
    duration?: number;
};

type YtdlpSearchResponse = {
    success: boolean;
    url?: string;
    title?: string;
    duration?: number;
    id?: string;
};

type YtdlpQueueResponse = {
    success: boolean;
    message?: string;
    [key: string]: any;
};

const router = createRouter<NextApiRequest, NextApiResponse>()
    .post(async (req, res) => {
        try {
            // Validate input
            const { id, title, artist, album, duration } = req.body as SendTrackRequest;

            if (!id || !title || !artist) {
                return res.status(400).json({
                    error: 'Missing required fields: id, title, artist'
                });
            }

            // Get settings from environment
            const apiUrl = process.env.YTDLP_API_URL;
            const apiKey = process.env.YTDLP_API_KEY;

            if (!apiUrl) {
                return res.status(400).json({ error: 'YT-DLP API URL is not configured' });
            }

            if (!apiKey) {
                return res.status(400).json({ error: 'YT-DLP API key is not configured' });
            }

            const searchQuery = `${artist} - ${title}`;
            console.log(`[YT-DLP] Searching for track: ${searchQuery}`);

            // Step 1: Search for the track
            let searchResult: YtdlpSearchResponse;
            try {
                const searchResponse = await axios.post<YtdlpSearchResponse>(
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
                    console.log(`[YT-DLP] Search failed: ${searchQuery}`);
                    return res.status(404).json({
                        error: 'No results found for this track'
                    });
                }

                searchResult = searchResponse.data;
                console.log(`[YT-DLP] Found video: ${searchResult.title} (${searchResult.id})`);
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                console.error('[YT-DLP] Failed to search:', error);

                if (axios.isAxiosError(error) && error.response?.status === 404) {
                    return res.status(404).json({
                        error: 'No results found for this track'
                    });
                }

                return res.status(500).json({
                    error: `Failed to search YouTube: ${errorMsg}`
                });
            }

            // Step 2: Queue the video for download
            try {
                const queueResponse = await axios.post<QueueResponse>(
                    `${apiUrl}/queue`,
                    {
                        url: searchResult.url,
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
                    console.log(`[YT-DLP] Failed to queue download`);
                    return res.status(500).json({
                        error: 'Failed to queue download'
                    });
                }

                console.log(`[YT-DLP] Successfully queued: ${searchResult.title}`);

                // Success response
                return res.status(200).json({
                    success: true,
                    message: 'Track queued for download',
                    track: {
                        title,
                        artist,
                        album
                    },
                    video: {
                        title: searchResult.title,
                        url: searchResult.url,
                        duration: searchResult.duration,
                        id: searchResult.id
                    }
                });
            } catch (error) {
                const errorMsg = error instanceof Error ? error.message : 'Unknown error';
                console.error('[YT-DLP] Failed to queue download:', error);

                return res.status(500).json({
                    error: `Failed to queue download: ${errorMsg}`
                });
            }
        } catch (error) {
            console.error('[YT-DLP] Unexpected error in send-track:', error);
            res.status(500).json({
                error: `Failed to send track to YT-DLP: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        }
    });

type QueueResponse = {
    success: boolean;
    [key: string]: any;
};

export default router.handler({
    onError: (err: unknown, req: NextApiRequest, res: NextApiResponse) => {
        generateError(req, res, "YT-DLP Send Track", err);
    }
});
