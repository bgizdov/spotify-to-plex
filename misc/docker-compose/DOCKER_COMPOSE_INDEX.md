# Docker Compose Files - Index & Quick Reference

Complete index of Docker Compose files and configuration for yt-dlp-host integration.

## Files Provided

### 1. **docker-compose-ytdlp-only.yml** (Recommended)
Standalone yt-dlp-host container configuration.

**Use this if:**
- Running yt-dlp-host separately from spotify-to-plex
- Want independent container management
- Need better resource isolation
- Production deployment

**What it includes:**
- ytdlp-api service (yt-dlp-host with REST API)
- Shared network for inter-container communication
- Volumes for downloads, cache, and temp files
- Health checks
- Resource limits

**Quick start:**
```bash
cp docker-compose-ytdlp-only.yml docker-compose.yml
cp .env.ytdlp.example .env
# Edit .env with your values
docker-compose up -d
```

### 2. **docker-compose.yml** (Integrated)
Full integration with spotify-to-plex in one compose file.

**Use this if:**
- Want everything in one command
- Testing the integration
- Small home lab setup
- All-in-one deployment

**What it includes:**
- spotify-to-plex service
- ytdlp-api service
- Shared volumes and network
- Depends-on configuration

**Quick start:**
```bash
# Uses docker-compose.yml (already has both services)
cp .env.example .env
# Edit .env with your values
docker-compose up -d
```

### 3. **.env.ytdlp.example**
Environment configuration for standalone yt-dlp-host.

**Contains:**
- API configuration (port, key, logging)
- Audio settings (format, container, quality)
- Performance tuning (concurrent downloads, timeout)
- Storage paths
- Optional advanced settings

**Usage:**
```bash
cp .env.ytdlp.example .env
nano .env  # Edit with your values
```

**Key variables:**
- `YTDLP_API_KEY` - Generate with: `openssl rand -hex 32`
- `PLEX_MUSIC_PATH` - Where files are saved
- `YTDLP_MAX_CONCURRENT` - Performance tuning
- `YTDLP_DOWNLOAD_TIMEOUT` - Per-track timeout

### 4. **.env.example**
Full environment configuration for integrated setup.

**Contains:**
- All Plex settings
- Spotify authentication
- All integrations (SLSKD, Lidarr, Tidal, MQTT)
- YT-DLP settings
- Optional service configurations

### 5. **DOCKER_SETUP_GUIDE.md** (Start Here)
Complete setup and troubleshooting guide.

**Sections:**
- Quick start (5 minutes)
- Detailed setup steps
- Network configuration options
- Configuration examples
- Container management
- Testing procedures
- Troubleshooting
- Maintenance

**When to use:** Follow this step-by-step for setup

### 6. This File (DOCKER_COMPOSE_INDEX.md)
Index of all Docker Compose files and quick reference.

---

## Quick Decision Matrix

### Choose Your Setup

| Need | Use File | Why |
|------|----------|-----|
| Production deployment | docker-compose-ytdlp-only.yml | Independent scaling, resource isolation |
| Testing integration | docker-compose.yml | Simple, all-in-one |
| Home lab setup | Either | Depends on your preference |
| Separate containers | docker-compose-ytdlp-only.yml | Better isolation |
| Single compose file | docker-compose.yml | Simpler management |

### Choose Your Configuration

| Scenario | Use .env File | Key Changes |
|----------|---------------|-------------|
| First time setup | .env.ytdlp.example | Basic required fields |
| Fast internet (100+ Mbps) | .env.ytdlp.example | Increase MAX_CONCURRENT |
| Slow internet (<25 Mbps) | .env.ytdlp.example | Reduce MAX_CONCURRENT |
| Limited disk space | .env.ytdlp.example | Use smaller audio format |
| Full integration | .env.example | All services at once |

---

## Setup Instructions by Scenario

### Scenario 1: Separate Container (Recommended)

```bash
# 1. Prepare directory
mkdir -p /opt/ytdlp-api
cd /opt/ytdlp-api

# 2. Copy files
cp docker-compose-ytdlp-only.yml docker-compose.yml
cp .env.ytdlp.example .env

# 3. Configure
nano .env  # Set PLEX_MUSIC_PATH and YTDLP_API_KEY

# 4. Start
docker-compose up -d

# 5. Verify
curl -H "X-API-Key: YOUR-KEY" http://localhost:5000/health
```

**Result:** yt-dlp-api running on port 5000

### Scenario 2: Integrated Setup

```bash
# 1. Prepare directory
mkdir -p /opt/spotify-to-plex
cd /opt/spotify-to-plex

# 2. Copy files
cp docker-compose.yml .
cp .env.example .env

# 3. Configure
nano .env  # Set all required fields

# 4. Start
docker-compose up -d

# 5. Verify
docker-compose ps
```

**Result:** Both spotify-to-plex and yt-dlp-api running

### Scenario 3: Separate Hosts

