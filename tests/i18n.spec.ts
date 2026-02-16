import { test, expect, type Page } from '@playwright/test';

test.describe('Internationalization (i18n)', () => {
    async function openLocaleMenu(page: Page) {
        const localeSwitcher = page.locator('header button').filter({ has: page.locator('svg.lucide-globe') }).first();
        await expect(localeSwitcher).toBeVisible({ timeout: 15000 });
        await localeSwitcher.click();
    }

    test('should switch language from English to Serbian', async ({ page }) => {
        await page.goto('/');

        await openLocaleMenu(page);
        const enOption = page.getByRole('menuitem', { name: /english|английский|engleski/i });
        await expect(enOption).toBeVisible();
        await enOption.click();

        const rosterEn = page.locator('nav').getByRole('link', { name: /roster/i }).first();
        await expect(rosterEn).toBeVisible();

        await openLocaleMenu(page);
        const srOption = page.getByRole('menuitem', { name: /serbian|сербский|srpski/i });
        await expect(srOption).toBeVisible();
        await srOption.click();

        await expect(page).toHaveURL(/\/$/);

        const rosterSr = page.locator('nav').getByRole('link', { name: /tim/i }).first();
        await expect(rosterSr).toBeVisible();
    });

    test('should switch to Russian', async ({ page }) => {
        await page.goto('/');

        await openLocaleMenu(page);
        const ruOption = page.getByRole('menuitem', { name: /russian|русский|ruski/i });
        await expect(ruOption).toBeVisible();
        await ruOption.click();

        await expect(page).toHaveURL(/\/$/);
        const rosterRu = page.locator('nav').getByRole('link', { name: /команда/i }).first();
        await expect(rosterRu).toBeVisible();
    });
});
