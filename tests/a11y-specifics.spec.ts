import { test, expect } from "@playwright/test";

test.describe("Skip-to-content link", () => {
  test("should exist and focus main content on activation", async ({
    page,
  }) => {
    await page.goto("/en");

    // Tab once to reveal skip link
    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: /skip to content/i });
    await expect(skipLink).toBeFocused();

    // Activate the skip link
    await page.keyboard.press("Enter");

    // Main content area should receive focus
    const main = page.locator("#main-content");
    await expect(main).toBeFocused();
  });
});

test.describe("Form error accessibility", () => {
  test("login form error should have role=alert", async ({ page }) => {
    await page.goto("/en/login");

    // Fill with invalid credentials to trigger error
    await page.getByLabel(/login|email/i).fill("invalid@test.com");
    await page.getByLabel(/password/i).fill("wrongpassword");

    const submitButton = page.getByRole("button", { name: /log in|sign in/i });
    await submitButton.click();

    // Wait for error to appear
    const errorMessage = page.locator('[role="alert"]');
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Mobile burger menu accessibility", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("burger menu button should have accessible label", async ({ page }) => {
    await page.goto("/en");
    const burgerButton = page.getByRole("button", {
      name: /open navigation menu/i,
    });
    await expect(burgerButton).toBeVisible();
  });

  test("mobile menu should open and be dismissible with Escape", async ({
    page,
  }) => {
    await page.goto("/en");
    const burgerButton = page.getByRole("button", {
      name: /open navigation menu/i,
    });
    await burgerButton.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });
});
