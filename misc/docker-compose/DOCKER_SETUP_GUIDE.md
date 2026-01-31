# yt-dlp-host Docker Compose Setup Guide

Complete guide for deploying yt-dlp-host with spotify-to-plex integration.

## Quick Start (5 Minutes)

### Step 1: Prepare Configuration

```bash
# Copy files
cp docker-compose-ytdlp-only.yml docker-compose.yml
cp .env.ytdlp.example .env
```

### Step 2: Configure .env

```bash
# Edit .env with your values
PLEX_MUSIC_PATH=/mnt/plex/Music
YTDLP_API_KEY=$(openssl rand -hex 32)
```

### Step 3: Start Container

```bash
# Start
docker-compose up -d

# Verify health
curl -H "X-API-Key: your-api-key" http://localhost:5000/health
```

### Step 4: Configure in spotify-to-plex UI

- Go to Settings → YT-DLP
- API URL: `http://ytdlp-api:5000` or `http://localhost:5000`
- API Key: Your YTDLP_API_KEY
- Click Test Connection

✅ Done! YT-DLP is ready to use as fallback for SLSKD.

---

## Deployment Options

### Option A: Separate Container (Recommended)

**File**: `docker-compose-ytdlp-only.yml`

**Advantages**:
- Independent scaling
- Easy to update yt-dlp-host separately
- Resource isolation
- Better for production

**Disadvantages**:
- More containers to manage
- Requires network configuration

**Best for**: Production, multiple containers, larger deployments

### Option B: Integrated with spotify-to-plex

**File**: `docker-compose.yml`

**Advantages**:
- Single compose file
- Everything starts together
- Simpler setup

**Disadvantages**:
- Tightly coupled
- Harder to scale individually
- Shared resource limits

**Best for**: Testing, small deployments, all-in-one setups

---

## Detailed Setup: Separate Container

### Prerequisites

- Docker & Docker Compose installed
- Plex Music directory path (e.g., `/mnt/plex/Music`)
- Strong API key (generated via `openssl rand -hex 32`)

### Installation Steps

#### Step 1: Create Directory

```bash
mkdir -p /opt/ytdlp-api
cd /opt/ytdlp-api
```

#### Step 2: Copy Files

```bash
# Download or copy these files to /opt/ytdlp-api/:
# - docker-compose-ytdlp-only.yml
# - .env.ytdlp.example

cp docker-compose-ytdlp-only.yml docker-compose.yml
cp .env.ytdlp.example .env
```

#### Step 3: Generate API Key

```bash
# Generate strong API key
openssl rand -hex 32

# Output will be something like:
# a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z

# Copy this value
```

#### Step 4: Edit .env File

```bash
nano .env  # or your favorite editor
```

Fill in required values:

```env
# REQUIRED
PLEX_MUSIC_PATH=/mnt/plex/Music
YTDLP_API_KEY=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6

# OPTIONAL (use defaults if unsure)
YTDLP_API_PORT=5000
YTDLP_MAX_CONCURRENT=5
YTDLP_DOWNLOAD_TIMEOUT=600
YTDLP_AUDIO_CONTAINER=mp3
```

#### Step 5: Prepare Plex Directory

```bash
# Create directory if needed
sudo mkdir -p /mnt/plex/Music

# Set permissions (important!)
# Option A: Open permissions (simple)
sudo chmod 777 /mnt/plex/Music

# Option B: Specific user (secure)
sudo chown 1000:1000 /mnt/plex/Music
sudo chmod 755 /mnt/plex/Music
```

#### Step 6: Start Container

```bash
# Start in background
docker-compose up -d

# Watch startup (Ctrl+C to exit)
docker-compose logs -f ytdlp-api
```

Expected output:
```
ytdlp-api  | [INFO] yt-dlp-host listening on 0.0.0.0:5000
```

#### Step 7: Verify Startup

```bash
# Check container status
docker-compose ps

# Expected STATUS: healthy (after ~10 seconds)
```

#### Step 8: Test API Health

```bash
# Test health endpoint
curl -H "X-API-Key: YOUR-API-KEY" http://localhost:5000/health

# Expected response (200 OK):
# {
#   "status": "healthy",
#   "version": "2025.01.xx",
#   "active_downloads": 0,
#   "queue_size": 0
# }
```

---

## Network Setup for Multi-Container Environment

### Scenario 1: Both on Same Host (Recommended)

If running spotify-to-plex and yt-dlp-api on the same Docker host:

