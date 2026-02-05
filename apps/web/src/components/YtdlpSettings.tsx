import { errorBoundary } from "@/helpers/errors/errorBoundary";
import { Alert, Box, Button, CircularProgress, Divider, FormControlLabel, MenuItem, Select, Switch, TextField, Typography } from "@mui/material";
import { SelectChangeEvent } from "@mui/material";
import axios from "axios";
import { ChangeEvent, useCallback, useEffect, useState } from "react";

type YtdlpSettings = {
    enabled: boolean;
    api_url: string;
    api_key: string;
    audio_format: string;
    audio_container: string;
    poll_interval: number;
    poll_max_attempts: number;
    retry_limit: number;
    auto_sync: boolean;
    fallback_only: boolean;
};

export default function YtdlpSettings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const [settings, setSettings] = useState<YtdlpSettings>({
        enabled: false,
        api_url: 'http://ytdlp-api:5000',
        api_key: '',
        audio_format: 'bestaudio',
        audio_container: 'mp3',
        poll_interval: 5,
        poll_max_attempts: 120,
        retry_limit: 2,
        auto_sync: false,
        fallback_only: true,
    });

    useEffect(() => {
        errorBoundary(async () => {
            // Load settings
            const result = await axios.get<YtdlpSettings>('/api/ytdlp/settings');
            setSettings(result.data);
            setLoading(false);
        }, () => {
            setLoading(false);
        });
    }, []);

    const handleChange = useCallback((field: keyof YtdlpSettings, value: any) => {
        setSettings(prev => ({ ...prev, [field]: value }));
        setTestResult(null);
    }, []);

    const handleSave = useCallback(async () => {
        setSaving(true);
        await errorBoundary(async () => {
            await axios.put('/api/ytdlp/settings', settings);
            setSaving(false);
            // eslint-disable-next-line no-alert
            alert('Settings saved successfully!');
        }, () => {
            setSaving(false);
        });
    }, [settings]);
    const handleSaveClick = useCallback(() => {
        handleSave();
    }, [handleSave]);

    const handleTestConnection = useCallback(async () => {
        setTesting(true);
        setTestResult(null);
        await errorBoundary(async () => {
            const result = await axios.post<{ success: boolean; message: string }>(
                '/api/ytdlp/test-connection',
                { api_url: settings.api_url, api_key: settings.api_key }
            );
            setTestResult(result.data);
            setTesting(false);
        }, (error: unknown) => {
            setTestResult({
                success: false,
                message: error instanceof Error ? error.message : 'Connection failed'
            });
            setTesting(false);
        });
    }, [settings.api_url, settings.api_key]);

    const handleTestConnectionClick = useCallback(() => {
        handleTestConnection();
    }, [handleTestConnection]);

    const handleApiUrlChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        handleChange('api_url', e.target.value);
    }, [handleChange]);

    const handleApiKeyChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        handleChange('api_key', e.target.value);
    }, [handleChange]);

    const handleAudioFormatChange = useCallback((e: SelectChangeEvent<string>) => {
        handleChange('audio_format', e.target.value);
    }, [handleChange]);

    const handleAudioContainerChange = useCallback((e: SelectChangeEvent<string>) => {
        handleChange('audio_container', e.target.value);
    }, [handleChange]);

    const handlePollIntervalChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        handleChange('poll_interval', parseInt(e.target.value, 10));
    }, [handleChange]);

    const handlePollMaxAttemptsChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        handleChange('poll_max_attempts', parseInt(e.target.value, 10));
    }, [handleChange]);

    const handleRetryLimitChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        handleChange('retry_limit', parseInt(e.target.value, 10));
    }, [handleChange]);

    const handleAutoSyncChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        handleChange('auto_sync', e.target.checked);
    }, [handleChange]);

    const handleFallbackOnlyChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        handleChange('fallback_only', e.target.checked);
    }, [handleChange]);

    const handleEnabledChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
        handleChange('enabled', e.target.checked);
    }, [handleChange]);

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box>
            <Typography variant="h6" sx={{ mb: 2 }}>
                YT-DLP Integration
            </Typography>
            <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                Configure yt-dlp-host to automatically download missing tracks from YouTube as a fallback when SLSKD cannot find them.
            </Typography>

            <FormControlLabel control={<Switch checked={settings.enabled} onChange={handleEnabledChange} />} label="Enable YT-DLP Integration" sx={{ mb: 2 }} />

            {settings.enabled ? <>
                {/* Connection Settings */}
                <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
                    Connection
                </Typography>
                <TextField
                    fullWidth
                    label="YT-DLP API URL"
                    placeholder="http://192.168.1.100:5000"
                    value={settings.api_url}
                    onChange={handleApiUrlChange}
                    sx={{ mb: 2 }}
                    helperText="The base URL of your yt-dlp-host instance"
                />

                <TextField
                    fullWidth
                    label="API Key"
                    type="password"
                    placeholder="your-api-key"
                    value={settings.api_key}
                    onChange={handleApiKeyChange}
                    sx={{ mb: 2 }}
                    helperText="API key for authentication"
                />

                <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                    <Button variant="outlined" onClick={handleTestConnectionClick} disabled={testing || !settings.api_url || !settings.api_key}>
                        {testing ? 'Testing...' : 'Test Connection'}
                    </Button>
                </Box>

                {testResult ? <Alert severity={testResult.success ? 'success' : 'error'} sx={{ mb: 3 }}>
                    {testResult.message}
                </Alert> : null}

                <Divider sx={{ mb: 3 }} />

                {/* Audio Settings */}
                <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
                    Audio Settings
                </Typography>

                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                    <Select
                        fullWidth
                        label="Audio Format"
                        value={settings.audio_format}
                        onChange={handleAudioFormatChange}
                    >
                        <MenuItem value="bestaudio">bestaudio (Recommended)</MenuItem>
                        <MenuItem value="best">best</MenuItem>
                        <MenuItem value="worstaudio">worstaudio</MenuItem>
                        <MenuItem value="m4a">m4a</MenuItem>
                        <MenuItem value="opus">opus</MenuItem>
                        <MenuItem value="vorbis">vorbis</MenuItem>
                        <MenuItem value="wav">wav</MenuItem>
                    </Select>

                    <Select
                        fullWidth
                        label="Audio Container"
                        value={settings.audio_container}
                        onChange={handleAudioContainerChange}
                    >
                        <MenuItem value="mp3">mp3 (Recommended)</MenuItem>
                        <MenuItem value="m4a">m4a</MenuItem>
                        <MenuItem value="opus">opus</MenuItem>
                        <MenuItem value="vorbis">vorbis</MenuItem>
                        <MenuItem value="wav">wav</MenuItem>
                        <MenuItem value="webm">webm</MenuItem>
                    </Select>
                </Box>

                <Divider sx={{ mb: 3 }} />

                {/* Download Settings */}
                <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
                    Download Settings
                </Typography>

                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                    <TextField label="Poll Interval (seconds)" type="number" value={settings.poll_interval} onChange={handlePollIntervalChange} sx={{ flex: 1 }} helperText="How often to check download status" />

                    <TextField label="Max Poll Attempts" type="number" value={settings.poll_max_attempts} onChange={handlePollMaxAttemptsChange} sx={{ flex: 1 }} helperText="Maximum status checks before timeout" />

                    <TextField label="Retry Limit" type="number" value={settings.retry_limit} onChange={handleRetryLimitChange} sx={{ flex: 1 }} helperText="Download retry attempts" />
                </Box>

                <Divider sx={{ mb: 3 }} />

                {/* Sync Behavior */}
                <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
                    Sync Behavior
                </Typography>

                <FormControlLabel control={<Switch checked={settings.fallback_only} onChange={handleFallbackOnlyChange} />} label="Fallback Only Mode" sx={{ mb: 1 }} />
                <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                    Only download tracks that SLSKD could not find
                </Typography>

                <FormControlLabel control={<Switch checked={settings.auto_sync} onChange={handleAutoSyncChange} />} label="Enable Automatic Synchronization" sx={{ mb: 2 }} />
                <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                    When enabled, yt-dlp will automatically download missing tracks during daily synchronization.
                </Typography>

                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                    <Button variant="contained" onClick={handleSaveClick} disabled={saving}>
                        {saving ? 'Saving...' : 'Save Settings'}
                    </Button>
                </Box>
            </> : null}
        </Box>
    );
}
