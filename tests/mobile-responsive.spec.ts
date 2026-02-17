import { test, expect } from "@playwright/test";

test.describe("Mobile Responsiveness", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  const pages = [
    { name: "Home", path: "/" },
    { name: "Roster", path: "/roster" },
    { name: "Stats", path: "/stats" },
    { name: "Events", path: "/events" },
    { name: "Login", path: "/login" },
  ];

  for (const { name, path } of pages) {
    test(`${name} page should have no horizontal overflow`, async ({
      page,
    }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      const overflow = await page.evaluate(() => {
        return document.body.scrollWidth > window.innerWidth;
      });

      expect(overflow, `${name} has horizontal overflow`).toBe(false);
    });
  }

  test("login form inputs and button should be fully visible", async ({
    page,
  }) => {
    await page.goto("/login");

    const loginInput = page.locator("#login");
    await expect(loginInput).toBeVisible();

    const passwordInput = page.locator("#password");
    await expect(passwordInput).toBeVisible();

    const submitButton = page.locator('form button[type="submit"]');
    await expect(submitButton).toBeVisible();

    // Verify the button is not cut off by the viewport
    const btnBox = await submitButton.boundingBox();
    expect(btnBox).not.toBeNull();
    expect(btnBox!.x + btnBox!.width).toBeLessThanOrEqual(375);
  });

  test("stats tables should scroll within container, not overflow page", async ({
    page,
  }) => {
    await page.goto("/stats");
    await page.waitForLoadState("networkidle");

    // Page body should not overflow
    const bodyOverflow = await page.evaluate(() => {
      return document.body.scrollWidth > window.innerWidth;
    });
    expect(bodyOverflow, "Stats page has horizontal overflow").toBe(false);
  });
});
