// yt-dlp-host API request/response types

export type YtdlpDownloadRequest = {
    url: string;
    audio_format?: string;
    output_format?: string;
    filename?: string; // Optional custom filename without extension
};

export type YtdlpDownloadResponse = {
    status: 'waiting' | 'downloading' | 'completed' | 'error';
    task_id: string;
    message?: string;
    error?: string;
};

export type YtdlpStatusResponse = {
    status: 'waiting' | 'downloading' | 'completed' | 'error';
    task_id: string;
    progress?: {
        current: number;
        total: number;
        percentage: number;
    };
    file?: {
        path: string;
        size: number;
        url: string;
        title: string;
        duration?: number;
    };
    error?: string;
};

export type YtdlpHealthResponse = {
    status: 'healthy' | 'unhealthy';
    version: string;
    active_downloads: number;
    queue_size: number;
    uptime_seconds: number;
};

export type YtdlpDownloadTask = {
    id: string;
    task_id: string;
    artist: string;
    track: string;
    album?: string;
    spotify_id?: string;
    youtube_query: string;
    youtube_url?: string;
    started_at: number;
    last_poll: number;
    poll_count: number;
    retry_count: number;
    status: 'pending' | 'downloading' | 'completed' | 'failed';
};
