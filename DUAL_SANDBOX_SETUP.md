# Dual Sandbox Mode Setup

Your platform now supports **two execution modes** for running AI agents and validating code:

## 🎯 Execution Modes

### 1. **Vercel Sandbox (Cloud)** ☁️
- Runs code execution in Vercel's cloud infrastructure
- No local dependencies required
- Requires Vercel tokens
- Ideal for production and cloud development

### 2. **Docker (Local)** 🐳
- Runs code execution in local Docker containers
- Full control over environment
- No external API dependencies
- Ideal for local development and offline work

---

## 🚀 Quick Start

### Using Vercel Sandbox (Cloud)

**1. Set environment variables:**
```bash
# .env.local
VERCEL_TEAM_ID=team_xxxxx
VERCEL_PROJECT_ID=prj_xxxxx
VERCEL_TOKEN=your_vercel_token

# Optional: Force Vercel mode
EXECUTION_MODE=vercel
```

**2. Get Vercel credentials:**
- Team ID: https://vercel.com/teams/settings
- Project ID: https://vercel.com/your-team/your-project/settings
- Token: https://vercel.com/account/tokens

**3. Start application:**
```bash
pnpm dev
```

The platform will automatically use Vercel Sandbox when tokens are configured.

---

### Using Docker (Local)

**1. Install Docker:**
```bash
# macOS
brew install --cask docker

# Ubuntu/Debian
sudo apt-get install docker.io

# Windows
# Download from https://www.docker.com/products/docker-desktop
```

**2. Set environment variable (optional):**
```bash
# .env.local
EXECUTION_MODE=docker
```

**3. Start Docker daemon:**
```bash
# Ensure Docker is running
docker ps
```

**4. Start application:**
```bash
pnpm dev
```

---

## 🎛️ Switching Between Modes

### Method 1: UI Toggle (Recommended)

Add the execution mode toggle to your UI:

```tsx
// In your task form or header
import { ExecutionModeToggle } from '@/components/execution-mode-toggle'

<ExecutionModeToggle />
```

Users can switch between modes in the UI, and preferences are saved in cookies.

### Method 2: Environment Variable

```bash
# .env.local
EXECUTION_MODE=docker  # or 'vercel'
```

This overrides user preferences and forces a specific mode.

### Method 3: Auto-Detection (Default)

If no preference is set, the platform auto-detects:
1. **Vercel tokens configured** → Use Vercel Sandbox
2. **No Vercel tokens** → Use Docker
3. **Production environment** → Use Vercel (if tokens available)

---

## 📋 Mode Detection Priority

The platform checks in this order:

1. **User Preference (Cookie)** ← Highest priority
   - Set via UI toggle
   - Saved in `execution_mode` cookie

2. **Environment Variable**
   - `EXECUTION_MODE=docker` or `EXECUTION_MODE=vercel`
   - Good for forcing a mode

3. **Auto-Detection** ← Lowest priority
   - Checks for Vercel tokens
   - Uses Docker as fallback

---

## 🔧 Configuration Reference

### Vercel Sandbox Environment Variables

```bash
# Required for Vercel Sandbox
VERCEL_TEAM_ID=team_xxxxx          # Your Vercel team ID
VERCEL_PROJECT_ID=prj_xxxxx        # Your Vercel project ID
VERCEL_TOKEN=xxxxxxxxx             # Your Vercel API token

# Optional
EXECUTION_MODE=vercel              # Force Vercel mode
```

### Docker Environment Variables

```bash
# Optional
EXECUTION_MODE=docker              # Force Docker mode
DOCKER_SOCKET=/var/run/docker.sock # Custom Docker socket path (advanced)
```

---

## 🧪 Testing Both Modes

### Test Vercel Sandbox

```bash
# Set Vercel tokens
export VERCEL_TEAM_ID=team_xxxxx
export VERCEL_PROJECT_ID=prj_xxxxx
export VERCEL_TOKEN=your_token

# Force Vercel mode
export EXECUTION_MODE=vercel

# Run dev server
pnpm dev
```

Create a task and verify logs show:
```
Using vercel execution mode
```

### Test Docker

```bash
# Ensure Docker is running
docker ps

# Force Docker mode
export EXECUTION_MODE=docker

# Run dev server
pnpm dev
```

Create a task and verify logs show:
```
Using docker execution mode
```

---

## 🎨 Adding Toggle to Your UI

### Example: Add to Home Page Header

```tsx
// components/home-page-header.tsx
import { ExecutionModeToggle } from '@/components/execution-mode-toggle'

export function HomePageHeader() {
  return (
    <header className="flex items-center justify-between">
      <h1>AI Coding Agent</h1>
      <div className="flex items-center gap-4">
        <ExecutionModeToggle />
        {/* Other header items */}
      </div>
    </header>
  )
}
```

### Example: Add to Task Form

