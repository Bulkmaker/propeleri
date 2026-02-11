import { test, expect } from '@playwright/test';

test.describe('Mobile Horizontal Scroll Navigation', () => {
    test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE size

    test('horizontal navigation should be visible and scrollable on mobile', async ({ page }) => {
        // Navigate to English version explicitly
        await page.goto('/en');

        // Locate the horizontal scroll container added in Header.tsx
        const scrollNav = page.locator('nav.overflow-x-auto').filter({ hasText: /ROSTER/i });
        await expect(scrollNav).toBeVisible();

        // Verify it is scrollable horizontally
        const isScrollable = await scrollNav.evaluate((node) => {
            return node.scrollWidth > node.clientWidth;
        });

        expect(isScrollable).toBe(true);

        // Get the last link and verify it can be scrolled to
        const lastLink = scrollNav.getByRole('link', { name: /EVENTS/i });
        await lastLink.scrollIntoViewIfNeeded();
        await expect(lastLink).toBeInViewport();

        await lastLink.click();
        await expect(page).toHaveURL(/.*\/en\/events/);
    });

    test('mobile burger menu should still work', async ({ page }) => {
        await page.goto('/en');

        // Open sheet via burger menu
        // Header.tsx uses Button with Menu icon for SheetTrigger
        const burgerButton = page.locator('header').getByRole('button').filter({ has: page.locator('svg.lucide-menu') });
        await burgerButton.click();

        // Check if sheet content is visible
        const sheetContent = page.locator('[role="dialog"]');
        await expect(sheetContent).toBeVisible();

        // Verify link inside sheet
        const rosterLink = sheetContent.getByRole('link', { name: /ROSTER/i });
        await expect(rosterLink).toBeVisible();

        // Close sheet
        await page.keyboard.press('Escape');
        await expect(sheetContent).not.toBeVisible();
    });
});
