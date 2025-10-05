# Playwright Support in Vercel Sandbox

## ✅ **YES - Playwright works in Vercel Sandbox!**

But with important limitations due to the serverless environment.

---

## 🎯 What's Supported

### ✅ Headless Testing (Fully Supported)

Vercel Sandbox supports **headless Playwright testing** using `@sparticuz/chromium`, a serverless-optimized Chromium build:

```typescript
// Functional tests work perfectly
test('form submission', async ({ page }) => {
  await page.goto('http://localhost:3000')
  await page.fill('input[name="email"]', 'test@example.com')
  await page.click('button[type="submit"]')
  await expect(page.locator('.success-message')).toBeVisible()
})

// DOM manipulation tests
test('navigation', async ({ page }) => {
  await page.goto('http://localhost:3000')
  await page.click('a[href="/about"]')
  await expect(page).toHaveURL(/.*about/)
})

// API interaction tests
test('data loading', async ({ page }) => {
  await page.goto('http://localhost:3000/dashboard')
  await expect(page.locator('.loading')).not.toBeVisible()
  await expect(page.locator('.user-data')).toBeVisible()
})
```

**Supported test types:**
- ✅ Functional tests (clicks, forms, navigation)
- ✅ DOM assertions
- ✅ Network request interception
- ✅ Cookie/localStorage manipulation
- ✅ Mobile emulation
- ✅ Geolocation testing
- ✅ Custom viewport sizes
- ✅ JavaScript execution

---

## ❌ What's NOT Supported

### Vercel Sandbox Limitations

Vercel Sandbox runs in a **headless Linux environment without X11/GUI support**, which means:

**❌ No Visual Testing:**
```typescript
// These won't work in Vercel Sandbox:
await page.screenshot({ path: 'screenshot.png' }) // ❌ No screenshots
await expect(page).toHaveScreenshot('baseline.png') // ❌ No visual comparison
```

**❌ No Video Recording:**
```typescript
// Video recording requires GUI
test.use({ video: 'on' }) // ❌ Won't work
```

**❌ No Browser Debugging:**
- Can't use `page.pause()` for interactive debugging
- No DevTools access
- No headed mode (`headless: false`)

**❌ Limited Browser Engines:**
- Only Chromium (via @sparticuz/chromium)
- No Firefox or WebKit in Vercel Sandbox

---

## 🏗️ How It Works

### Architecture

```
┌─────────────────────────────────────────────┐
│         Your Test Code                      │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  Execution Mode Detection                   │
│  (lib/execution-mode.ts)                    │
└─────────────────┬───────────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
        ▼                   ▼
┌──────────────┐    ┌──────────────────┐
│   Docker     │    │ Vercel Sandbox   │
│   (Full)     │    │  (Serverless)    │
└──────┬───────┘    └────────┬─────────┘
       │                     │
       ▼                     ▼
┌──────────────┐    ┌──────────────────┐
│ playwright   │    │ playwright-core  │
│ + chromium   │    │ + @sparticuz/    │
│ + firefox    │    │   chromium       │
│ + webkit     │    │                  │
└──────────────┘    └──────────────────┘
```

### Installation Process

**Docker:**
```bash
npm install -D @playwright/test
npx playwright install chromium --with-deps
```

**Vercel Sandbox:**
```bash
npm install -D playwright-core
npm install -D @sparticuz/chromium
# No browser installation needed - uses bundled binary
```

### Implementation Details

The platform automatically detects the execution mode and uses the appropriate Playwright adapter:

**File: `lib/validation/test-executor.ts`**
```typescript
if (mode === 'docker') {
  // Full Playwright with browser binaries
  await container.runCommand('npm', ['install', '-D', '@playwright/test'])
  await container.runCommand('npx', ['playwright', 'install', 'chromium'])
} else {
  // Serverless-optimized Playwright
  await installPlaywrightVercel(sandbox, logger)
}
```

**File: `lib/validation/playwright-vercel-adapter.ts`**
```typescript
export async function installPlaywrightVercel(sandbox: Sandbox, logger: TaskLogger) {
  // Install playwright-core (lighter than full playwright)
  await sandbox.runCommand('npm', ['install', '-D', 'playwright-core'])

  // Install serverless Chromium
  await sandbox.runCommand('npm', ['install', '-D', '@sparticuz/chromium'])
}
```

---

## 🔧 Configuration

### Test Configuration for Vercel

Tests are automatically configured for serverless when running in Vercel mode:

```typescript
// playwright.config.ts (generated automatically)
import { defineConfig } from '@playwright/test'
import chromium from '@sparticuz/chromium'

export default defineConfig({
  use: {
    headless: true, // Always headless in Vercel
    launchOptions: {
      args: chromium.args,
      executablePath: await chromium.executablePath(),
    },
  },
})
```

### Environment Variables

```bash
# Force Vercel mode
EXECUTION_MODE=vercel

# Vercel credentials
VERCEL_TEAM_ID=team_xxxxx
VERCEL_PROJECT_ID=prj_xxxxx
VERCEL_TOKEN=your_token
```

---

## 📊 Comparison: Docker vs Vercel Sandbox

