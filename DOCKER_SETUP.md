# Docker Execution Mode - Setup Guide

## Overview

This coding agent template now supports **two execution modes**:

1. **Docker Mode (Local)** - Free, runs on your machine using Docker containers
2. **Vercel Sandbox Mode (Cloud)** - Paid, runs on Vercel's cloud infrastructure

By default, the system automatically detects which mode to use based on your configuration.

---

## Quick Start (Docker Mode)

### Prerequisites

1. **Install Docker Desktop**
   - Windows/Mac: https://www.docker.com/products/docker-desktop
   - Linux: `sudo apt-get install docker.io` or use your package manager

2. **Verify Docker is Running**
   \`\`\`bash
   docker --version
   docker ps  # Should not error
   \`\`\`

### Required Environment Variables (Docker Mode)

Create or update your `.env.local` file:

\`\`\`bash
# Database
POSTGRES_URL=your_postgres_connection_string

# GitHub Authentication
GITHUB_TOKEN=your_github_personal_access_token

# AI Agents (at least one required)
ANTHROPIC_API_KEY=your_anthropic_api_key  # For Claude agent
OPENAI_API_KEY=your_openai_api_key        # For Codex agent (optional)
CURSOR_API_KEY=your_cursor_api_key        # For Cursor agent (optional)
GEMINI_API_KEY=your_gemini_api_key        # For Gemini agent (optional)

# Optional: Force Docker mode (auto-detected by default)
EXECUTION_MODE=docker
\`\`\`

### What You DON'T Need (Docker Mode)

When using Docker mode, you **do not need**:
- ❌ `VERCEL_TEAM_ID`
- ❌ `VERCEL_PROJECT_ID`
- ❌ `VERCEL_TOKEN`

These are only required for Vercel Sandbox mode.

---

## Execution Mode Selection

The system automatically chooses the execution mode:

\`\`\`
If EXECUTION_MODE=docker        → Docker
If EXECUTION_MODE=vercel        → Vercel Sandbox
If no Vercel tokens configured  → Docker (default)
If NODE_ENV=production + Vercel tokens present → Vercel Sandbox
Otherwise                       → Docker
\`\`\`

### Force Docker Mode

Add to `.env.local`:
\`\`\`bash
EXECUTION_MODE=docker
\`\`\`

### Force Vercel Sandbox Mode

Add to `.env.local`:
\`\`\`bash
EXECUTION_MODE=vercel
VERCEL_TEAM_ID=your_team_id
VERCEL_PROJECT_ID=your_project_id
VERCEL_TOKEN=your_token
\`\`\`

---

## How Docker Mode Works

### Architecture

\`\`\`
User Request
  ↓
Next.js API (localhost:3000)
  ↓
Docker Container Created
  ↓
Repository Cloned into Container
  ↓
Dependencies Installed
  ↓
Agent (Claude Code) Executes
  ↓
Changes Committed & Pushed
  ↓
Container Destroyed
\`\`\`

### Container Lifecycle

1. **Container Creation**
   - Pulls `node:22-slim` image
   - Creates isolated environment
   - Mounts workspace volume

2. **Setup Phase**
   - Installs Git, curl, Python
   - Clones GitHub repository
   - Installs npm/pnpm/yarn dependencies

3. **Execution Phase**
   - Installs agent CLI (e.g., Claude Code)
   - Executes coding task
   - Detects file changes via Git

4. **Cleanup Phase**
   - Commits changes
   - Pushes to GitHub branch
   - Destroys container
   - (Volume preserved for debugging)

---

## Supported Agents (Docker Mode)

### ✅ Currently Implemented
- **Claude Code** - Fully supported

### 🚧 Coming Soon
- Codex CLI
- Cursor CLI
- Gemini CLI
- OpenCode CLI

---

## Cost Comparison

### Docker Mode (Local)
- **Cost**: $0 (Free)
- **Requirements**:
  - Docker installed
  - ~2GB RAM per task
  - CPU cycles on your machine
- **Best For**:
  - Development
  - Testing
  - Cost-sensitive projects
  - Air-gapped environments

### Vercel Sandbox Mode (Cloud)
- **Cost**: Vercel Pro/Enterprise pricing
- **Requirements**:
  - Vercel account
  - API tokens
  - Internet connection
- **Best For**:
  - Production deployments
  - Serverless scaling
  - Teams without local Docker

---

## Troubleshooting

### "Docker is not installed or not running"

**Solution:**
1. Install Docker Desktop
2. Start Docker Desktop
3. Verify: `docker ps`

### "Failed to pull Docker image"

**Solution:**
\`\`\`bash
# Manually pull the image
docker pull node:22-slim
\`\`\`

### "Permission denied" errors (Linux)

**Solution:**
\`\`\`bash
# Add your user to docker group
sudo usermod -aG docker $USER
# Log out and back in
\`\`\`

### Container not cleaning up

**Solution:**
\`\`\`bash
# List all containers
docker ps -a | grep coding-agent

# Remove manually
docker rm -f <container_id>

# Remove all stopped containers
docker container prune
\`\`\`

### Out of disk space

**Solution:**
\`\`\`bash
# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune
\`\`\`

---

## Development Tips

### View Running Containers

\`\`\`bash
docker ps
\`\`\`

### Access Container Logs

\`\`\`bash
docker logs <container_id>
\`\`\`

### Execute Commands in Running Container

\`\`\`bash
docker exec -it <container_id> /bin/bash
\`\`\`

### Debug Container Workspace

Containers are destroyed after task completion, but volumes persist:

\`\`\`bash
# List volumes
docker volume ls | grep coding-agent

# Inspect volume
docker volume inspect coding-agent-<task_id>-workspace

# Create temporary container to access volume
docker run --rm -it -v coding-agent-<task_id>-workspace:/data node:22-slim bash
cd /data
\`\`\`

---

## Performance Considerations

### Docker Mode
- **Startup Time**: ~10-30 seconds (image pull + container creation)
- **Execution**: Same as native
- **Cleanup**: ~2-5 seconds
- **Total Overhead**: ~15-35 seconds per task

### Vercel Sandbox Mode
- **Startup Time**: ~20-60 seconds (cloud provisioning)
- **Execution**: Same as Docker
- **Cleanup**: Automatic
- **Total Overhead**: ~30-70 seconds per task

---

## Security Notes

### Docker Mode
- Containers are isolated from host system
- Environment variables passed securely
- GitHub tokens only in container memory
- Containers destroyed after execution
- Volumes can be manually cleaned up

### Best Practices
1. Never commit `.env.local` to version control
2. Rotate API keys regularly
3. Use GitHub fine-grained tokens with minimal permissions
4. Regularly prune unused Docker resources

---

## Migration Guide

### From Vercel Sandbox to Docker

1. Install Docker Desktop
2. Remove Vercel env vars from `.env.local`:
   \`\`\`bash
   # Comment out or remove:
   # VERCEL_TEAM_ID=...
   # VERCEL_PROJECT_ID=...
   # VERCEL_TOKEN=...
   \`\`\`
3. Add (optional):
   \`\`\`bash
   EXECUTION_MODE=docker
   \`\`\`
4. Restart dev server:
   \`\`\`bash
   pnpm dev
   \`\`\`

### From Docker to Vercel Sandbox

1. Get Vercel credentials
2. Add to `.env.local`:
   \`\`\`bash
   EXECUTION_MODE=vercel
   VERCEL_TEAM_ID=your_team_id
   VERCEL_PROJECT_ID=your_project_id
   VERCEL_TOKEN=your_token
   \`\`\`
3. Restart dev server

---

## FAQ

**Q: Can I use Docker mode in production?**
A: Yes! Deploy your Next.js app anywhere with Docker installed. The app will use local Docker containers instead of Vercel's sandbox.

**Q: Which mode is faster?**
A: Similar performance. Docker is slightly faster for startup, Vercel scales better under load.

**Q: Can I switch modes dynamically?**
A: Yes, just change the `EXECUTION_MODE` environment variable and restart.

**Q: Does Docker mode work on Windows?**
A: Yes, via Docker Desktop with WSL2 backend.

**Q: What happens if Docker is not installed?**
A: The system will error and ask you to install Docker. It won't fallback to Vercel automatically.

**Q: Can I use both modes simultaneously?**
A: No, only one mode is active at a time based on `EXECUTION_MODE`.

---

## Next Steps

1. ✅ Install Docker
2. ✅ Configure `.env.local`
3. ✅ Run `pnpm dev`
4. ✅ Create a task and watch it execute locally!

For issues, check the task logs in the UI or container logs via `docker logs`.
