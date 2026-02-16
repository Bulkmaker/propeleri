import { test as base, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

type AccessibilityFixtures = {
  makeAxeBuilder: () => AxeBuilder;
};

export const test = base.extend<AccessibilityFixtures>({
  makeAxeBuilder: async ({ page }, applyFixture) => {
    const makeAxeBuilder = () =>
      new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        // Color contrast disabled: dark theme uses many colored badges/text
        // on dark backgrounds that are design decisions (brand orange, status
        // colors). Contrast is tracked via the dedicated report test instead.
        .disableRules(["color-contrast"]);
    await applyFixture(makeAxeBuilder);
  },
});

export { expect };