**Host 1 (yt-dlp-api):**
```bash
# Use docker-compose-ytdlp-only.yml
# Expose port 5000
```

**Host 2 (spotify-to-plex):**
```bash
# Use spotify-to-plex docker image
# Configure API URL: http://host1:5000
```

---

## Environment Variables Quick Reference

### Required Variables

```env
# For yt-dlp-host only setup:
PLEX_MUSIC_PATH=/mnt/plex/Music
YTDLP_API_KEY=openssl-rand-hex-32-output

# For full integrated setup, also need:
PLEX_URL=http://plex:32400
PLEX_API_KEY=your-plex-token
SPOTIFY_CLIENT_ID=your-spotify-id
SPOTIFY_CLIENT_SECRET=your-spotify-secret
```

### Performance Tuning Variables

```env
# For fast connection (100+ Mbps)
YTDLP_MAX_CONCURRENT=10
YTDLP_DOWNLOAD_TIMEOUT=300

# For normal connection (25-100 Mbps)
YTDLP_MAX_CONCURRENT=5
YTDLP_DOWNLOAD_TIMEOUT=600

# For slow connection (<25 Mbps)
YTDLP_MAX_CONCURRENT=2
YTDLP_DOWNLOAD_TIMEOUT=1200
```

### Format Variables

```env
# For best quality (larger files)
YTDLP_AUDIO_CONTAINER=mp3

# For balance (good quality, smaller files)
YTDLP_AUDIO_CONTAINER=m4a

# For smallest files (modern codec)
YTDLP_AUDIO_CONTAINER=opus
```

---

## Docker Compose File Comparison

### docker-compose-ytdlp-only.yml

```yaml
# Services
services:
  ytdlp-api:           # Only yt-dlp-host
    image: vasysik/yt-dlp-host:latest
    ports:
      - "5000:5000"
    volumes:
      - PLEX_MUSIC_PATH:/downloads
      - ytdlp-temp:/tmp
      - ytdlp-cache:/cache
    networks:
      - spotify-to-plex-network

# Volumes
volumes:
  ytdlp-temp
  ytdlp-cache

# Networks
networks:
  spotify-to-plex-network
```

**Best for:** Production, independent container, resource isolation

### docker-compose.yml

```yaml
# Services
services:
  spotify-to-plex:     # Main application
    image: jjdenhertog/spotify-to-plex:latest
    depends_on:
      ytdlp-api:
        condition: service_healthy

  ytdlp-api:           # yt-dlp-host
    image: vasysik/yt-dlp-host:latest

# Volumes
volumes:
  spotify-to-plex-data
  ytdlp-temp
  ytdlp-cache

# Networks
networks:
  spotify-to-plex-network
```

**Best for:** Testing, all-in-one, simple deployment

---

## Common Commands Reference

### Start/Stop

```bash
# Start in background
docker-compose up -d

# Stop containers
docker-compose stop

# Restart specific service
docker-compose restart ytdlp-api

# Stop and remove containers
docker-compose down
```

### Logging

```bash
# Real-time logs
docker-compose logs -f ytdlp-api

# Last 100 lines
docker-compose logs --tail 100 ytdlp-api

# Errors only
docker-compose logs ytdlp-api | grep ERROR
```

### Monitoring

```bash
# Container status
docker-compose ps

# Resource usage
docker stats ytdlp-api

# Health check
curl -H "X-API-Key: KEY" http://localhost:5000/health
```

### Maintenance

```bash
# Update image
docker-compose pull ytdlp-api

# Restart with new image
docker-compose up -d ytdlp-api

# Remove unused images
docker image prune
```

---

## Network Configuration

### Same Host (Recommended)

```bash
# Both containers on same Docker host
# spotify-to-plex → yt-dlp-api via docker network

# In spotify-to-plex settings:
API_URL = http://ytdlp-api:5000
```

### Different Hosts

```bash
# Containers on different physical machines
# spotify-to-plex → yt-dlp-api via network

# In spotify-to-plex settings:
API_URL = http://other-host-ip:5000
```

### Through Proxy

```bash
# For external access, use reverse proxy
# nginx → yt-dlp-api

# In spotify-to-plex settings:
API_URL = https://ytdlp.example.com
```

---

## Troubleshooting Quick Links

| Problem | Solution | Link |
|---------|----------|------|
| Container won't start | Check logs and permissions | DOCKER_SETUP_GUIDE.md → Troubleshooting |
| Connection refused | Verify port and health | DOCKER_SETUP_GUIDE.md → Testing |
| API key not working | Verify X-API-Key header | DOCKER_SETUP_GUIDE.md → Testing |
| Downloads failing | Check logs and network | DOCKER_SETUP_GUIDE.md → Troubleshooting |
| Files not in Plex | Verify paths and refresh | DOCKER_SETUP_GUIDE.md → Troubleshooting |
| High memory usage | Reduce concurrency | DOCKER_SETUP_GUIDE.md → Troubleshooting |

---

## Next Steps After Setup