| Feature | Docker | Vercel Sandbox |
|---------|--------|----------------|
| **Installation** | `@playwright/test` + browsers | `playwright-core` + `@sparticuz/chromium` |
| **Browser Size** | ~280MB (Chromium) | ~50MB (serverless Chromium) |
| **Headless Tests** | ✅ Yes | ✅ Yes |
| **Screenshots** | ✅ Yes | ❌ No |
| **Video Recording** | ✅ Yes | ❌ No |
| **Visual Regression** | ✅ Yes | ❌ No |
| **Multi-Browser** | ✅ Chromium, Firefox, WebKit | ⚠️ Chromium only |
| **Debugging** | ✅ Full DevTools | ❌ Limited |
| **Performance** | Fast (local) | Medium (cloud latency) |
| **Setup Complexity** | Medium | Easy |
| **Internet Required** | No | Yes |

---

## 🎯 Best Practices

### When to Use Each Mode

**Use Vercel Sandbox for:**
- ✅ CI/CD pipelines (fast, no Docker setup)
- ✅ Functional testing
- ✅ Integration tests
- ✅ Smoke tests
- ✅ Production deployments without Docker

**Use Docker for:**
- ✅ Visual regression testing
- ✅ Debugging test failures
- ✅ Local development
- ✅ Cross-browser testing
- ✅ Tests requiring screenshots/videos

### Writing Portable Tests

Write tests that work in both modes:

```typescript
// ✅ Good - Works in both Docker and Vercel
test('login flow', async ({ page }) => {
  await page.goto('http://localhost:3000/login')
  await page.fill('input[name="email"]', 'user@example.com')
  await page.fill('input[name="password"]', 'password123')
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/.*dashboard/)
})

// ❌ Bad - Only works in Docker
test('visual test', async ({ page }) => {
  await page.goto('http://localhost:3000')
  await expect(page).toHaveScreenshot('homepage.png') // Fails in Vercel
})

// ✅ Better - Conditional based on environment
test('homepage appearance', async ({ page }) => {
  await page.goto('http://localhost:3000')

  if (process.env.EXECUTION_MODE === 'docker') {
    await expect(page).toHaveScreenshot('homepage.png')
  } else {
    // Use DOM assertions instead
    await expect(page.locator('header')).toBeVisible()
    await expect(page.locator('nav')).toContainText('Home')
  }
})
```

---

## 🐛 Troubleshooting

### Vercel Sandbox Issues

**Error: "Executable doesn't exist at .cache/ms-playwright/chromium"**
```
✅ Solution: This is expected. The adapter uses @sparticuz/chromium instead.
The error should not appear with the updated adapter.
```

**Error: "ENOENT: no such file or directory, open '/tmp/playwright'"**
```
✅ Solution: Ensure you're using playwright-core, not @playwright/test
```

**Error: "Browser closed unexpectedly"**
```
✅ Solution: Add timeout and retry logic:
test.setTimeout(60000) // Increase timeout
test.retries(2) // Retry failed tests
```

**Slow test execution**
```
✅ Solution: This is normal for cloud execution. Consider:
- Running critical tests only in Vercel
- Using Docker for comprehensive test suites
- Parallelizing tests
```

### Docker Issues

**Error: "Failed to launch browser"**
```
✅ Solution: Ensure browsers are installed:
npx playwright install chromium --with-deps
```

---

## 📚 Additional Resources

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [@sparticuz/chromium](https://github.com/Sparticuz/chromium)
- [Vercel Sandbox Docs](https://vercel.com/docs/vercel-sandbox)
- [Headless Testing Guide](https://playwright.dev/docs/ci)

---

## 🎓 Example Tests

### Functional Test (Works Everywhere)

```typescript
import { test, expect } from '@playwright/test'

test.describe('Shopping Cart', () => {
  test('add item to cart', async ({ page }) => {
    await page.goto('http://localhost:3000/products')

    // Find product and add to cart
    await page.click('button[data-product-id="123"]')

    // Verify cart badge updated
    const cartBadge = page.locator('.cart-badge')
    await expect(cartBadge).toHaveText('1')

    // Navigate to cart
    await page.click('.cart-icon')
    await expect(page).toHaveURL(/.*cart/)

    // Verify item is in cart
    await expect(page.locator('.cart-item')).toBeVisible()
  })
})
```

### Visual Test (Docker Only)

```typescript
import { test, expect } from '@playwright/test'

test.describe('Visual Regression', () => {
  test.skip(process.env.EXECUTION_MODE === 'vercel', 'Visual tests require Docker')

  test('homepage appearance', async ({ page }) => {
    await page.goto('http://localhost:3000')

    // Take screenshot
    await page.screenshot({ path: 'homepage.png', fullPage: true })

    // Visual comparison
    await expect(page).toHaveScreenshot('homepage-baseline.png', {
      maxDiffPixels: 100,
    })
  })
})
```

---

## ✅ Summary

**Yes, Playwright works in Vercel Sandbox!**

You get:
- ✅ Full headless testing capabilities
- ✅ Functional and integration tests
- ✅ Serverless-optimized performance
- ❌ No visual regression testing
- ❌ No screenshots or videos

For comprehensive testing including visual regression, use **Docker mode**. For fast functional testing in CI/CD, use **Vercel Sandbox**.

The platform **automatically handles both modes** - just toggle between them based on your needs! 🚀
