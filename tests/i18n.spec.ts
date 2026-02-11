import { test, expect } from '@playwright/test';

test.describe('Internationalization (i18n)', () => {
    test('should switch language from English to Serbian', async ({ page }) => {
        await page.goto('/en');

        // The locale switcher button has a Globe icon
        const localeSwitcher = page.locator('header button').filter({ has: page.locator('svg.lucide-globe') }).first();

        // Wait for the dynamic component to load and be visible
        await expect(localeSwitcher).toBeVisible({ timeout: 15000 });
        await localeSwitcher.click();

        // Look for Serbian (sr) option - "Srpski"
        const srOption = page.getByRole('menuitem', { name: /srpski/i });
        await expect(srOption).toBeVisible();
        await srOption.click();

        // Since sr is default and prefix is 'as-needed', it might go to /
        // Wait for URL change
        await page.waitForURL(url => url.pathname === '/' || url.pathname === '/sr');

        // Serbian translation for Roster is "Tim" in sr.json
        const rosterLink = page.locator('nav').getByRole('link', { name: /Tim/i }).first();
        await expect(rosterLink).toBeVisible();
    });

    test('should switch to Russian', async ({ page }) => {
        await page.goto('/en');

        const localeSwitcher = page.locator('header button').filter({ has: page.locator('svg.lucide-globe') }).first();
        await expect(localeSwitcher).toBeVisible({ timeout: 15000 });
        await localeSwitcher.click();

        const ruOption = page.getByRole('menuitem', { name: /русский/i });
        await expect(ruOption).toBeVisible();
        await ruOption.click();

        await page.waitForURL(/.*\/ru/);
        await expect(page).toHaveURL(/.*\/ru/);
    });
});
