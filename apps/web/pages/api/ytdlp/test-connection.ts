import { generateError } from '@/helpers/errors/generateError';
import { YtdlpClient } from '@spotify-to-plex/shared-utils/ytdlp/client';
import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';

const router = createRouter<NextApiRequest, NextApiResponse>()
    .post(async (req, res) => {
        try {
            const { api_url, api_key } = req.body;

            console.log('[YT-DLP Test] Received request:', { api_url, has_api_key: !!api_key });

            if (!api_url) {
                console.log('[YT-DLP Test] Missing API URL');
                return res.status(200).json({
                    success: false,
                    message: 'API URL is required'
                });
            }

            if (!api_key) {
                console.log('[YT-DLP Test] Missing API key');
                return res.status(200).json({
                    success: false,
                    message: 'API key is required'
                });
            }

            // Test connection to YT-DLP server
            console.log('[YT-DLP Test] Creating YtdlpClient...');
            const client = new YtdlpClient(api_url, api_key);

            console.log('[YT-DLP Test] Calling health() endpoint...');
            const health = await client.health();

            console.log('[YT-DLP Test] Health check successful:', health);
            res.status(200).json({
                success: true,
                message: 'Connected successfully to YT-DLP',
                health
            });

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('[YT-DLP Test] Connection failed:', errorMessage);
            console.error('[YT-DLP Test] Full error:', error);
            res.status(200).json({
                success: false,
                message: errorMessage,
                debug: {
                    error_type: error instanceof Error ? error.constructor.name : typeof error,
                    timestamp: new Date().toISOString()
                }
            });
        }
    });

export default router.handler({
    onError: (err: unknown, req: NextApiRequest, res: NextApiResponse) => {
        generateError(req, res, "YT-DLP Test Connection", err);
    }
});
