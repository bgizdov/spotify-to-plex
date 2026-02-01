import type { YtdlpSettings } from '../types/YtdlpSettings';
import { writeJSON } from '../utils/fileUtils';
import { getYtdlpSettings } from './getYtdlpSettings';

export async function updateYtdlpSettings(
    partial: Partial<YtdlpSettings>
): Promise<YtdlpSettings> {
    const current = await getYtdlpSettings();
    const updated = { ...current, ...partial };

    await writeJSON('ytdlp.json', updated);

    return updated;
}
