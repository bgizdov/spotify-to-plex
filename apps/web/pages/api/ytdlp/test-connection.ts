import { generateError } from '@/helpers/errors/generateError';
import { YtdlpClient } from '@spotify-to-plex/shared-utils/ytdlp/client';
import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';

const router = createRouter<NextApiRequest, NextApiResponse>()
    .post(async (req, res) => {
        try {
            const { api_url, api_key } = req.body;

            if (!api_url) {
                return res.status(200).json({
                    success: false,
                    message: 'API URL is required'
                });
            }

            if (!api_key) {
                return res.status(200).json({
                    success: false,
                    message: 'API key is required'
                });
            }

            // Test connection to YT-DLP server
            const client = new YtdlpClient(api_url, api_key);

            const health = await client.health();

            res.status(200).json({
                success: true,
                message: 'Connected successfully to YT-DLP',
                health
            });

        } catch (error) {
            console.error('YT-DLP connection test failed:', error);
            res.status(200).json({
                success: false,
                message: error instanceof Error ? error.message : 'Connection failed'
            });
        }
    });

export default router.handler({
    onError: (err: unknown, req: NextApiRequest, res: NextApiResponse) => {
        generateError(req, res, "YT-DLP Test Connection", err);
    }
});