```bash
# Create shared network
docker network create spotify-to-plex-network

# Add both containers to this network
# In docker-compose: networks: [spotify-to-plex-network]
```

**In spotify-to-plex settings**:
- API URL: `http://ytdlp-api:5000` (uses container DNS name)

### Scenario 2: Different Docker Hosts

If running on different machines:

```bash
# On yt-dlp host, expose port
YTDLP_API_PORT=5000  # Make sure port is accessible

# In spotify-to-plex settings:
# API URL: http://other-host-ip:5000
```

### Scenario 3: Through Reverse Proxy

For production/external access:

```bash
# Configure nginx/traefik to proxy requests
# Example nginx:

upstream ytdlp {
  server ytdlp-api:5000;
}

server {
  listen 443 ssl;
  server_name ytdlp.example.com;

  location / {
    proxy_pass http://ytdlp;
    proxy_set_header X-API-Key $http_x_api_key;
    proxy_set_header Host $host;
  }
}
```

---

## Configuration Examples

### Example 1: Basic Setup

```env
PLEX_MUSIC_PATH=/mnt/plex/Music
YTDLP_API_KEY=my-super-secret-key
# All other settings use defaults
```

### Example 2: High-Speed Connection

```env
PLEX_MUSIC_PATH=/mnt/plex/Music
YTDLP_API_KEY=my-super-secret-key
YTDLP_MAX_CONCURRENT=10
YTDLP_DOWNLOAD_TIMEOUT=300
YTDLP_AUDIO_CONTAINER=opus
```

### Example 3: Slow Connection

```env
PLEX_MUSIC_PATH=/mnt/plex/Music
YTDLP_API_KEY=my-super-secret-key
YTDLP_MAX_CONCURRENT=2
YTDLP_DOWNLOAD_TIMEOUT=1200
YTDLP_AUDIO_CONTAINER=m4a
```

### Example 4: Limited Disk Space

```env
PLEX_MUSIC_PATH=/mnt/plex/Music
YTDLP_API_KEY=my-super-secret-key
YTDLP_AUDIO_FORMAT=worst
YTDLP_AUDIO_CONTAINER=opus
YTDLP_MAX_CONCURRENT=1
```

### Example 5: Low Memory System

```env
PLEX_MUSIC_PATH=/mnt/plex/Music
YTDLP_API_KEY=my-super-secret-key
YTDLP_MAX_CONCURRENT=1
# Also edit docker-compose to add:
# deploy:
#   resources:
#     limits:
#       memory: 512M
#       cpus: '0.5'
```

---

## Container Management

### Common Commands

```bash
# Start container
docker-compose up -d

# Stop container
docker-compose stop

# Restart container
docker-compose restart ytdlp-api

# View logs
docker-compose logs -f ytdlp-api

# Check status
docker-compose ps

# Stop and remove
docker-compose down

# Remove container but keep volumes
docker-compose rm ytdlp-api

# Remove everything (⚠️ deletes data)
docker-compose down -v
```

### View Logs

```bash
# Real-time logs
docker-compose logs -f ytdlp-api

# Last 100 lines
docker-compose logs --tail 100 ytdlp-api

# Since 10 minutes ago
docker-compose logs --since 10m ytdlp-api

# Errors only
docker-compose logs ytdlp-api | grep ERROR
```

### Monitor Resources

```bash
# Real-time stats
docker stats ytdlp-api

# One-time snapshot
docker-compose ps
```

---

## Testing the Setup

### Test 1: Health Check

```bash
API_KEY="your-api-key-here"

curl -H "X-API-Key: $API_KEY" http://localhost:5000/health
```

Expected response:
```json
{
  "status": "healthy",
  "version": "2025.01.xx",
  "active_downloads": 0,
  "queue_size": 0,
  "uptime_seconds": 120
}
```

### Test 2: Download a Test Track

```bash
API_KEY="your-api-key-here"
URL="https://www.youtube.com/watch?v=dQw4w9WgXcQ"  # Rick Roll (safe test)

curl -X POST http://localhost:5000/get_audio \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"$URL\",
    \"audio_format\": \"bestaudio\",
    \"output_format\": \"mp3\"
  }"
```

Expected response:
```json
{
  "status": "waiting",
  "task_id": "abc123def456"
}
```

### Test 3: Check Download Status

```bash
API_KEY="your-api-key-here"
TASK_ID="abc123def456"  # From previous response

curl -H "X-API-Key: $API_KEY" http://localhost:5000/status/$TASK_ID
```

