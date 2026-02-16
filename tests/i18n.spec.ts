import { test, expect, type Page } from '@playwright/test';

test.describe('Internationalization (i18n)', () => {
    function localeSwitcherButton(page: Page) {
        return page.getByTestId('locale-switcher-trigger');
    }

    async function openLocaleMenu(page: Page) {
        const localeSwitcher = localeSwitcherButton(page);
        await expect(localeSwitcher).toBeVisible({ timeout: 15000 });
        await localeSwitcher.click();
    }

    async function selectLocale(page: Page, locale: 'sr' | 'ru' | 'en') {
        await openLocaleMenu(page);
        const option = page.getByTestId(`locale-option-${locale}`);
        await expect(option).toBeVisible();
        try {
            await option.click({ timeout: 5000 });
        } catch {
            await option.evaluate((element) => {
                (element as HTMLElement).click();
            });
        }
        await expect(localeSwitcherButton(page)).toContainText(new RegExp(locale, 'i'));
    }

    test('should switch to English', async ({ page }) => {
        await page.goto('/');
        await selectLocale(page, 'en');
        await expect(page).toHaveURL(/\/$/);
    });

    test('should switch to Russian', async ({ page }) => {
        await page.goto('/');

        await selectLocale(page, 'ru');
        await expect(page).toHaveURL(/\/$/);
    });
});
