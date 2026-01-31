# yt-dlp-host Docker Setup

Docker Compose files for running yt-dlp-host as a fallback downloader for spotify-to-plex.

## Files Included

### Compose Files
- **docker-compose.yml** - Minimal setup (recommended, 8 lines)
- **docker-compose-ytdlp-only.yml** - Full-featured setup with all options

### Configuration
- **.env.example** - Environment variables (optional)

### Documentation
- **README.md** - This file (quick start)
- **DOCKER_SETUP_GUIDE.md** - Complete setup guide with troubleshooting
- **DOCKER_COMPOSE_INDEX.md** - Quick reference and commands

## Quick Start (2 Steps)

### Step 1: Create docker-compose.yml

```yaml
version: '3.8'

services:
  ytdlp-api:
    image: vasysik/yt-dlp-host:latest
    ports:
      - "5000:5000"
    volumes:
      - /mnt/plex/Music:/downloads
```

### Step 2: Start Container

```bash
docker-compose up -d

# Verify
curl http://localhost:5000/health
```

That's it! ✅

## Test Download

```bash
# Start download (replace with your API key if required)
curl -X POST http://localhost:5000/get_audio \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "audio_format": "bestaudio",
    "output_format": "mp3"
  }'
```

## Notes

- **Port**: 5000 (change in docker-compose if needed)
- **Downloads go to**: `/mnt/plex/Music`
- **Audio format**: MP3 (best quality)
- **No API key required** (unless configured in container)
- **No resource limits** (uses all available)
- **No network** (just default)
- **No environment variables** (uses container defaults)

## Stop/Restart

```bash
docker-compose stop
docker-compose start
docker-compose restart
docker-compose down
```

## View Logs

```bash
docker-compose logs -f ytdlp-api
```

## Check Status

```bash
docker-compose ps
```

## Configuration Options

### Minimal Setup (Recommended)
Use **docker-compose.yml** for:
- Simple, straightforward setup
- No environment variables
- No resource limits
- No networks
- Just ports and volumes
- Perfect for testing and small deployments

### Full Featured Setup
Use **docker-compose-ytdlp-only.yml** for:
- Production deployments
- Resource limits and monitoring
- Custom networks
- Detailed logging
- Health checks
- All configuration options

## Setup Paths

### Path 1: Minimal (2 minutes)
```bash
# Already done! Just start it
docker-compose up -d

# Verify
curl http://localhost:5000/health
```

### Path 2: Change Download Path
Edit **docker-compose.yml** and change:
```yaml
volumes:
  - /your/music/path:/downloads
```

Then:
```bash
docker-compose up -d
```

### Path 3: Change Port
Edit **docker-compose.yml** and change:
```yaml
ports:
  - "5001:5000"  # Access at port 5001
```

Then:
```bash
docker-compose up -d
```

## Using with spotify-to-plex

Once running, configure in spotify-to-plex:
1. Go to Settings → YT-DLP
2. Set **API URL**: `http://localhost:5000` (or your host IP:5000)
3. Leave API Key blank (no auth in minimal setup)
4. Click "Test Connection"

## Common Commands

```bash
# Start
docker-compose up -d

# View logs
docker-compose logs -f ytdlp-api

# Check status
docker-compose ps

# Stop
docker-compose stop

# Restart
docker-compose restart ytdlp-api

# Stop and remove
docker-compose down

# View running container info
docker ps
```

## Troubleshooting

### Container won't start
```bash
# Check logs
docker-compose logs ytdlp-api

# Verify port 5000 is available
netstat -an | grep 5000
```

### Files not downloaded
```bash
# Check volume mount
docker inspect ytdlp-api | grep Mounts

# Verify path exists
ls -la /mnt/plex/Music
```

### Check if running
```bash
# List containers
docker-compose ps

# Should show ytdlp-api running
```

## For More Details

- **Setup & Troubleshooting**: See `DOCKER_SETUP_GUIDE.md`
- **Command Reference**: See `DOCKER_COMPOSE_INDEX.md`
- **Full Configuration**: Edit `docker-compose-ytdlp-only.yml` for advanced options

## What's Next?

1. ✅ Files in place
2. ✅ Run `docker-compose up -d`
3. ✅ Test with `curl http://localhost:5000/health`
4. ✅ Configure in spotify-to-plex UI
5. ✅ Test downloads
6. ✅ Monitor with `docker-compose logs -f`

Done! Simple as it gets. 🎉
