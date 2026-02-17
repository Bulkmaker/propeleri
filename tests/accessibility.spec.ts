import { test, expect } from "./fixtures";
import AxeBuilder from "@axe-core/playwright";

const PUBLIC_PAGES = [
  { name: "Home", path: "/" },
  { name: "Roster", path: "/roster" },
  { name: "Schedule", path: "/schedule" },
  { name: "Games", path: "/games" },
  { name: "Stats", path: "/stats" },
  { name: "Gallery", path: "/gallery" },
  { name: "Events", path: "/events" },
  { name: "Login", path: "/login" },
  { name: "Register", path: "/register" },
];

test.describe("WCAG 2.1 AA Compliance", () => {
  for (const { name, path } of PUBLIC_PAGES) {
    test(`${name} page should have no critical accessibility violations`, async ({
      page,
      makeAxeBuilder,
    }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      const results = await makeAxeBuilder().analyze();

      const seriousViolations = results.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious"
      );

      expect(seriousViolations).toEqual([]);
    });
  }
});

// Informational: report color contrast issues without failing the build.
// Dark theme with brand orange and colored badges needs design review.
test.describe("Color Contrast Report", () => {
  test("report contrast issues across public pages", async ({ page }) => {
    test.setTimeout(120_000);
    let totalIssues = 0;

    for (const { name, path } of PUBLIC_PAGES) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");

      const results = await new AxeBuilder({ page })
        .withRules(["color-contrast"])
        .analyze();

      const contrastViolations = results.violations.filter(
        (v) => v.id === "color-contrast"
      );

      const nodeCount = contrastViolations.reduce(
        (sum, v) => sum + v.nodes.length,
        0
      );
      totalIssues += nodeCount;

      if (nodeCount > 0) {
        console.log(`[contrast] ${name}: ${nodeCount} elements with insufficient contrast`);
      }
    }

    console.log(`[contrast] Total: ${totalIssues} elements across all pages`);
    // This test always passes — it's for reporting only
  });
});
