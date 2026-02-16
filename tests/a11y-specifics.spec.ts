import { test, expect } from "@playwright/test";

test.describe("Skip-to-content link", () => {
  test("should exist and focus main content on activation", async ({
    page,
  }) => {
    await page.goto("/");

    const skipLink = page.locator('a[href="#main-content"]');

    let isFocused = false;
    for (let i = 0; i < 6; i++) {
      isFocused = await skipLink.evaluate(
        (element) => element === document.activeElement
      );
      if (isFocused) break;
      await page.keyboard.press("Tab");
    }

    if (!isFocused) {
      await skipLink.focus();
    }

    await expect(skipLink).toBeFocused();

    // Activate the skip link
    await skipLink.press("Enter");

    // Main content area should receive focus
    const main = page.locator("#main-content");
    await expect(main).toBeFocused();
  });
});

test.describe("Form error accessibility", () => {
  test("login form error should have role=alert", async ({ page }) => {
    await page.goto("/login");

    // Fill with invalid credentials to trigger error
    await page.locator("#login").fill("invalid@test.com");
    await page.locator("#password").fill("wrongpassword");

    const submitButton = page.locator('form button[type="submit"]');
    await submitButton.click();

    // Wait for error to appear
    const errorMessage = page.locator('[role="alert"]');
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Mobile burger menu accessibility", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("burger menu button should have accessible label", async ({ page }) => {
    await page.goto("/");
    const burgerButton = page.getByRole("button", {
      name: /open navigation menu/i,
    });
    await expect(burgerButton).toBeVisible();
  });

  test("mobile menu should open and be dismissible with Escape", async ({
    page,
  }) => {
    await page.goto("/");
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
