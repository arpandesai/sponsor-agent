import { test, expect } from '@playwright/test';

const TEST_ORG_URL = 'https://rowingaustralia.com.au';

test('completes the funding discovery journey against real APIs', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel(/organisation website/i).fill(TEST_ORG_URL);
  await page.getByRole('button', { name: /find funding opportunities/i }).click();

  await expect(page).toHaveURL(/\/analyze\?url=/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Understanding your organisation' })).toBeVisible();

  // Real scrape + LLM extraction can take a while.
  await expect(page).toHaveURL('/confirm', { timeout: 120_000 });

  const nameInput = page.locator('input').first();
  await expect(nameInput).not.toHaveValue('', { timeout: 10_000 });

  await page.getByRole('button', { name: /looks good/i }).click();

  // Real web-search funding estimate can also take a while.
  await expect(page).toHaveURL('/dashboard', { timeout: 120_000 });

  await expect(page.getByRole('heading', { name: 'Sponsorship' })).toBeVisible();
  await expect(page.getByText(/potential sponsors/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Grants' })).toBeVisible();
  await expect(page.getByText(/matching grants/)).toBeVisible();

  await expect(page.getByRole('button', { name: /find grants/i })).toBeDisabled();

  await page.getByRole('button', { name: /view sponsors/i }).click();
  await expect(page).toHaveURL('/sponsors', { timeout: 15_000 });

  // Real web-search sponsor discovery can take a while.
  await expect(page.getByText(/% match/).first()).toBeVisible({ timeout: 60_000 });

  // Click into the first sponsor card.
  await page.locator('button').filter({ hasText: '% match' }).first().click();
  await expect(page).toHaveURL(/\/sponsors\/\d+$/, { timeout: 15_000 });
  await expect(page.getByRole('button', { name: /generate pitch/i })).toBeVisible();

  await page.getByRole('button', { name: /generate pitch/i }).click();
  await expect(page).toHaveURL(/\/sponsors\/\d+\/pitch$/, { timeout: 15_000 });

  // Real pitch drafting can take a while.
  await expect(page.locator('input')).not.toHaveValue('', { timeout: 60_000 });
  await expect(page.locator('textarea')).not.toHaveValue('');
});
