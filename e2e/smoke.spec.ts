import { test, expect } from "@playwright/test";

// Stretch smoke test: select three available seats, reload, confirm they persist.
test("select three seats and persist across reload", async ({ page }) => {
  await page.goto("/");

  // Wait for the map to be ready.
  await expect(page.getByRole("application")).toBeVisible();

  // Click the first three available seats by their aria-labels.
  const available = page.locator('[role="button"][aria-disabled="false"]');
  await expect(available.first()).toBeVisible();

  for (let i = 0; i < 3; i++) {
    await available.nth(i).click();
  }

  // Summary reports 3/8.
  await expect(page.getByRole("heading", { name: /Selection \(3\/8\)/ })).toBeVisible();

  // Reload; selection should be restored from localStorage.
  await page.reload();
  await expect(page.getByRole("application")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Selection \(3\/8\)/ })).toBeVisible();
});
