import AxeBuilder from '@axe-core/playwright';
import type { Locator, Page } from '@playwright/test';
import { expect, test } from '../fixtures';

// Test accounts from pocketbase/seed/dev-accounts.json (seeded by server/seed.setup.ts).
// These tests only log in and read, so they can run in parallel on the same accounts.
const password = 'snuffel-test';
const storageKey = 'pocketbase_auth';
const oops = 'Hmm, dat klopt niet. Kijk je gebruikersnaam en wachtwoord nog eens na.';

function usernameField(page: Page): Locator {
  return page.getByLabel('Gebruikersnaam');
}

function passwordField(page: Page): Locator {
  return page.getByLabel('Wachtwoord');
}

function loginButton(page: Page): Locator {
  return page.getByRole('button', { name: 'Inloggen' });
}

function logoutButton(page: Page): Locator {
  return page.getByRole('button', { name: 'Uitloggen' });
}

async function fillLogin(page: Page, username: string, secret = password): Promise<void> {
  await usernameField(page).fill(username);
  await passwordField(page).fill(secret);
  await loginButton(page).click();
}

/** Opens `path` without a session, logs in on the login page and waits for the result. */
async function loginVia(page: Page, path: string, username: string): Promise<void> {
  await page.goto(path);
  await expect(page).toHaveURL(/\/login/);
  await fillLogin(page, username);
  await expect(logoutButton(page)).toBeVisible();
}

function session(page: Page): Promise<string | null> {
  return page.evaluate((key) => localStorage.getItem(key), storageKey);
}

function pathAndQuery(page: Page): string {
  const url = new URL(page.url());
  return `${url.pathname}${url.search}`;
}

test.describe('login', () => {
  test('/ without a session goes to /login?terug=%2F, with Ted and the form', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login\?terug=%2F$/);
    await expect(page).toHaveTitle('Inloggen · Snuffel');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Snuffel');
    await expect(page.getByText('Yo! Ik ben Ted. Wie gaat er snuffelen?')).toBeVisible();
    await expect(page.locator('snf-ted svg')).toBeVisible();
    await expect(usernameField(page)).toBeVisible();
    await expect(passwordField(page)).toBeVisible();
    await expect(loginButton(page)).toBeVisible();
  });

  test('kind-a logs in, is greeted by name and stays logged in after a reload', async ({
    page,
  }) => {
    await loginVia(page, '/', 'kind-a');
    expect(pathAndQuery(page)).toBe('/');
    await expect(page.getByText('Hoi, Kind A!')).toBeVisible();
    await expect(page.getByRole('banner')).toContainText('Kind A');

    await page.reload();
    expect(pathAndQuery(page)).toBe('/');
    await expect(page.getByText('Hoi, Kind A!')).toBeVisible();
    await expect(logoutButton(page)).toBeVisible();
  });

  test('the username is not case-sensitive and may have spaces around it', async ({ page }) => {
    await page.goto('/login');
    await fillLogin(page, '  Kind-A ');
    await expect(page.getByText('Hoi, Kind A!')).toBeVisible();
  });

  test('a wrong password shows Ted oops and keeps you on /login without a session', async ({
    page,
  }) => {
    await page.goto('/login');
    await fillLogin(page, 'kind-a', 'fout-wachtwoord');
    await expect(page.getByRole('alert')).toHaveText(oops);
    expect(new URL(page.url()).pathname).toBe('/login');
    await expect(passwordField(page)).toHaveValue('');
    await expect(passwordField(page)).toBeFocused();
    expect(await session(page)).toBeNull();
  });

  test('an empty form gives a message and sends nothing', async ({ page }) => {
    const apiCalls: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/')) apiCalls.push(request.url());
    });
    await page.goto('/login');
    await loginButton(page).click();
    await expect(page.getByText('Vul je gebruikersnaam in.')).toBeVisible();
    await expect(usernameField(page)).toBeFocused();
    expect(apiCalls).toEqual([]);
  });
});

