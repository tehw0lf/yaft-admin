import { test, expect } from '@playwright/test';

test.describe('LocalStorage provider flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('has title', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('YaFT Admin');
  });

  test('full CRUD workflow: connect → create → toggle → delete', async ({ page }) => {
    // Step 1: Select Local Storage provider
    await page.locator('mat-select[formcontrolname="providerType"]').click();
    await page.locator('mat-option[value="local-storage"]').click();

    // Connect button should be enabled for local storage (no URL required)
    const connectButton = page.getByRole('button', { name: /connect/i });
    await expect(connectButton).toBeEnabled();
    await connectButton.click();

    // Wait for success message and auto-advance to feature step
    await expect(page.locator('.alert-card')).toContainText('connected');
    await page.waitForTimeout(1600);

    // Step 2: Verify we are on the feature management step
    await expect(page.locator('mat-card-title').filter({ hasText: 'Create New Feature Toggle' })).toBeVisible();

    // Step 3: Create a feature
    await page.locator('input[formcontrolname="key"]').fill('e2e-test-feature');

    // Set value to "true" (Enabled)
    await page.locator('mat-select[formcontrolname="value"]').click();
    await page.locator('mat-option[value="true"]').click();

    await page.getByRole('button', { name: /create feature/i }).click();

    // Feature should appear in the table
    await expect(page.locator('mat-cell').filter({ hasText: 'e2e-test-feature' })).toBeVisible();

    // Step 4: Toggle the feature off via the slide toggle
    const featureRow = page.locator('mat-row').filter({ hasText: 'e2e-test-feature' });
    const slideToggle = featureRow.locator('mat-slide-toggle');
    await expect(slideToggle).toBeVisible();
    await slideToggle.click();

    // Value text should update to "false"
    await expect(featureRow.locator('.value-text')).toContainText('false');

    // Step 5: Delete the feature
    page.on('dialog', (dialog) => dialog.accept());

    await featureRow.locator('button[mat-icon-button]').click();
    await page.locator('button[mat-menu-item]').filter({ hasText: 'Delete' }).click();

    // Feature should be gone from the table
    await expect(page.locator('mat-cell').filter({ hasText: 'e2e-test-feature' })).not.toBeVisible();
  });

  test('shows empty state when no features exist', async ({ page }) => {
    // Connect to local storage
    await page.locator('mat-select[formcontrolname="providerType"]').click();
    await page.locator('mat-option[value="local-storage"]').click();
    await page.getByRole('button', { name: /connect/i }).click();
    await page.waitForTimeout(1600);

    // Should show empty state message
    await expect(page.locator('.empty-state')).toContainText('No feature toggles found');
  });

  test('persists features in localStorage after creation', async ({ page }) => {
    // Connect to local storage
    await page.locator('mat-select[formcontrolname="providerType"]').click();
    await page.locator('mat-option[value="local-storage"]').click();
    await page.getByRole('button', { name: /connect/i }).click();
    await page.waitForTimeout(1600);

    // Create a feature
    await page.locator('input[formcontrolname="key"]').fill('persistent-feature');
    await page.getByRole('button', { name: /create feature/i }).click();

    await expect(page.locator('mat-cell').filter({ hasText: 'persistent-feature' })).toBeVisible();

    // Verify localStorage contains the feature
    const stored = await page.evaluate(() => localStorage.getItem('yaft-admin-features'));
    expect(stored).not.toBeNull();
    const features = JSON.parse(stored!);
    expect(features.some((f: { key: string }) => f.key === 'persistent-feature')).toBe(true);
  });

  test('validates required feature key', async ({ page }) => {
    // Connect to local storage
    await page.locator('mat-select[formcontrolname="providerType"]').click();
    await page.locator('mat-option[value="local-storage"]').click();
    await page.getByRole('button', { name: /connect/i }).click();
    await page.waitForTimeout(1600);

    // Try to submit without a key
    const createButton = page.getByRole('button', { name: /create feature/i });
    await expect(createButton).toBeDisabled();
  });
});
