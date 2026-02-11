import { test, expect } from '@playwright/test';

test.describe('General Navigation', () => {
    test('should navigate to all main pages from desktop header', async ({ page, isMobile }) => {
        test.skip(isMobile, 'This test is for desktop only');

        // Explicitly use /en to ensure we see English labels
        await page.goto('/en');

        // Check main links as they appear in src/components/layout/Header.tsx
        const linksToTest = [
            { name: 'Roster', href: '/en/roster' },
            { name: 'Schedule', href: '/en/schedule' },
            { name: 'Games', href: '/en/games' },
            { name: 'Stats', href: '/en/stats' },
            { name: 'Gallery', href: '/en/gallery' },
            { name: 'Events', href: '/en/events' },
        ];

        for (const link of linksToTest) {
            const nav = page.locator('nav.hidden.md\\:flex');
            const navLink = nav.getByRole('link', { name: new RegExp(link.name, 'i') });

            await expect(navLink).toBeVisible();
            await navLink.click();

            // The URL might be /en/roster or just /roster depending on how Link component handles it
            // But typically next-intl Link preserves the locale.
            await expect(page).toHaveURL(new RegExp(link.href));

            // Return to /en to continue
            await page.goto('/en');
        }
    });

    test('should show logo and navigate home', async ({ page }) => {
        await page.goto('/en/roster');
        // The logo is the first link in the header
        const logo = page.locator('header').getByRole('link').first();
        await expect(logo).toBeVisible();
        await logo.click();

        // Should go back to English home or root
        await expect(page).toHaveURL(/.*\/en$/);
    });
});