test.describe('guards', () => {
  test('a child on /ouder goes to /', async ({ page }) => {
    await loginVia(page, '/', 'kind-a');
    await page.goto('/ouder');
    await expect(page.getByText('Hoi, Kind A!')).toBeVisible();
    expect(pathAndQuery(page)).toBe('/');
    await expect(page.getByText('Ouderoverzicht')).toHaveCount(0);
  });

  test('the parent sees Ouderoverzicht on /ouder', async ({ page }) => {
    await loginVia(page, '/', 'ouder');
    await page.goto('/ouder');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ouderoverzicht');
    await expect(page).toHaveTitle('Ouderoverzicht · Snuffel');
    await expect(page.getByText('Hier zie je straks hoe het met de kinderen gaat.')).toBeVisible();
  });

  test('logging in via /login?terug=%2Fouder lands on /ouder', async ({ page }) => {
    await page.goto('/ouder');
    await expect(page).toHaveURL(/\/login\?terug=%2Fouder$/);
    await fillLogin(page, 'ouder');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ouderoverzicht');
    expect(pathAndQuery(page)).toBe('/ouder');
  });

  test('terug=//example.com lands on / after logging in', async ({ page }) => {
    await page.goto('/login?terug=//example.com');
    await fillLogin(page, 'kind-a');
    await expect(page.getByText('Hoi, Kind A!')).toBeVisible();
    expect(new URL(page.url()).origin).toBe(new URL(test.info().project.use.baseURL!).origin);
    expect(pathAndQuery(page)).toBe('/');
  });

  test('/login when logged in goes to /', async ({ page }) => {
    await loginVia(page, '/', 'kind-a');
    await page.goto('/login');
    await expect(page.getByText('Hoi, Kind A!')).toBeVisible();
    expect(pathAndQuery(page)).toBe('/');
  });
});

