import type { YtdlpSettings } from '../types/YtdlpSettings';
import { readJSON } from '../utils/fileUtils';

const DEFAULT_SETTINGS: YtdlpSettings = {
    enabled: false,
    api_url: 'http://ytdlp-api:5000',
    api_key: '',
    audio_format: 'bestaudio',
    audio_container: 'mp3',
    max_bitrate: 320,
    max_file_size: 0,
    max_download_time: 600,
    poll_interval: 5,
    poll_max_attempts: 120,
    retry_limit: 2,
    auto_sync: false,
    fallback_only: true,
};

export async function getYtdlpSettings(): Promise<YtdlpSettings> {
    const settings = await readJSON<YtdlpSettings>('ytdlp.json');

    if (!settings) {
        return DEFAULT_SETTINGS;
    }

    return { ...DEFAULT_SETTINGS, ...settings };
}
