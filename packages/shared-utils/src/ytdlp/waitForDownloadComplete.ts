import { YtdlpClient } from './client';
import { YtdlpStatusResponse } from './types';
import { checkDownloadStatus } from './checkDownloadStatus';

/**
 * Poll until download completes or times out
 */
export async function waitForDownloadComplete(
    client: YtdlpClient,
    taskId: string,
    options: {
        pollInterval?: number; // seconds
        maxAttempts?: number;
    } = {}
): Promise<YtdlpStatusResponse> {
    const pollInterval = (options.pollInterval ?? 5) * 1000; // default 5 seconds
    const maxAttempts = options.maxAttempts ?? 120; // default 10 minutes

    let status: YtdlpStatusResponse;
    let attempts = 0;

    while (attempts < maxAttempts) {
        status = await checkDownloadStatus(client, taskId);

        if (status.status === 'completed' || status.status === 'error') {
            return status;
        }

        attempts++;
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    throw new Error(
        `Download timeout: exceeded ${maxAttempts} attempts (${
            (maxAttempts * pollInterval) / 1000 / 60
        } minutes)`
    );
}
