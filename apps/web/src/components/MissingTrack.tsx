import { GetTidalTracksResponse } from "@/pages/api/tidal";
import { Alert, Box, Button, Divider, Typography } from "@mui/material";
import { Track } from "@spotify-to-plex/shared-types/spotify/Track";
import axios from "axios";
import { forwardRef, useCallback, useImperativeHandle, useMemo, useState } from "react";

type MissingTrackProps = {
    readonly track: Track;
    readonly tidalTrack?: GetTidalTracksResponse;
    readonly slskdEnabled: boolean;
    readonly ytdlpEnabled?: boolean;
}

export type MissingTrackHandle = {
    sendToSlskd: () => Promise<{ success: boolean; message: string }>;
    sendToYtdlp: () => Promise<{ success: boolean; message: string }>;
}

const MissingTrack = forwardRef<MissingTrackHandle, MissingTrackProps>((props, ref) => {
    const { track, tidalTrack, slskdEnabled, ytdlpEnabled } = props;

    // Local state for SLSKD operations
    const [isSending, setIsSending] = useState(false);
    const [isSendingToYtdlp, setIsSendingToYtdlp] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string }>();
    const [ytdlpResult, setYtdlpResult] = useState<{ success: boolean; message: string }>();

    // Determine if track title should be colored warning (missing Tidal track)
    const hasMissingTidalTrack = !!tidalTrack && !!tidalTrack.tidal_ids && tidalTrack.tidal_ids.length === 0;

    // Handle sending to SLSKD - now returns a promise
    const sendToSlskd = useCallback(async (): Promise<{ success: boolean; message: string }> => {
        setIsSending(true);

        try {
            const response = await axios.post<{ success: boolean; message: string }>(
                '/api/slskd/send-track',
                {
                    id: track.id,
                    title: track.title,
                    artist: track.artists[0] || 'Unknown Artist',
                    album: track.album,
                    duration: 0
                }
            );

            setResult(response.data);
            setIsSending(false);

            return response.data;
        } catch (_e) {
            const errorResult = { success: false, message: 'Failed to send to SLSKD' };
            setResult(errorResult);
            setIsSending(false);

            return errorResult;
        }
    }, [track]);

    const onSendToSlskdClick = useCallback(() => {
        sendToSlskd();
    }, [sendToSlskd]);

    // Handle sending to YT-DLP - now returns a promise
    const sendToYtdlp = useCallback(async (): Promise<{ success: boolean; message: string }> => {
        setIsSendingToYtdlp(true);

        try {
            const response = await axios.post<{ success: boolean; message: string }>(
                '/api/ytdlp/send-track',
                {
                    title: track.title,
                    artist: track.artists[0] || 'Unknown Artist',
                    album: track.album
                }
            );

            setYtdlpResult(response.data);
            setIsSendingToYtdlp(false);

            return response.data;
        } catch (_e) {
            const errorResult = { success: false, message: 'Failed to send to YT-DLP' };
            setYtdlpResult(errorResult);
            setIsSendingToYtdlp(false);

            return errorResult;
        }
    }, [track]);

    const onSendToYtdlpClick = useCallback(() => {
        sendToYtdlp();
    }, [sendToYtdlp]);

    // Expose sendToSlskd and sendToYtdlp via ref
    useImperativeHandle(ref, () => ({
        sendToSlskd,
        sendToYtdlp
    }), [sendToSlskd, sendToYtdlp]);

    const spotifyId = useMemo(()=>{
        return track.id.replace('spotify:track:', '');
    }, [track.id]);

    return (
        <>
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    '& .btn': { visibility: isSending ? 'visible' : 'hidden' },
                    '&:hover .btn': { visibility: 'visible' },
                    gap: 1,
                    mb: 1
                }}
            >
                <Box>
                    <Typography variant="body2" color={hasMissingTidalTrack ? 'warning' : undefined}>
                        {track.title}
                    </Typography>
                    <Typography variant="caption">{track.artists.join(', ')}</Typography>
                </Box>

                <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    {/* SLSKD Button */}
                    {!!slskdEnabled && (
                        <Box>
                            <Button
                                onClick={onSendToSlskdClick}
                                disabled={isSending}
                                className="btn"
                                color="primary"
                                variant="outlined"
                                size="small"
                                sx={{ fontSize: '.8em' }}
                            >
                                {isSending ? 'Sending...' : 'Send to SLSKD'}
                            </Button>
                        </Box>
                    )}

                    {/* YT-DLP Button */}
                    {!!ytdlpEnabled && (
                        <Box>
                            <Button
                                onClick={onSendToYtdlpClick}
                                disabled={isSendingToYtdlp}
                                className="btn"
                                color="success"
                                variant="outlined"
                                size="small"
                                sx={{ fontSize: '.8em' }}
                            >
                                {isSendingToYtdlp ? 'Sending...' : 'Send to YT-DLP'}
                            </Button>
                        </Box>
                    )}

                    {/* Tidal Button */}
                    {!!tidalTrack && !!tidalTrack.tidal_ids && tidalTrack.tidal_ids.length > 0 && (
                        <Box>
                            <Button
                                component="a"
                                href={`https://tidal.com/browse/track/${tidalTrack.tidal_ids[0]}`}
                                target="_blank"
                                className="btn"
                                color="inherit"
                                variant="outlined"
                                size="small"
                                sx={{ fontSize: '.8em' }}
                            >
                                Tidal
                            </Button>
                        </Box>
                    )}

                    {/* Spotify Button */}
                    <Box>
                        <Button
                            component="a"
                            href={`https://open.spotify.com/track/${spotifyId}`}
                            target="_blank"
                            className="btn"
                            color="inherit"
                            variant="outlined"
                            size="small"
                            sx={{ fontSize: '.8em' }}
                        >
                            Spotify
                        </Button>
                    </Box>
                </Box>
            </Box>

            {/* Result Alert */}
            {result ? <Alert severity={result.success ? 'success' : 'error'} sx={{ mt: 1, fontSize: '.85em' }}>
                {result.message}
            </Alert> : null}

            {/* YT-DLP Result Alert */}
            {ytdlpResult ? <Alert severity={ytdlpResult.success ? 'success' : 'error'} sx={{ mt: 1, fontSize: '.85em' }}>
                {ytdlpResult.message}
            </Alert> : null}

            <Divider sx={{ mt: 1, mb: 1 }} />
        </>
    );
});

MissingTrack.displayName = 'MissingTrack';

export default MissingTrack;