### 1. Configure spotify-to-plex

Go to Settings → YT-DLP:
- **API URL**: `http://ytdlp-api:5000`
- **API Key**: Your YTDLP_API_KEY
- Click "Test Connection"

### 2. Enable Integration

- Set **enabled**: true
- Start with **auto_sync**: false
- Test with manual trigger

### 3. Monitor Results

- Check logs: `docker-compose logs ytdlp-api`
- View downloads: `ls /mnt/plex/Music`
- Monitor health: `curl http://localhost:5000/health`

### 4. Fine-tune Settings

Based on results, adjust:
- `YTDLP_MAX_CONCURRENT` - For download speed
- `YTDLP_DOWNLOAD_TIMEOUT` - For timeout handling
- `YTDLP_AUDIO_CONTAINER` - For file size

### 5. Enable Scheduler (Optional)

When confident:
- Set **auto_sync**: true
- Runs daily at 07:00 UTC
- Monitor for 1-2 weeks

---

## File Locations

```
Project Root/
├── docker-compose-ytdlp-only.yml   ← Standalone yt-dlp
├── docker-compose.yml               ← Integrated setup
├── .env.ytdlp.example              ← yt-dlp config template
├── .env.example                     ← Full config template
├── .env                             ← Your actual config (gitignored)
│
├── DOCKER_COMPOSE_SETUP.md          ← Detailed guide
├── DOCKER_SETUP_GUIDE.md            ← Setup & troubleshooting
├── DOCKER_COMPOSE_INDEX.md          ← This file
│
└── /data                            ← App data (created by docker)
└── /mnt/plex/Music                  ← Downloaded files
```

---

## Version Information

| Component | Version | Notes |
|-----------|---------|-------|
| Docker Compose | 3.8 | Uses modern syntax |
| yt-dlp-host | latest | vasysik/yt-dlp-host:latest |
| spotify-to-plex | latest | jjdenhertog/spotify-to-plex:latest |
| Python | 3.11+ | For yt-dlp-host |
| Node.js | 20 LTS | For spotify-to-plex |

---

## Security Considerations

### API Key Security

- Generate strong key: `openssl rand -hex 32`
- Store in .env (add to .gitignore)
- Don't share key in logs or issues
- Rotate periodically

### Network Security

- Don't expose port 5000 to internet
- Use shared docker network internally
- Consider reverse proxy for external access
- Use firewall rules to restrict access

### File Permissions

```bash
# Set secure permissions
sudo chown plex:plex /mnt/plex/Music
sudo chmod 755 /mnt/plex/Music

# Verify
ls -la /mnt/plex | grep Music
```

---

## Getting Help

### Before Asking

1. Check DOCKER_SETUP_GUIDE.md → Troubleshooting
2. View container logs: `docker-compose logs ytdlp-api`
3. Test API health: `curl http://localhost:5000/health`
4. Verify network: `docker network ls`

### Resources

- **yt-dlp-host**: https://github.com/Vasysik/yt-dlp-host
- **yt-dlp**: https://github.com/yt-dlp/yt-dlp
- **Docker Compose**: https://docs.docker.com/compose/
- **spotify-to-plex**: https://github.com/jjdenhertog/spotify-to-plex

---

## Quick Reference Summary

| Task | Command |
|------|---------|
| Start | `docker-compose up -d` |
| Stop | `docker-compose stop` |
| Logs | `docker-compose logs -f ytdlp-api` |
| Status | `docker-compose ps` |
| Health | `curl -H "X-API-Key: KEY" http://localhost:5000/health` |
| Update | `docker-compose pull && docker-compose up -d` |
| Clean | `docker-compose down -v` |

---

## Checklist Before Starting

- [ ] Files copied to project directory
- [ ] .env file created and configured
- [ ] PLEX_MUSIC_PATH exists and is writable
- [ ] YTDLP_API_KEY generated (`openssl rand -hex 32`)
- [ ] All required variables filled in .env
- [ ] Plex directory permissions set (`chmod 777` or specific user)
- [ ] Port 5000 is available (if not, change YTDLP_API_PORT)
- [ ] Enough disk space in PLEX_MUSIC_PATH

---

## Document Map

```
This Directory Contains:
│
├── docker-compose-ytdlp-only.yml
│   └── Standalone yt-dlp container
│
├── docker-compose.yml
│   └── Integrated with spotify-to-plex
│
├── .env.ytdlp.example
│   └── yt-dlp-only configuration template
│
├── .env.example
│   └── Full integrated configuration template
│
├── DOCKER_SETUP_GUIDE.md
│   └── Complete setup & troubleshooting (READ THIS)
│
├── DOCKER_COMPOSE_SETUP.md
│   └── Alternative detailed setup guide
│
└── DOCKER_COMPOSE_INDEX.md (this file)
    └── Quick reference & file index
```

---

**Ready to start? → Go to DOCKER_SETUP_GUIDE.md for step-by-step instructions**
