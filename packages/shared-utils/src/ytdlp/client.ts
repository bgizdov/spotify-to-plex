import axios, { AxiosInstance } from 'axios';
import {
    YtdlpDownloadRequest,
    YtdlpDownloadResponse,
    YtdlpStatusResponse,
    YtdlpHealthResponse,
    YtdlpSearchResponse,
} from './types';

export class YtdlpClient {
    private client: AxiosInstance;
    private apiUrl: string;

    constructor(apiUrl: string, apiKey: string) {
        this.apiUrl = apiUrl;

        this.client = axios.create({
            baseURL: apiUrl,
            headers: {
                'X-API-Key': apiKey,
                'Content-Type': 'application/json',
            },
            timeout: 10000,
        });
    }

    /**
     * Check health status of yt-dlp-host by validating API key
     */
    async health(): Promise<YtdlpHealthResponse> {
        try {
            console.log('[YtdlpClient] health() - Calling POST /check_permissions');
            console.log('[YtdlpClient] health() - API URL:', this.apiUrl);

            const { data } = await this.client.post('/check_permissions', {
                permissions: ['get_audio']
            });

            console.log('[YtdlpClient] health() - Response data:', data);

            return {
                status: 'healthy',
                version: data.version || 'unknown',
                active_downloads: 0,
                queue_size: 0,
                uptime_seconds: 0,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('[YtdlpClient] health() - Error:', errorMessage);
            if (error instanceof Error && 'response' in error) {
                console.error('[YtdlpClient] health() - Response status:', (error as any).response?.status);
                console.error('[YtdlpClient] health() - Response data:', (error as any).response?.data);
            }
            throw new Error(`Failed to connect to yt-dlp-host at ${this.apiUrl}: ${errorMessage}`);
        }
    }

    /**
     * Initiate a download
     */
    async download(request: YtdlpDownloadRequest): Promise<YtdlpDownloadResponse> {
        const { data } = await this.client.post<YtdlpDownloadResponse>(
            '/get_audio',
            request
        );
        return data;
    }

    /**
     * Check the status of a download task
     */
    async status(taskId: string): Promise<YtdlpStatusResponse> {
        const { data } = await this.client.get<YtdlpStatusResponse>(
            `/status/${taskId}`
        );
        return data;
    }

    /**
     * Search YouTube for a video matching the query
     */
    async search(query: string): Promise<YtdlpSearchResponse> {
        const { data } = await this.client.post<YtdlpSearchResponse>(
            '/search',
            { query }
        );
        return data;
    }
}
