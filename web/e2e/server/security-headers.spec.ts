import type { Page } from '@playwright/test';
import { expect, test } from '../fixtures';

// Set by pocketbase/pb_hooks/security.pb.js on every app route.
const CSP =
  "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; " +
  "object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'";

interface Violation {
  directive: string;
  blockedURI: string;
}

declare global {
  interface Window {
    __cspViolations: Violation[];
    __inlineScriptRan?: boolean;
  }
}

/** Records every CSP violation of the page in `window.__cspViolations`. */
async function recordViolations(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      window.__cspViolations.push({
        directive: event.effectiveDirective,
        blockedURI: event.blockedURI,
      });
    });
  });
}

/** The browser's own console message for the 400 of a refused login, and nothing else. */
function isRefusedLoginMessage(text: string, url: string): boolean {
  return (
    text === 'Failed to load resource: the server responded with a status of 400 (Bad Request)' &&
    URL.canParse(url) &&
    new URL(url).pathname === '/api/collections/users/auth-with-password'
  );
}

function violations(page: Page): Promise<Violation[]> {
  return page.evaluate(() => window.__cspViolations);
}

test.describe('security headers', () => {
  for (const path of ['/', '/login', '/stijl', '/assets/ted.svg']) {
    test(`${path} has the CSP and the other security headers`, async ({ request }) => {
      const response = await request.get(path);
      expect(response.status()).toBe(200);
      const headers = response.headers();
      expect(headers['content-security-policy']).toBe(CSP);
      expect(headers['referrer-policy']).toBe('no-referrer');
      expect(headers['x-content-type-options']).toBe('nosniff');
    });
  }

  test('/api/ has no CSP', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-security-policy']).toBeUndefined();
    expect(response.headers()['referrer-policy']).toBeUndefined();
  });

  test('/_/ does not get the app CSP', async ({ request }) => {
    // The admin UI sends its own, PocketBase-defined policy; the hook leaves it alone.
    const response = await request.get('/_/');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-security-policy']).not.toBe(CSP);
    expect(response.headers()['referrer-policy']).toBeUndefined();
  });
});

test.describe('the app under the CSP', () => {
  test('/stijl has no CSP violations and no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await recordViolations(page);

    await page.goto('/stijl');
    await expect(page.getByRole('heading', { level: 2, name: 'Ted', exact: true })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);

    expect(await violations(page)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('/login has no CSP violations and no console errors, also when logging in', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await recordViolations(page);

    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Inloggen' })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    expect(await violations(page)).toEqual([]);

    await page.getByLabel('Gebruikersnaam').fill('kind-a');
    await page.getByLabel('Wachtwoord').fill('snuffel-test');
    await page.getByRole('button', { name: 'Inloggen' }).click();
    await expect(page.getByRole('button', { name: 'Uitloggen' })).toBeVisible();

    expect(await violations(page)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('a failed login attempt causes no CSP violations and no other console errors', async ({
    page,
  }) => {
    const errors: string[] = [];
    const expectedNetworkErrors: string[] = [];
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      // The browser itself logs the 400 of the refused login; that one message is expected.
      if (isRefusedLoginMessage(message.text(), message.location().url)) {
        expectedNetworkErrors.push(message.text());
        return;
      }
      errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await recordViolations(page);

    await page.goto('/login');
    await page.getByLabel('Gebruikersnaam').fill('kind-a');
    await page.getByLabel('Wachtwoord').fill('fout-wachtwoord');
    await page.getByRole('button', { name: 'Inloggen' }).click();
    await expect(page.getByRole('alert')).toBeVisible();

    expect(await violations(page)).toEqual([]);
    expect(errors).toEqual([]);
    // Exactly that one network message, so the filter cannot silently swallow anything else.
    await expect.poll(() => expectedNetworkErrors.length).toBe(1);
  });

  test('applies the global styles and fonts', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/stijl');
    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    // --snf-color-yellow (#ffd83d)
    expect(background).toBe('rgb(255, 216, 61)');

    const bangers = await page.evaluate(async () => {
      await document.fonts.load('1em Bangers');
      await document.fonts.ready;
      return document.fonts.check('1em Bangers');
    });
    expect(bangers).toBe(true);
  });

  test('draws Ted in all four moods', async ({ page }) => {
    await page.goto('/stijl');
    const labels = [
      'Ted, een pluizige bruine pup met zonnebril',
      'Ted, een pluizige bruine pup, kijkt blij',
      'Ted, een pluizige bruine pup, denkt na',
      'Ted, een pluizige bruine pup, kijkt geschrokken',
    ];
    for (const label of labels) {
      await expect(page.getByRole('img', { name: label, exact: true })).toBeVisible();
    }

    const happy = page.getByRole('img', { name: labels[1], exact: true });
    const bril = await happy.evaluate((svg) => getComputedStyle(svg).getPropertyValue('--m-bril'));
    expect(bril.trim()).toBe('none');
    await expect
      .poll(() => happy.evaluate((svg) => svg.querySelector('use')?.getBBox().width ?? 0))
      .toBeGreaterThan(0);
  });

  // Only an inline script: Chromium reports an external image as a request even when the CSP
  // blocks it, and the privacy fixture rightly rejects that (see m04.md, "Risico's").
  test('blocks an injected inline script (the measurement works)', async ({ page }) => {
    await recordViolations(page);
    await page.goto('/');
    await page.evaluate(() => {
      const script = document.createElement('script');
      script.textContent = 'window.__inlineScriptRan = true;';
      document.body.append(script);
    });

    await expect
      .poll(() => violations(page))
      .toContainEqual({
        directive: 'script-src-elem',
        blockedURI: 'inline',
      });
    expect(await page.evaluate(() => window.__inlineScriptRan)).toBeUndefined();
  });
});
