# Fallback Mode File Filtering

## Overview

The YT-DLP fallback mode now filters tracks at the **file generation level** rather than at runtime, ensuring `missing_tracks_ytdlp.json` only contains relevant tracks.

## Previous Behavior (Incorrect)

**Problem:** Both `missing_tracks_slskd.json` and `missing_tracks_ytdlp.json` contained identical data (all tracks missing from Plex), and YT-DLP would filter at runtime.

```
Playlists/Albums Sync
    ↓
missing_tracks_slskd.json  → [Track1, Track2, Track3, Track4]
missing_tracks_ytdlp.json  → [Track1, Track2, Track3, Track4]  ← Same data
    ↓
SLSKD Sync
    ↓
slskd_sync_log.json → { Track1: queued, Track2: not_found, Track3: queued, Track4: not_found }
    ↓
YT-DLP Sync (fallback_only=true)
    - Reads missing_tracks_ytdlp.json [Track1, Track2, Track3, Track4]
    - Checks slskd_sync_log.json at RUNTIME
    - Filters out Track1, Track3 (already queued by SLSKD)
    - Downloads Track2, Track4
```

**Issue:** YT-DLP file contained tracks it wouldn't process, making the file misleading.

## New Behavior (Correct)

**Solution:** Filter tracks when generating `missing_tracks_ytdlp.json` based on the `fallback_only` setting.

```
Playlists/Albums Sync
    ↓
missing_tracks_slskd.json  → [Track1, Track2, Track3, Track4]
    ↓
Check ytdlp fallback_only setting:
    ↓
    ├─ If fallback_only = false:
    │  missing_tracks_ytdlp.json → [Track1, Track2, Track3, Track4]
    │
    └─ If fallback_only = true:
       Read slskd_sync_log.json → { Track1: queued, Track2: not_found, Track3: queued, Track4: not_found }
       missing_tracks_ytdlp.json → [Track2, Track4]  ← Only not_found tracks
    ↓
YT-DLP Sync
    - Reads missing_tracks_ytdlp.json [Track2, Track4]
    - No runtime filtering needed
    - Downloads all tracks in the file
```

## Implementation Details

### File Generation (playlists.ts & albums.ts)

After accumulating all missing tracks:

```typescript
// Generate missing_tracks_ytdlp.json based on fallback_only setting
const ytdlpSettings = await getYtdlpSettings();
let missingTracksYtdlp = missingTracksSlskd;

if (ytdlpSettings.enabled && ytdlpSettings.fallback_only) {
    // Filter to only include tracks that SLSKD couldn't find
    const slskdLogPath = join(getStorageDir(), 'slskd_sync_log.json');
    if (existsSync(slskdLogPath)) {
        const slskdLogsRaw: Record<string, SlskdSyncLog> = JSON.parse(readFileSync(slskdLogPath, 'utf8'));
        const slskdLogs = Object.values(slskdLogsRaw);

        // Build set of tracks that SLSKD didn't find
        const notFoundInSlskd = new Set(
            slskdLogs
                .filter((log) => log.status === 'not_found')
                .map((log) => `${log.artist_name}||${log.track_name}`)
        );

        // Filter ytdlp tracks to only include those not found by SLSKD
        missingTracksYtdlp = missingTracksSlskd.filter(track => {
            const trackKey = `${track.artist_name}||${track.track_name}`;
            return notFoundInSlskd.has(trackKey);
        });

        console.log(`YT-DLP fallback mode: ${missingTracksYtdlp.length} tracks not found by SLSKD (out of ${missingTracksSlskd.length} total missing tracks)`);
    } else {
        console.log('YT-DLP fallback mode enabled but no SLSKD log found, including all missing tracks');
    }
}

writeFileSync(join(getStorageDir(), 'missing_tracks_ytdlp.json'), JSON.stringify(missingTracksYtdlp, null, 2))
```

### YT-DLP Processing (ytdlp.ts)

Simplified - no runtime filtering needed:

```typescript
// Read missing tracks from YT-DLP JSON file (already filtered by playlists/albums sync)
const tracksPath = join(getStorageDir(), "missing_tracks_ytdlp.json");
const tracks: SlskdTrackData[] = JSON.parse(readFileSync(tracksPath, "utf8"));

console.log(`📋 Found ${tracks.length} tracks to process`);

if (settings.fallback_only) {
    console.log(`🔄 Fallback mode: Processing tracks not found by SLSKD`);
} else {
    console.log(`🔄 Full mode: Processing all missing tracks`);
}

// Process tracks (filtering already done during file generation)
for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    // ... download logic
}
```

