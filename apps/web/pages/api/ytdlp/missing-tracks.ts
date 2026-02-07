import { getStorageDir } from "@spotify-to-plex/shared-utils/utils/getStorageDir";
import { SlskdTrackData } from "@spotify-to-plex/shared-types/slskd/SlskdTrackData";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextApiRequest, NextApiResponse } from 'next';
import { createRouter } from 'next-connect';
import { generateError } from '@/helpers/errors/generateError';

const router = createRouter<NextApiRequest, NextApiResponse>()
    .get(async (req, res) => {
        try {
            const tracksPath = join(getStorageDir(), 'missing_tracks_ytdlp.json');

            if (!existsSync(tracksPath)) {
                return res.status(200).json({
                    tracks: [],
                    count: 0
                });
            }

            const content = readFileSync(tracksPath, 'utf8');
            let tracks: SlskdTrackData[] = [];

            try {
                tracks = JSON.parse(content);
            } catch (_e) {
                console.error('Error parsing missing_tracks_ytdlp.json');
                return res.status(200).json({
                    tracks: [],
                    count: 0
                });
            }

            if (!Array.isArray(tracks)) {
                return res.status(200).json({
                    tracks: [],
                    count: 0
                });
            }

            return res.status(200).json({
                tracks,
                count: tracks.length
            });
        } catch (error) {
            console.error('Error fetching missing tracks:', error);
            return res.status(200).json({
                tracks: [],
                count: 0
            });
        }
    });

export default router.handler({
    onError: (err: unknown, req: NextApiRequest, res: NextApiResponse) => {
        generateError(req, res, "YT-DLP Missing Tracks", err);
    }
});
