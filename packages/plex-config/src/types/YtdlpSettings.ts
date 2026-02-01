export type YtdlpSettings = {
    enabled: boolean;
    api_url: string;
    api_key: string;
    audio_format: 'bestaudio' | 'best' | 'worstaudio' | 'm4a' | 'opus' | 'vorbis' | 'wav';
    audio_container: 'mp3' | 'm4a' | 'opus' | 'vorbis' | 'wav' | 'webm';
    poll_interval: number;
    poll_max_attempts: number;
    retry_limit: number;
    auto_sync: boolean;
    fallback_only: boolean;
};