## Workflow

### When fallback_only = false

1. **Playlists/Albums Sync:**
   - Generates `missing_tracks_ytdlp.json` with ALL missing tracks
   - Does not check SLSKD logs

2. **YT-DLP Sync:**
   - Processes ALL tracks in the file
   - Independent of SLSKD results

### When fallback_only = true

1. **SLSKD Sync (must run first):**
   - Creates `slskd_sync_log.json` with results

2. **Playlists/Albums Sync:**
   - Reads `slskd_sync_log.json`
   - Filters to only include tracks with `status: "not_found"`
   - Generates `missing_tracks_ytdlp.json` with ONLY not_found tracks

3. **YT-DLP Sync:**
   - Processes ONLY the pre-filtered tracks
   - No need to check SLSKD logs again

## Benefits

1. **Clarity:** File content accurately reflects what will be processed
2. **Performance:** No runtime filtering overhead in YT-DLP
3. **Transparency:** Easy to inspect which tracks will be downloaded
4. **Consistency:** File generation follows the same pattern for both modes

## Edge Cases

### SLSKD Log Missing

If `fallback_only = true` but `slskd_sync_log.json` doesn't exist:
- Falls back to including ALL missing tracks
- Logs a warning message
- Prevents data loss

### SLSKD Run After Playlists Sync

If SLSKD runs AFTER playlists/albums sync when `fallback_only = true`:
1. Playlists sync generates `missing_tracks_ytdlp.json` (may be empty if log doesn't exist yet)
2. SLSKD sync creates/updates `slskd_sync_log.json`
3. **Solution:** Re-run playlists/albums sync to regenerate the filtered file

**Recommended workflow:**
```bash
# Correct order for fallback mode
npm run sync:playlists  # Generate all missing tracks
npm run sync:slskd      # Try to download via P2P, create log
npm run sync:playlists  # Regenerate ytdlp file based on SLSKD results
npm run sync:ytdlp      # Download only what SLSKD couldn't find
```

Or use the scheduled worker which runs in the correct order automatically.

## Files Changed

1. **`apps/sync-worker/src/jobs/playlists.ts`**
   - Added imports for `getYtdlpSettings`, `SlskdSyncLog`, `existsSync`, `readFileSync`
   - Added filtering logic before writing `missing_tracks_ytdlp.json`

2. **`apps/sync-worker/src/jobs/albums.ts`**
   - Added imports for `getYtdlpSettings`, `SlskdSyncLog`, `existsSync`, `readFileSync`
   - Added filtering logic before writing `missing_tracks_ytdlp.json`

3. **`apps/sync-worker/src/jobs/ytdlp.ts`**
   - Removed runtime filtering logic (SLSKD log reading and filtering)
   - Removed `SlskdSyncLog` import
   - Removed `skippedCount` variable
   - Simplified processing loop (no skip logic)
   - Simplified log output

## Testing

To verify the changes work correctly:

### Test 1: Full Mode (fallback_only = false)

```bash
# Configure YT-DLP with fallback_only = false
npm run sync:playlists
```

**Expected:**
- `missing_tracks_ytdlp.json` contains all tracks missing from Plex
- Same tracks as `missing_tracks_slskd.json`

### Test 2: Fallback Mode (fallback_only = true)

```bash
# Configure YT-DLP with fallback_only = true
npm run sync:playlists  # Generate initial files
npm run sync:slskd      # Create SLSKD log
npm run sync:playlists  # Regenerate ytdlp file (filtered)
```

**Expected:**
- `missing_tracks_ytdlp.json` contains only tracks with `status: "not_found"` in SLSKD log
- Fewer tracks than `missing_tracks_slskd.json`

### Test 3: Fallback Mode Without SLSKD Log

```bash
# Delete SLSKD log
rm ~/.spotify-to-plex/slskd_sync_log.json

# Configure YT-DLP with fallback_only = true
npm run sync:playlists
```

**Expected:**
- Warning message: "YT-DLP fallback mode enabled but no SLSKD log found, including all missing tracks"
- `missing_tracks_ytdlp.json` contains all tracks (fallback behavior)
