import { test, expect } from "@playwright/test";

test.describe("Mobile Responsiveness", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  const pages = [
    { name: "Home", path: "/en" },
    { name: "Roster", path: "/en/roster" },
    { name: "Stats", path: "/en/stats" },
    { name: "Events", path: "/en/events" },
    { name: "Login", path: "/en/login" },
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
    await page.goto("/en/login");

    const loginInput = page.getByLabel(/login|email/i);
    await expect(loginInput).toBeVisible();

    const passwordInput = page.getByLabel(/password/i);
    await expect(passwordInput).toBeVisible();

    const submitButton = page.getByRole("button", { name: /log in|sign in/i });
    await expect(submitButton).toBeVisible();

    // Verify the button is not cut off by the viewport
    const btnBox = await submitButton.boundingBox();
    expect(btnBox).not.toBeNull();
    expect(btnBox!.x + btnBox!.width).toBeLessThanOrEqual(375);
  });

  test("stats tables should scroll within container, not overflow page", async ({
    page,
  }) => {
    await page.goto("/en/stats");
    await page.waitForLoadState("networkidle");

    // Page body should not overflow
    const bodyOverflow = await page.evaluate(() => {
      return document.body.scrollWidth > window.innerWidth;
    });
    expect(bodyOverflow, "Stats page has horizontal overflow").toBe(false);
  });
});
