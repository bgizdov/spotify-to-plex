import { YtdlpClient } from './client';
import { YtdlpStatusResponse } from './types';

/**
 * Check the status of a single download task
 */
export async function checkDownloadStatus(
    client: YtdlpClient,
    taskId: string
): Promise<YtdlpStatusResponse> {
    return await client.status(taskId);
}
