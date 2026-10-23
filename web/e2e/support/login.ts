import type { Page } from '@playwright/test';
import { expect } from '../fixtures';

/** Password of every test account in pocketbase/seed/dev-accounts.json. */
export const testPassword = 'snuffel-test';

/**
 * Opens `path` without a session, logs in as `username` on the login page it is sent to, and
 * waits until the app is back on `path`.
 */
export async function loginAs(page: Page, username: string, path: string): Promise<void> {
  await page.goto(path);
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel('Gebruikersnaam').fill(username);
  await page.getByLabel('Wachtwoord').fill(testPassword);
  await page.getByRole('button', { name: 'Inloggen' }).click();
  await expect(page.getByRole('button', { name: 'Uitloggen' })).toBeVisible();
  await expect(page).not.toHaveURL(/\/login/);
}
