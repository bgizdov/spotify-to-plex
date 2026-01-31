import axios, { AxiosInstance } from 'axios';
import {
    YtdlpDownloadRequest,
    YtdlpDownloadResponse,
    YtdlpStatusResponse,
    YtdlpHealthResponse,
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
     * Check health status of yt-dlp-host
     */
    async health(): Promise<YtdlpHealthResponse> {
        try {
            const { data } = await this.client.get<YtdlpHealthResponse>('/health');
            return data;
        } catch (error) {
            throw new Error(`Failed to connect to yt-dlp-host at ${this.apiUrl}: ${error}`);
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
}