### Test 4: Verify File Downloaded

```bash
# Check if file was saved
ls -la /mnt/plex/Music

# Should see something like:
# Rick Roll or similar filename
```

---

## Troubleshooting

### Issue: Container won't start

```bash
# Check logs
docker-compose logs ytdlp-api

# Common causes:
# 1. Port 5000 already in use
#    Solution: Change YTDLP_API_PORT in .env

# 2. Permission denied on /mnt/plex/Music
#    Solution: sudo chmod 777 /mnt/plex/Music

# 3. Out of disk space
#    Solution: df -h /mnt/plex/Music
```

### Issue: Connection refused

```bash
# Check if container is running
docker-compose ps

# If not running:
docker-compose up -d

# Check port
netstat -an | grep 5000

# Verify API key is correct in health check
```

### Issue: API health check fails

```bash
# Test without auth first
curl http://localhost:5000/health

# If works, verify API key:
# Make sure X-API-Key header matches YTDLP_API_KEY in .env

# Check logs
docker-compose logs ytdlp-api | grep -i error
```

### Issue: Downloads failing

```bash
# Check logs for specific error
docker-compose logs ytdlp-api | tail -50

# Common issues:
# 1. YouTube rate limiting
#    Solution: Reduce MAX_CONCURRENT or use proxy

# 2. Network timeout
#    Solution: Increase DOWNLOAD_TIMEOUT

# 3. Disk full
#    Solution: Free space in PLEX_MUSIC_PATH
#    Command: du -sh /mnt/plex/Music
```

### Issue: Files not appearing in Plex

```bash
# Verify files were downloaded
ls -la /mnt/plex/Music

# Check file permissions
ls -la /mnt/plex/Music/<artist>

# If missing, check download status via API
curl http://localhost:5000/status/<task-id>

# In Plex, refresh library:
# Settings → Library → Scan Library Now
```

### Issue: High memory usage

```bash
# Check memory
docker stats ytdlp-api

# If over limit:
# 1. Reduce YTDLP_MAX_CONCURRENT (fewer parallel downloads)
# 2. Lower memory limit in docker-compose
# 3. Restart: docker-compose restart ytdlp-api
```

---

## Maintenance

### Update to Latest Version

```bash
# Pull latest image
docker-compose pull ytdlp-api

# Restart with new image
docker-compose up -d ytdlp-api

# Verify
docker-compose logs ytdlp-api | head
```

### Backup Configuration

```bash
# Backup env file
cp .env .env.backup

# Backup docker-compose
cp docker-compose.yml docker-compose.yml.backup

# Note: Downloaded files are in PLEX_MUSIC_PATH
```

### Clean Up Old Logs

```bash
# Check container logs size
docker-compose logs ytdlp-api | wc -l

# Prune old Docker logs (careful!)
docker system prune --all
```

---

## Next Steps

After successful setup:

1. **Configure in spotify-to-plex**
   - Go to Settings → YT-DLP
   - Set API URL and key
   - Test connection

2. **Enable fallback**
   - Set enabled: true
   - Start with auto_sync: false
   - Test with manual trigger

3. **Monitor**
   - Check logs for errors
   - Review download success rate
   - Adjust settings as needed

4. **Enable scheduler (optional)**
   - Set auto_sync: true
   - Runs daily at 07:00 UTC
   - Monitor for 1-2 weeks

---

## Reference

### Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `PLEX_MUSIC_PATH` | Required | Where files are saved |
| `YTDLP_API_KEY` | Required | API authentication |
| `YTDLP_API_PORT` | 5000 | API port |
| `YTDLP_MAX_CONCURRENT` | 5 | Concurrent downloads |
| `YTDLP_DOWNLOAD_TIMEOUT` | 600 | Timeout per track (sec) |
| `YTDLP_AUDIO_CONTAINER` | mp3 | Output format |

### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/get_audio` | POST | Start download |
| `/status/<id>` | GET | Check status |
| `/downloads` | GET | List active |

### Useful Commands

```bash
# Generate API key
openssl rand -hex 32

# Test API health
curl -H "X-API-Key: KEY" http://localhost:5000/health

# View logs
docker-compose logs -f ytdlp-api

# Check status
docker-compose ps

# Stop container
docker-compose stop
```

---

## Support

- GitHub: https://github.com/Vasysik/yt-dlp-host
- yt-dlp: https://github.com/yt-dlp/yt-dlp
- Docker Docs: https://docs.docker.com/compose/