```tsx
// components/task-form.tsx
import { ExecutionModeToggle } from '@/components/execution-mode-toggle'

export function TaskForm() {
  return (
    <form>
      {/* Existing form fields */}

      <div className="space-y-2">
        <label>Execution Mode</label>
        <ExecutionModeToggle />
      </div>

      {/* Submit button */}
    </form>
  )
}
```

---

## 🐛 Troubleshooting

### Vercel Sandbox Issues

**Error: "Invalid Vercel credentials"**
- Verify your tokens are correct
- Check token has not expired
- Ensure team/project IDs match

**Error: "Rate limit exceeded"**
- Vercel Sandbox has usage limits
- Switch to Docker for unlimited local execution

**Slow execution**
- Cloud latency is expected
- Consider Docker for faster local execution

### Docker Issues

**Error: "Cannot connect to Docker daemon"**
```bash
# Start Docker daemon
sudo systemctl start docker  # Linux
open -a Docker              # macOS
```

**Error: "Permission denied"**
```bash
# Add your user to docker group (Linux)
sudo usermod -aG docker $USER
newgrp docker
```

**Error: "Container creation failed"**
- Ensure Docker has sufficient resources (CPU/Memory)
- Check Docker Desktop settings

---

## 📊 Feature Comparison

| Feature | Vercel Sandbox | Docker |
|---------|----------------|--------|
| Setup Difficulty | Easy (just tokens) | Medium (install Docker) |
| Internet Required | Yes | No |
| Execution Speed | Medium (cloud latency) | Fast (local) |
| Resource Usage | None (cloud) | High (local) |
| Cost | Free tier + usage | Free |
| Portability | Works anywhere | Requires Docker |
| Debugging | Limited | Full control |
| Offline Support | ❌ No | ✅ Yes |
| Playwright Tests | ✅ Yes (headless only) | ✅ Yes (full support) |
| Browser Screenshots | ❌ No | ✅ Yes |
| Video Recording | ❌ No | ✅ Yes |

---

## 🎯 Recommended Use Cases

### Use Vercel Sandbox When:
- ✅ Deploying to production
- ✅ Working on cloud-first projects
- ✅ Don't want to install Docker
- ✅ Collaborating with team (consistent environment)
- ✅ Limited local resources

### Use Docker When:
- ✅ Local development
- ✅ Need offline support
- ✅ Debugging complex issues
- ✅ Testing resource-intensive operations
- ✅ Want full control over environment
- ✅ Avoiding API rate limits

---

## 🧪 Playwright Testing

### Vercel Sandbox (Headless Mode)

Vercel Sandbox **does NOT support X11/GUI applications**, so we use a serverless-optimized approach:

**What works:**
- ✅ Headless browser testing
- ✅ DOM manipulation tests
- ✅ API interaction tests
- ✅ Form validation tests
- ✅ Navigation and routing tests

**What doesn't work:**
- ❌ Visual regression testing (screenshots)
- ❌ Video recording
- ❌ Full browser debugging with DevTools
- ❌ Tests requiring browser GUI

**Implementation:**
```typescript
// Vercel Sandbox uses @sparticuz/chromium (serverless-optimized)
// Automatically configured when using Vercel mode

// Your tests run in headless mode:
test('button should be clickable', async ({ page }) => {
  await page.goto('http://localhost:3000')
  await page.click('button#submit')
  await expect(page.locator('.success')).toBeVisible()
})
```

### Docker (Full Support)

Docker supports full Playwright functionality including visual testing:

**What works:**
- ✅ Everything in Vercel mode, plus:
- ✅ Screenshots and visual comparison
- ✅ Video recording of test runs
- ✅ Full browser debugging
- ✅ Multiple browser engines (Chromium, Firefox, WebKit)

**Implementation:**
```typescript
// Docker uses full Playwright with browser binaries
test('visual regression test', async ({ page }) => {
  await page.goto('http://localhost:3000')

  // Take screenshot (Docker only)
  await page.screenshot({ path: 'screenshot.png' })

  // Visual comparison (Docker only)
  await expect(page).toHaveScreenshot('baseline.png')
})
```

### Choosing the Right Mode for Testing

**Use Vercel Sandbox for:**
- Functional testing (clicks, forms, navigation)
- API integration tests
- Quick validation in CI/CD
- Testing without local Docker setup

**Use Docker for:**
- Visual regression testing
- Debugging test failures with screenshots/videos
- Cross-browser testing
- Comprehensive E2E testing

---

## 🔮 Future Enhancements

Planned improvements:
- [ ] Hybrid mode (automatic failover)
- [ ] Resource usage metrics per mode
- [ ] Cost tracking for Vercel Sandbox
- [ ] Custom Docker images
- [ ] Kubernetes support

---

## 📚 Additional Resources

- [Vercel Sandbox Documentation](https://vercel.com/docs/sandbox)
- [Docker Documentation](https://docs.docker.com/)
- [Unified Sandbox API Reference](./lib/unified-sandbox.ts)

---

## 🤝 Contributing

Found a bug or have a suggestion? Please open an issue or PR!

**Happy coding!** 🚀
