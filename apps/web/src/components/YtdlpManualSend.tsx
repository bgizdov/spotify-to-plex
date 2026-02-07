import { errorBoundary } from "@/helpers/errors/errorBoundary";
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
    IconButton,
} from "@mui/material";
import DeleteIcon from '@mui/icons-material/Delete';
import SendIcon from '@mui/icons-material/Send';
import RefreshIcon from '@mui/icons-material/Refresh';
import axios from "axios";
import { useCallback, useEffect, useState } from "react";

type SlskdTrackData = {
    spotify_id: string;
    artist_name: string;
    track_name: string;
    album_name?: string;
};

type TrackEntry = SlskdTrackData & {
    _id: string;
    status?: 'idle' | 'sending' | 'success' | 'error';
    message?: string;
};

export default function YtdlpManualSend() {
    const [tracks, setTracks] = useState<TrackEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState<Record<string, boolean>>({});
    const [success, setSuccess] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fetchMissingTracks = useCallback(async () => {
        setLoading(true);
        setError(null);

        await errorBoundary(async () => {
            const response = await axios.get('/api/ytdlp/missing-tracks');
            const fetchedTracks: SlskdTrackData[] = response.data.tracks;

            if (!Array.isArray(fetchedTracks)) {
                setTracks([]);
                setLoading(false);
                return;
            }

            const tracksWithIds = fetchedTracks.map((track, index) => ({
                ...track,
                _id: `${track.spotify_id}-${index}`,
                status: 'idle' as const
            }));

            setTracks(tracksWithIds);
            setLoading(false);
        }, (err: unknown) => {
            const message = err instanceof Error ? err.message : 'Failed to fetch missing tracks';
            setError(message);
            setTracks([]);
            setLoading(false);
        });
    }, []);

    useEffect(() => {
        fetchMissingTracks();
    }, [fetchMissingTracks]);

    const handleSendTrack = useCallback(async (track: TrackEntry) => {
        setSending(prev => ({ ...prev, [track._id]: true }));

        await errorBoundary(async () => {
            const response = await axios.post('/api/ytdlp/send-track', {
                id: track.spotify_id,
                title: track.track_name,
                artist: track.artist_name,
                album: track.album_name
            });

            setTracks(prev => prev.map(t => {
                if (t._id === track._id) {
                    return {
                        ...t,
                        status: 'success',
                        message: `Queued: ${response.data.video?.title || 'Unknown'}`
                    };
                }
                return t;
            }));

            setSending(prev => ({ ...prev, [track._id]: false }));
            setSuccess(`Track queued: ${track.track_name}`);
            setTimeout(() => setSuccess(null), 3000);
        }, (err: unknown) => {
            const message = err instanceof Error ? err.message : 'Unknown error';
            setTracks(prev => prev.map(t => {
                if (t._id === track._id) {
                    return {
                        ...t,
                        status: 'error',
                        message: message
                    };
                }
                return t;
            }));
            setSending(prev => ({ ...prev, [track._id]: false }));
            setError(`Failed to send ${track.track_name}: ${message}`);
        });
    }, []);

    const handleSendAll = useCallback(async () => {
        const idleTracks = tracks.filter(t => t.status === 'idle' || t.status === 'error');

        if (idleTracks.length === 0) {
            setError('No tracks to send');
            return;
        }

        for (const track of idleTracks) {
            await handleSendTrack(track);
            // Add delay between requests to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }, [tracks, handleSendTrack]);

    const handleRemoveTrack = useCallback((trackId: string) => {
        setTracks(prev => prev.filter(t => t._id !== trackId));
    }, []);

    const handleClearCompleted = useCallback(() => {
        setTracks(prev => prev.filter(t => t.status === 'idle' || t.status === 'error'));
    }, []);

    const idleTracks = tracks.filter(t => t.status === 'idle' || t.status === 'error');
    const completedTracks = tracks.filter(t => t.status === 'success');

    if (loading) {
        return (
            <Paper elevation={0} sx={{ p: 3, bgcolor: 'action.hover' }}>
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                    <CircularProgress />
                </Box>
            </Paper>
        );
    }

    return (
        <Box>
            <Paper elevation={0} sx={{ p: 3, bgcolor: 'action.hover' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box>
                        <Typography variant="h6" sx={{ mb: 0.5 }}>
                            Manual YT-DLP Send
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Queue missing tracks for download from YouTube
                        </Typography>
                    </Box>
                    <Button
                        variant="outlined"
                        startIcon={<RefreshIcon />}
                        onClick={fetchMissingTracks}
                    >
                        Refresh
                    </Button>
                </Box>

                {!!success &&
                    <Alert severity="success" sx={{ mb: 2 }}>
                        {success}
                    </Alert>
                }

                {!!error &&
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                }

                {tracks.length === 0 ? (
                    <Alert severity="info">
                        No missing tracks to download. All tracks have been found or downloaded.
                    </Alert>
                ) : (
                    <>
                        <TableContainer sx={{ mb: 2 }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ bgcolor: 'action.selected' }}>
                                        <TableCell>Artist</TableCell>
                                        <TableCell>Track</TableCell>
                                        <TableCell>Album</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell align="right">Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {tracks.map(track => (
                                        <TableRow key={track._id}>
                                            <TableCell>{track.artist_name}</TableCell>
                                            <TableCell>{track.track_name}</TableCell>
                                            <TableCell>{track.album_name || '-'}</TableCell>
                                            <TableCell>
                                                <Typography variant="body2">
                                                    {track.status === 'idle' && <span>Ready</span>}
                                                    {track.status === 'sending' && <CircularProgress size={16} />}
                                                    {track.status === 'success' && (
                                                        <span style={{ color: 'green' }}>✓ {track.message}</span>
                                                    )}
                                                    {track.status === 'error' && (
                                                        <span style={{ color: 'red' }}>✗ {track.message}</span>
                                                    )}
                                                </Typography>
                                            </TableCell>
                                            <TableCell align="right">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleSendTrack(track)}
                                                    disabled={track.status === 'sending' || track.status === 'success'}
                                                    color={track.status === 'success' ? 'success' : 'primary'}
                                                >
                                                    {track.status === 'sending' ? (
                                                        <CircularProgress size={20} />
                                                    ) : (
                                                        <SendIcon />
                                                    )}
                                                </IconButton>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleRemoveTrack(track._id)}
                                                    disabled={track.status === 'sending'}
                                                >
                                                    <DeleteIcon />
                                                </IconButton>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>

                        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                            {idleTracks.length > 0 && (
                                <Button
                                    variant="contained"
                                    color="primary"
                                    onClick={handleSendAll}
                                    startIcon={<SendIcon />}
                                >
                                    Send All ({idleTracks.length})
                                </Button>
                            )}

                            {completedTracks.length > 0 && (
                                <Button
                                    variant="outlined"
                                    onClick={handleClearCompleted}
                                >
                                    Clear Completed ({completedTracks.length})
                                </Button>
                            )}
                        </Box>
                    </>
                )}
            </Paper>
        </Box>
    );
}