test.describe('logout and sessions', () => {
  test('logging out goes to /login and forgets the session', async ({ page }) => {
    await loginVia(page, '/', 'kind-a');
    expect(await session(page)).not.toBeNull();
    await logoutButton(page).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(loginButton(page)).toBeVisible();
    await expect(logoutButton(page)).toHaveCount(0);
    expect(await session(page)).toBeNull();

    await page.goto('/');
    await expect(page).toHaveURL(/\/login\?terug=%2F$/);
  });

  test('logging out in tab 1 sends tab 2 to /login on its next navigation', async ({
    page,
    context,
  }) => {
    await loginVia(page, '/', 'ouder');
    const second = await context.newPage();
    await second.goto('/');
    await expect(second.getByText('Hoi, Ouder!')).toBeVisible();

    await logoutButton(page).click();
    await expect(page).toHaveURL(/\/login$/);

    // Tab 2 hears about it through the storage event: the bar goes away at once ...
    await expect(logoutButton(second)).toHaveCount(0);
    // ... and the next navigation inside the app (no reload) ends on the login page.
    await second.evaluate(() => {
      history.pushState(null, '', '/ouder');
      dispatchEvent(new PopStateEvent('popstate', { state: null }));
    });
    await expect(second).toHaveURL(/\/login\?terug=%2Fouder$/);
    await expect(loginButton(second)).toBeVisible();
    await second.close();
  });

  test('a forged token (valid shape, wrong signature) goes to /login and is cleared', async ({
    page,
  }) => {
    await loginVia(page, '/', 'kind-a');
    const stored = JSON.parse((await session(page))!) as { token: string; record: object };
    const [header, payload, signature] = stored.token.split('.');
    const forged = `${header}.${payload}.${signature.startsWith('A') ? 'B' : 'A'}${signature.slice(1)}`;
    await page.evaluate(
      ([key, value]) => localStorage.setItem(key, value),
      [storageKey, JSON.stringify({ ...stored, token: forged })],
    );

    const refused = page.waitForResponse(
      (response) => response.url().endsWith('/auth-refresh') && response.status() === 401,
    );
    await page.goto('/');
    await refused;
    await expect(page).toHaveURL(/\/login/);
    await expect(loginButton(page)).toBeVisible();
    expect(await session(page)).toBeNull();
  });

  test('an expired token goes to /login straight away', async ({ page }) => {
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const exp = Math.floor(Date.now() / 1000) - 60;
    const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ id: 'x', type: 'auth', exp })}.c2ln`;
    const record = {
      id: 'x',
      collectionName: 'users',
      username: 'kind-a',
      name: 'Kind A',
      role: 'child',
    };
    const apiCalls: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.startsWith('/api/')) apiCalls.push(request.url());
    });
    await page.addInitScript(
      ([key, value]) => {
        if (!sessionStorage.getItem('seeded')) {
          sessionStorage.setItem('seeded', '1');
          localStorage.setItem(key, value);
        }
      },
      [storageKey, JSON.stringify({ token, record })],
    );

    await page.goto('/');
    await expect(page).toHaveURL(/\/login\?terug=%2F$/);
    await expect(loginButton(page)).toBeVisible();
    await expect(page.getByText('Hoi, Kind A!')).toHaveCount(0);
    expect(await session(page)).toBeNull();
    expect(apiCalls).toEqual([]);
  });
});

test.describe('accessibility', () => {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`/login has no axe violations (${colorScheme})`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto('/login');
      await expect(loginButton(page)).toBeVisible();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    });

    test(`/login with the error message has no axe violations (${colorScheme})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      await page.goto('/login');
      await fillLogin(page, 'kind-a', 'fout-wachtwoord');
      await expect(page.getByRole('alert')).toHaveText(oops);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    });
  }

  test('/ and /ouder have no axe violations when logged in (light and dark)', async ({ page }) => {
    await loginVia(page, '/', 'ouder');
    for (const colorScheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme });
      await page.goto('/');
      await expect(page.getByText('Hoi, Ouder!')).toBeVisible();
      expect((await new AxeBuilder({ page }).analyze()).violations, `/ ${colorScheme}`).toEqual([]);
      await page.goto('/ouder');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ouderoverzicht');
      expect(
        (await new AxeBuilder({ page }).analyze()).violations,
        `/ouder ${colorScheme}`,
      ).toEqual([]);
    }
  });

  async function expectTapTarget(target: Locator, label: string): Promise<void> {
    const box = await target.boundingBox();
    expect(box, `bounding box of ${label}`).not.toBeNull();
    expect(box!.width, `width of ${label}`).toBeGreaterThanOrEqual(44);
    expect(box!.height, `height of ${label}`).toBeGreaterThanOrEqual(44);
  }

  async function expectFocusRing(page: Page, target: Locator, label: string): Promise<void> {
    await expect(target, `${label} has focus`).toBeFocused();
    const outline = await target.evaluate((element) => {
      const style = getComputedStyle(element);
      return { style: style.outlineStyle, width: style.outlineWidth };
    });
    expect(outline.style, `outline of ${label}`).not.toBe('none');
    expect(outline.width, `outline width of ${label}`).toBe('3px');
  }

  test('login fields and buttons are big enough and show a focus ring', async ({ page }) => {
    await page.goto('/login');
    await expectTapTarget(usernameField(page), 'Gebruikersnaam');
    await expectTapTarget(passwordField(page), 'Wachtwoord');
    await expectTapTarget(loginButton(page), 'Inloggen');

    await usernameField(page).focus();
    await expectFocusRing(page, usernameField(page), 'Gebruikersnaam');
    await page.keyboard.press('Tab');
    await expectFocusRing(page, passwordField(page), 'Wachtwoord');
    await page.keyboard.press('Tab');
    await expectFocusRing(page, loginButton(page), 'Inloggen');

    await usernameField(page).fill('kind-a');
    await passwordField(page).fill(password);
    await page.keyboard.press('Enter');
    await expect(logoutButton(page)).toBeVisible();
    await expectTapTarget(logoutButton(page), 'Uitloggen');
    // From the top of a freshly loaded page, Tab reaches the top bar first.
    await page.reload();
    await expect(logoutButton(page)).toBeVisible();
    await page.keyboard.press('Tab');
    await expectFocusRing(page, logoutButton(page), 'Uitloggen');
  });
});
