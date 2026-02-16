import { test, expect } from '@playwright/test';

test.describe('General Navigation', () => {
    test('should navigate to all main pages from desktop header', async ({ page, isMobile }) => {
        test.skip(isMobile, 'This test is for desktop only');

        await page.goto('/');

        const linksToTest = [
            { href: '/roster' },
            { href: '/games' },
            { href: '/training' },
            { href: '/stats' },
            { href: '/gallery' },
            { href: '/events' },
        ];

        for (const link of linksToTest) {
            const nav = page.locator('nav.hidden.md\\:flex');
            const navLink = nav.locator(`a[href="${link.href}"]`).first();

            await expect(navLink).toBeVisible();
            await navLink.click();

            const hrefPattern = link.href.split('/').join('\\/');
            await expect(page).toHaveURL(new RegExp(`${hrefPattern}(?:\\/)?$`));

            await page.goto('/');
        }
    });

    test('should show logo and navigate home', async ({ page }) => {
        await page.goto('/roster');
        const logo = page.locator('header').getByRole('link').first();
        await expect(logo).toBeVisible();
        await logo.click();

        await expect(page).toHaveURL(/\/$/);
    });
});
