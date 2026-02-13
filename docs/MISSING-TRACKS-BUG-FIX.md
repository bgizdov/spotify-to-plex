# Missing Tracks Bug Fix

## Problem Description

The `missing_tracks_slskd.json` and `missing_tracks_ytdlp.json` files were only showing 3 tracks when many more tracks were actually missing from Plex.

## Root Cause

Both `apps/sync-worker/src/jobs/playlists.ts` and `apps/sync-worker/src/jobs/albums.ts` had a critical bug where the missing tracks files were being written **inside the for loop**, causing them to be overwritten on each iteration.

### Before the Fix

```typescript
for (let i = 0; i < toSyncPlaylists.length; i++) {
    // ... process playlist ...

    // Collect missing tracks in arrays (accumulating correctly)
    missingTracksSlskd.push(...);

    // ❌ BUG: Writing files INSIDE the loop
    writeFileSync('missing_tracks_slskd.json', JSON.stringify(missingTracksSlskd));
    // This overwrites the file on each iteration!
}
```

### What Happened

1. **First playlist**: Had 100 missing tracks → writes 100 tracks to file
2. **Second playlist**: Had 50 missing tracks → **overwrites** file with 150 tracks total
3. **Third playlist**: Had 0 missing tracks → **continues** without writing, leaving previous data
4. **Fourth playlist**: Had 3 missing tracks → **overwrites** file with 153 tracks total
5. **Result**: Only the cumulative data up to the last processed playlist was saved

Since the last playlist in the example only added 3 new tracks, the file showed a total that didn't represent all missing tracks from all playlists.

## The Fix

Moved the `writeFileSync` calls **outside and after the for loop**, so files are written only once after all playlists/albums have been processed:

```typescript
for (let i = 0; i < toSyncPlaylists.length; i++) {
    // ... process playlist ...

    // Collect missing tracks in arrays
    missingTracksSlskd.push(...);

    // No file writing here anymore
}

// ✅ Write files once after processing all playlists
writeFileSync('missing_tracks_slskd.json', JSON.stringify(missingTracksSlskd));
```

## Files Changed

1. **`apps/sync-worker/src/jobs/playlists.ts`**
   - Moved `writeFileSync` calls from inside the loop (after line 229) to outside the loop (after line 236)

2. **`apps/sync-worker/src/jobs/albums.ts`**
   - Moved `writeFileSync` calls from inside the loop (after line 181) to outside the loop (after line 182)

## Impact

After this fix:
- `missing_tracks_slskd.json` will contain **all missing tracks** from all playlists/albums
- SLSKD sync will process all missing tracks instead of just a subset
- YT-DLP fallback will also see all missing tracks (since it reads from `missing_tracks_slskd.json`)

## Testing

To verify the fix:
1. Run a full playlist sync: `npm run sync:playlists`
2. Check `missing_tracks_slskd.json` - should contain all missing tracks from all playlists
3. Run SLSKD sync: `npm run sync:slskd`
4. Verify that all tracks are being searched, not just 3

## Related Issues

This bug also affected:
- `missing_tracks_spotify.txt`
- `missing_tracks_tidal.txt`
- `missing_tracks_lidarr.json`
- `missing_albums_spotify.txt`
- `missing_albums_tidal.txt`
- `missing_albums_lidarr.json`

All of these files were being overwritten on each iteration and now will correctly accumulate data across all items.
