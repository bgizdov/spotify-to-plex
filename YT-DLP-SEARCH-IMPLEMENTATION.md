# Adding YouTube Search Support to yt-dlp-host

This document describes how to add a search endpoint to yt-dlp-host so it can search YouTube and return video URLs.

## Current Issue

The yt-dlp-host API only accepts direct URLs. When sending search queries like `artist - track`, yt-dlp-host cannot process them because:

1. The API requires valid URLs to be passed to `/get_audio`
2. YouTube search results pages (`youtube.com/results?search_query=...`) are not downloadable by yt-dlp
3. yt-dlp search prefixes like `ytsearch:` cannot be used directly with the API

## Solution

Add a `/search` endpoint to yt-dlp-host that:
1. Accepts a search query string
2. Uses yt-dlp internally to search YouTube
3. Returns the first matching video URL

## Implementation Guide

### 1. Search Endpoint Response Format

The `/search` endpoint should return:

**Success Response:**
```json
{
  "success": true,
  "url": "https://www.youtube.com/watch?v=VIDEO_ID",
  "title": "Video Title",
  "duration": 328,
  "id": "VIDEO_ID"
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "No videos found"
}
```

**Example Implementation (Python):**

```python
@app.post("/search")
async def search(request: Request):
    """Search YouTube for videos matching a query

    Request body:
    {
        "query": "artist - track name"
    }
    """
    data = await request.json()
    query = data.get("query")

    if not query:
        return {"success": False, "message": "Query is required"}

    try:
        # Use yt-dlp to search YouTube
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'extract_flat': True,  # Don't download, just get metadata
        }

        search_query = f"ytsearch1:{query}"  # Get first result only

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            result = ydl.extract_info(search_query, download=False)

        if result and 'entries' in result and len(result['entries']) > 0:
            video = result['entries'][0]
            video_id = video['id']
            video_url = f"https://www.youtube.com/watch?v={video_id}"

            return {
                "success": True,
                "url": video_url,
                "title": video.get('title', 'Unknown'),
                "duration": video.get('duration', 0),
                "id": video_id
            }
        else:
            return {"success": False, "message": "No videos found"}

    except Exception as e:
        return {"success": False, "message": str(e)}
```

### 2. Update the spotify-to-plex Application

Once yt-dlp-host has a `/search` endpoint, update the send-track endpoint:

**File:** `/apps/web/pages/api/ytdlp/send-track.ts`

```typescript
// First search for the video
const searchResponse = await axios.post(
    `${settings.api_url}/search`,
    { query: `${artist} - ${title}` },
    { headers: { 'X-API-Key': settings.api_key } }
);

if (!searchResponse.data.success) {
    return res.status(200).json({
        success: false,
        message: `No YouTube video found for: ${artist} - ${title}`
    });
}

const videoUrl = searchResponse.data.url;

// Then download the video
const downloadResp = await client.download({
    url: videoUrl,
    audio_format: settings.audio_format,
    output_format: settings.audio_container,
    filename: `${artist} - ${title}`,
});
```

### 3. Update the Sync Job

Update the sync job to use the search endpoint:

**File:** `/apps/sync-worker/src/jobs/ytdlp.ts`

Create a new function to search and download:

```typescript
async function searchAndDownload(
    client: YtdlpClient,
    track: SlskdTrackData,
    settings: YtdlpSettings
) {
    // Search for the track
    const searchResponse = await client.search(`${track.artist_name} - ${track.track_name}`);

    if (!searchResponse.success) {
        throw new Error(`No video found: ${searchResponse.message}`);
    }

    // Download the video
    const downloadResp = await client.download({
        url: searchResponse.url,
        audio_format: settings.audio_format,
        output_format: settings.audio_container,
        filename: `${track.artist_name} - ${track.track_name}`,
    });

    return downloadResp;
}
```

## yt-dlp Search Reference

### Search Query Formats

yt-dlp supports these search prefixes:

```
ytsearch:N:QUERY     # Search YouTube, get first N results
ytsearch1:QUERY      # Search YouTube, get only first result (fastest)
ytsearchall:QUERY    # Search YouTube, get all results
ytsearchdate:QUERY   # Search YouTube, sorted by date
```

### Example Searches

```bash
# Search for a specific track
yt-dlp "ytsearch1:eminem - lose yourself"

# Get multiple results
yt-dlp "ytsearch5:the weeknd - blinding lights"

# Get all results (slower)
yt-dlp "ytsearchall:coldplay - fix you"
```

## Benefits of This Approach

1. **Centralized Search Logic** - Search happens in yt-dlp-host, not in the application
2. **No External Dependencies** - Uses yt-dlp's built-in search (already available)
3. **Consistent URLs** - Returns proper YouTube URLs that yt-dlp can download
4. **Better Error Handling** - Search failures can be handled gracefully
5. **Caching** - yt-dlp-host can cache search results if needed
6. **Rate Limiting** - Easy to add rate limiting to search requests

## Testing the Search Endpoint

Once implemented, test with:

```bash
curl -X POST \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  http://localhost:5000/search \
  -d '{"query": "eminem - lose yourself"}'

# Response:
{
  "success": true,
  "url": "https://www.youtube.com/watch?v=xFYQQPAOz7Y",
  "title": "Eminem - Lose Yourself",
  "duration": 328,
  "id": "xFYQQPAOz7Y"
}
```

Then use the returned URL with `/get_audio`:

```bash
curl -X POST \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  http://localhost:5000/get_audio \
  -d '{
    "url": "https://www.youtube.com/watch?v=xFYQQPAOz7Y",
    "output_filename": "eminem - lose yourself"
  }'
```

## Integration with Existing Code

Once the search endpoint is added to yt-dlp-host, the application code in this repository will need minimal changes:

1. Update `YtdlpClient` to include a `search()` method
2. Update send-track endpoint to call `client.search()` first
3. Update sync job to use the new search function

All UI components already support sending tracks to yt-dlp via the button in the missing tracks dialog.
