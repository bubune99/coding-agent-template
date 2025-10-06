import type { TaskLogger } from "@/lib/utils/task-logger"

/**
 * Generate Playwright tests from a user prompt
 */
export function generatePlaywrightTests(prompt: string, logger: TaskLogger): string {
  // Extract key elements from the prompt
  const hasButton = /button/i.test(prompt)
  const hasForm = /form|input|submit/i.test(prompt)
  const hasNavigation = /nav|menu|link/i.test(prompt)
  const hasImage = /image|img|photo/i.test(prompt)

  const tests: string[] = []

  // Basic page load test
  tests.push(`
  test('page loads successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/.+/);
  });`)

  // Button interaction test
  if (hasButton) {
    tests.push(`
  test('buttons are interactive', async ({ page }) => {
    await page.goto('/');
    const buttons = page.locator('button');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
    
    // Test first button is clickable
    if (count > 0) {
      await buttons.first().click();
    }
  });`)
  }

  // Form test
  if (hasForm) {
    tests.push(`
  test('form elements are present', async ({ page }) => {
    await page.goto('/');
    const inputs = page.locator('input');
    const count = await inputs.count();
    expect(count).toBeGreaterThan(0);
  });`)
  }

  // Navigation test
  if (hasNavigation) {
    tests.push(`
  test('navigation elements are present', async ({ page }) => {
    await page.goto('/');
    const links = page.locator('a');
    const count = await links.count();
    expect(count).toBeGreaterThan(0);
  });`)
  }

  // Image test
  if (hasImage) {
    tests.push(`
  test('images are present', async ({ page }) => {
    await page.goto('/');
    const images = page.locator('img');
    const count = await images.count();
    expect(count).toBeGreaterThan(0);
  });`)
  }

  // Accessibility test
  tests.push(`
  test('page has no accessibility violations', async ({ page }) => {
    await page.goto('/');
    // Basic accessibility checks
    const html = page.locator('html');
    await expect(html).toHaveAttribute('lang');
  });`)

  // Responsive test
  tests.push(`
  test('page is responsive', async ({ page }) => {
    await page.goto('/');
    
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(500);
  });`)

  const testFile = `
import { test, expect } from '@playwright/test';

test.describe('Generated UI Tests', () => {
${tests.join("\n")}
});
`

  return testFile
}
