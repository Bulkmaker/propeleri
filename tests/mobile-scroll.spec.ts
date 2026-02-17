import { test, expect } from '@playwright/test';

test.describe('Mobile Horizontal Scroll Navigation', () => {
    test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE size

    test('horizontal navigation should be visible and scrollable on mobile', async ({ page }) => {
        await page.goto('/');

        const scrollNav = page.locator('nav.overflow-x-auto').first();
        await expect(scrollNav).toBeVisible();

        // Verify it is scrollable horizontally
        const isScrollable = await scrollNav.evaluate((node) => {
            return node.scrollWidth > node.clientWidth;
        });

        expect(isScrollable).toBe(true);

        const lastLink = scrollNav.locator('a[href="/events"]').first();
        await lastLink.scrollIntoViewIfNeeded();
        await expect(lastLink).toBeInViewport();

        await lastLink.click();
        await expect(page).toHaveURL(/\/events(?:\/)?$/);
    });

    test('mobile burger menu should still work', async ({ page }) => {
        await page.goto('/');

        // Open sheet via burger menu
        // Header.tsx uses Button with Menu icon for SheetTrigger
        const burgerButton = page.locator('header').getByRole('button').filter({ has: page.locator('svg.lucide-menu') });
        await burgerButton.click();

        // Check if sheet content is visible
        const sheetContent = page.locator('[role="dialog"]');
        await expect(sheetContent).toBeVisible();

        const rosterLink = sheetContent.locator('a[href="/roster"]').first();
        await expect(rosterLink).toBeVisible();

        // Close sheet
        await page.keyboard.press('Escape');
        await expect(sheetContent).not.toBeVisible();
    });
});
