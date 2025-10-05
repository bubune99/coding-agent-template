# Playwright Quick Reference

## ✅ **Yes, Playwright works in both Docker AND Vercel Sandbox!**

---

## 🎯 Quick Answer

| Mode | Headless Tests | Screenshots | Videos | Setup |
|------|---------------|-------------|--------|-------|
| **Vercel** | ✅ Yes | ❌ No | ❌ No | Easy |
| **Docker** | ✅ Yes | ✅ Yes | ✅ Yes | Medium |

---

## 📦 What Gets Installed

### Vercel Sandbox
```bash
playwright-core          # Lightweight Playwright
@sparticuz/chromium     # Serverless Chromium (~50MB)
```

### Docker
```bash
@playwright/test        # Full Playwright
chromium + deps         # Full browser (~280MB)
```

---

## 🧪 What Tests Work Where

### ✅ Works in BOTH modes:
```typescript
// Functional tests
await page.click('button')
await page.fill('input', 'value')
await expect(page.locator('.result')).toBeVisible()

// Navigation
await page.goto('http://localhost:3000')
await expect(page).toHaveURL(/.*dashboard/)

// Forms
await page.selectOption('select', 'option1')
await page.check('input[type="checkbox"]')

// Network
await page.route('**/api/data', route => route.fulfill({ json: mockData }))
```

### ❌ Docker ONLY:
```typescript
// Screenshots
await page.screenshot({ path: 'test.png' })
await expect(page).toHaveScreenshot('baseline.png')

// Videos
test.use({ video: 'on' })

// Interactive debugging
await page.pause()
```

---

## 🚀 Installation

### Auto-Installed by Platform
The platform automatically detects your execution mode and installs the right packages:

```typescript
// You don't need to do anything!
// Platform handles installation based on:
// - Docker mode → Full Playwright + browser
// - Vercel mode → playwright-core + @sparticuz/chromium
```

### Manual Installation (if needed)
```bash
# Install dependencies
pnpm install

# For Vercel: No additional steps
# For Docker: Ensure Docker is running
docker ps
```

---

## 🎛️ Switching Modes

### Via UI Toggle
```tsx
import { ExecutionModeToggle } from '@/components/execution-mode-toggle'

<ExecutionModeToggle />
```

### Via Environment Variable
```bash
# .env.local
EXECUTION_MODE=docker   # or 'vercel'
```

### Via Cookie (set by UI)
- Cookie name: `execution_mode`
- Values: `docker` | `vercel`

---

## 📝 Writing Tests

### ✅ Good (Portable)
```typescript
test('login', async ({ page }) => {
  await page.goto('http://localhost:3000/login')
  await page.fill('[name=email]', 'test@test.com')
  await page.fill('[name=password]', 'password')
  await page.click('button[type=submit]')
  await expect(page).toHaveURL(/.*dashboard/)
})
```

### ⚠️ Mode-Specific
```typescript
test('visual check', async ({ page }) => {
  await page.goto('http://localhost:3000')

  if (process.env.EXECUTION_MODE === 'docker') {
    await expect(page).toHaveScreenshot('home.png')
  } else {
    // Use DOM assertions in Vercel
    await expect(page.locator('header')).toBeVisible()
  }
})
```

### ❌ Bad (Docker-only, no fallback)
```typescript
test('homepage', async ({ page }) => {
  await page.goto('http://localhost:3000')
  await expect(page).toHaveScreenshot('home.png') // Fails in Vercel!
})
```

---

## 🐛 Common Issues

### "Browser not found"
✅ **Solution**: This is handled automatically. The adapter uses the right browser for each mode.

### "Screenshot failed in Vercel"
✅ **Solution**: Screenshots don't work in Vercel. Use Docker or remove screenshot assertions.

### "Slow test execution in Vercel"
✅ **Solution**: Normal for cloud execution. Use Docker for faster tests, or run fewer tests in Vercel.

---

## 💡 Best Practices

### Use Vercel for:
- ✅ Functional tests (clicks, forms)
- ✅ CI/CD pipelines
- ✅ Quick smoke tests
- ✅ API integration tests

### Use Docker for:
- ✅ Visual regression tests
- ✅ Debugging failures
- ✅ Comprehensive E2E suites
- ✅ Cross-browser testing

---

## 🔗 Quick Links

- [Full Documentation](./PLAYWRIGHT_VERCEL_SUPPORT.md)
- [Dual Sandbox Setup](./DUAL_SANDBOX_SETUP.md)
- [Playwright Docs](https://playwright.dev)

---

## 📊 Feature Comparison

```
Vercel Sandbox:
✅ Headless testing
✅ DOM assertions
✅ Network mocking
✅ Mobile emulation
✅ Fast setup
❌ No screenshots
❌ No videos
❌ Chromium only

Docker:
✅ Everything above, PLUS:
✅ Screenshots
✅ Videos
✅ Visual regression
✅ Multi-browser
✅ Full debugging
```

---

**Bottom Line:** Both modes work great for functional testing. Use Docker if you need visual regression or debugging. The platform handles all the complexity automatically! 🚀
