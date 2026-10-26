import AxeBuilder from '@axe-core/playwright';
import { devices, type Page } from '@playwright/test';
import { plainText } from '../../src/app/shared/inline-text/inline-markup';
import { expect, test } from '../fixtures';
import {
  drillBlock,
  drillChars,
  navLink,
  section,
  settle,
  startDrill,
  storedRecords,
  typeAll,
  typeLine,
  typing,
  typingStep,
  typingTotal,
} from './actions';
import { openTypingLesson, typingLesson } from './fixture';

const resultsPattern = '**/api/collections/interaction_results/records**';
const anchor = '#stap-typen';
const ted = typingLesson.ted;
const gap = 500;

// A laptop (a fine pointer, no touch) and a phone; set per describe so that no test is skipped
// in either server project. `defaultBrowserType` cannot be set in a describe.
const pixel = devices['Pixel 7'];
const phone = {
  viewport: pixel.viewport,
  userAgent: pixel.userAgent,
  deviceScaleFactor: pixel.deviceScaleFactor,
  isMobile: pixel.isMobile,
  hasTouch: pixel.hasTouch,
};
const laptop = {
  viewport: { width: 1280, height: 800 },
  hasTouch: false,
  isMobile: false,
  deviceScaleFactor: 1,
};

function previous(page: Page) {
  return section(page, typingStep.id).locator('.previous');
}

async function marks(page: Page): Promise<string> {
  return drillChars(page).evaluateAll((chars) =>
    chars
      .map((char) =>
        char.classList.contains('correct') ? 'c' : char.classList.contains('wrong') ? 'w' : '.',
      )
      .join(''),
  );
}

async function currentIndex(page: Page): Promise<number> {
  return drillChars(page).evaluateAll((chars) =>
    chars.findIndex((char) => char.classList.contains('current')),
  );
}

async function tedText(page: Page): Promise<string> {
  return (await drillBlock(page).locator('.say').innerText()).replace(/\s+/g, ' ').trim();
}

test.describe('the typing drill on a laptop', () => {
  test.use(laptop);

  test('typing every line right gives 100% and the speed', async ({ page }) => {
    await page.clock.install();
    await openTypingLesson(page, { hash: anchor });
    const block = drillBlock(page);
    await expect(block.locator('.heading')).toHaveText(`${typing.lines.length} regels`);
    await startDrill(page);
    await page.clock.pauseAt(new Date(Date.now() + 60_000));
    await typeAll(page, gap);

    // 60 right keys from the first to the last key: (total - 1) gaps of 500 ms.
    const durationMs = (typingTotal - 1) * gap;
    const keysPerMinute = Math.round((typingTotal * 60_000) / durationMs);
    await expect(block.locator('.results li').nth(0)).toHaveText(
      `Nauwkeurigheid: 100% goed (${typingTotal} van ${typingTotal} aanslagen)`,
    );
    await expect(block.locator('.results li').nth(1)).toHaveText(
      `Snelheid: ${keysPerMinute} aanslagen per minuut`,
    );
    await expect(block.locator('.results li').nth(2)).toHaveText('Geen fouten!');
    // The goal (90%) is met: Ted is cool with a line from ted.correct.
    const said = await tedText(page);
    const line = ted.correct.map(plainText).find((candidate) => said.startsWith(candidate));
    expect(line, said).toBeDefined();
    expect(said).toContain('Doel gehaald: 90% goed.');
    await expect(block.locator('snf-ted-says snf-ted svg')).not.toHaveCSS('--m-bril', 'none');
    await expect(block.getByRole('button', { name: 'Nog een keer', exact: true })).toBeVisible();

    await settle(page);
    const [result] = (await storedRecords(page)).interaction_results;
    expect(result['score']).toBe(typingTotal);
    expect(result['total']).toBe(typingTotal);
    expect(result['detail']).toEqual({ keysPerMinute, durationMs, mistakes: [] });
  });

  test('a wrong key turns red with a mark and the cursor moves on', async ({ page }) => {
    await openTypingLesson(page, { hash: anchor });
    await startDrill(page);
    const first = typing.lines[0];
    await expect.poll(() => currentIndex(page)).toBe(0);
    await page.keyboard.type('a');
    await page.keyboard.type('x');
    await page.keyboard.type('d');
    await expect.poll(() => marks(page)).toBe('cwc' + '.'.repeat(first.length - 3));
    // The cursor went on to the 4th char, not back.
    await expect.poll(() => currentIndex(page)).toBe(3);
    // A wrong char is more than red: a cross, and text for a screen reader.
    const wrong = drillChars(page).nth(1);
    await expect(wrong.locator('.cross')).toHaveText('✗');
    await expect(wrong).toContainText('(fout)');
    await expect(wrong).toHaveCSS('text-decoration-line', /underline/);
    // The right chars have no mark.
    await expect(drillChars(page).nth(0).locator('.cross')).toHaveCount(0);

    // The rest of the line, then the wrong key counts in the result.
    await page.keyboard.type(first.slice(3));
    await expect(drillBlock(page).locator('.counter')).toHaveText(
      `Regel 2 van ${typing.lines.length}`,
    );
    for (const line of typing.lines.slice(1)) await typeLine(page, line);
    await expect(drillBlock(page).locator('.results li').nth(0)).toHaveText(
      `Nauwkeurigheid: ${Math.floor(((typingTotal - 1) / typingTotal) * 100)}% goed (${typingTotal - 1} van ${typingTotal} aanslagen)`,
    );
    // The key that should have been pressed (s), not the wrong one (x).
    await expect(drillBlock(page).locator('.results li').nth(2)).toHaveText('Vaakst fout: s (1×)');
  });

  test('a missed goal makes Ted think and name the goal', async ({ page }) => {
    await openTypingLesson(page, { hash: anchor });
    await startDrill(page);
    for (const line of typing.lines) await typeLine(page, 'x'.repeat(line.length));
    await expect(drillBlock(page).getByRole('heading', { name: 'Klaar!' })).toBeVisible();
    const said = await tedText(page);
    const line = ted.incorrect.map(plainText).find((candidate) => said.startsWith(candidate));
    expect(line, said).toBeDefined();
    expect(said).toContain('Je doel is 90% goed.');
    await expect(drillBlock(page).locator('.results li').nth(0)).toContainText('% goed');
    await expect(drillBlock(page).locator('snf-ted-says snf-ted svg')).toHaveCSS(
      '--m-bril',
      'none',
    );
  });

  test('the keyboard shows the key and finger of the next char and marks the new keys', async ({
    page,
  }) => {
    await openTypingLesson(page, { hash: anchor });
    const block = drillBlock(page);
    // The start screen names the new keys.
    await expect(block.locator('.new-keys')).toHaveText(
      '★ Nieuw: a, s, d, f, j, k, l, ; en spatie',
    );
    await startDrill(page);
    const keyboard = block.locator('snf-typing-keyboard');
    // The drawn keyboard is hidden from a screen reader; the text says it.
    await expect(keyboard.locator('.keyboard')).toHaveAttribute('aria-hidden', 'true');
    await expect(keyboard.locator('.next-key')).toHaveText('Volgende toets: a, linkerpink');
    await expect(keyboard.locator('.key.next')).toHaveCount(1);
    await expect(keyboard.locator('[data-key="a"]')).toHaveClass(/\bnext\b/);
    await expect(keyboard.locator('[data-key="a"]')).toHaveClass(/finger-pinky/);
    await expect(keyboard.locator('.legend .finger.now')).toHaveCount(1);
    await expect(keyboard.locator('.legend .finger.now')).toContainText('pink');
    await expect(keyboard.locator('.legend .finger.now')).toContainText('← nu');
    // New keys have a star; keys that are not new do not.
    for (const key of ['a', 'f', 'j', ';']) {
      await expect(keyboard.locator(`[data-key="${key}"]`)).toHaveClass(/\bnew\b/);
      await expect(keyboard.locator(`[data-key="${key}"] .star`)).toHaveText('★');
    }
    await expect(keyboard.locator('[data-key="q"]')).not.toHaveClass(/\bnew\b/);
    await expect(keyboard.locator('[data-key="q"] .star')).toHaveCount(0);
    // The next key is marked with a thick purple border (not only a colour change).
    await expect(keyboard.locator('[data-key="a"]')).not.toHaveCSS('border-top-width', '0px');

    // After "a" the key moves to "s" and the finger to the ring finger; no mouse involved.
    await page.keyboard.type('a');
    await expect(keyboard.locator('.next-key')).toHaveText('Volgende toets: s, linkerringvinger');
    await expect(keyboard.locator('[data-key="s"]')).toHaveClass(/\bnext\b/);
    await expect(keyboard.locator('[data-key="a"]')).not.toHaveClass(/\bnext\b/);
    await expect(keyboard.locator('.legend .finger.now')).toContainText('ringvinger');
    await page.keyboard.type('sdf');
    await expect(keyboard.locator('.next-key')).toHaveText('Volgende toets: spatie, duim');
    await expect(keyboard.locator('[data-key="space"]')).toHaveClass(/\bnext\b/);
    // The mouse over another key changes nothing.
    await keyboard.locator('[data-key="q"]').hover();
    await expect(keyboard.locator('[data-key="space"]')).toHaveClass(/\bnext\b/);
    await expect(keyboard.locator('[data-key="q"]')).not.toHaveClass(/\bnext\b/);
    await expect(keyboard.locator('.next-key')).toHaveText('Volgende toets: spatie, duim');
  });

  test('Shift, Ctrl+A, Backspace and Enter are not counted', async ({ page }) => {
    await openTypingLesson(page, { hash: anchor });
    await startDrill(page);
    const length = typing.lines[0].length;
    const untouched = '.'.repeat(length);
    for (const key of [
      'Shift',
      'Control',
      'Alt',
      'CapsLock',
      'Control+a',
      'Control+c',
      'Backspace',
      'Delete',
      'Enter',
      'ArrowLeft',
      'ArrowRight',
      'Home',
      'End',
    ]) {
      await page.keyboard.press(key);
    }
    await expect.poll(() => marks(page)).toBe(untouched);
    await expect.poll(() => currentIndex(page)).toBe(0);
    // A capital A is a real key press (Shift and the letter): it counts, as a wrong "a".
    await page.keyboard.press('Shift+A');
    await expect.poll(() => marks(page)).toBe('w' + untouched.slice(1));
    await expect.poll(() => currentIndex(page)).toBe(1);
  });

  test('a char that arrives without its own keydown counts, as after a dead key', async ({
    page,
  }) => {
    await openTypingLesson(page, { hash: anchor });
    await startDrill(page);
    const length = typing.lines[0].length;
    // The first char is "a": a char inserted without a key press (a dead key and a space give
    // the char itself) is one key press, and a right one.
    await page.keyboard.insertText('a');
    await expect.poll(() => marks(page)).toBe('c' + '.'.repeat(length - 1));
    // A composition (a dead key waiting for its letter) counts nothing until it ends...
    const client = await page.context().newCDPSession(page);
    await client.send('Input.imeSetComposition', {
      text: '´',
      selectionStart: 1,
      selectionEnd: 1,
    });
    await expect.poll(() => marks(page)).toBe('c' + '.'.repeat(length - 1));
    await expect.poll(() => currentIndex(page)).toBe(1);
    // ... and then counts the one char it ended in, in this case the wrong é for the "s".
    await client.send('Input.insertText', { text: 'é' });
    await expect.poll(() => marks(page)).toBe('cw' + '.'.repeat(length - 2));
    await expect.poll(() => currentIndex(page)).toBe(2);
    // The field is empty again: a normal key still goes to the next char.
    await expect(drillBlock(page).getByLabel('Typvak')).toHaveValue('');
    await page.keyboard.type('d');
    await expect.poll(() => marks(page)).toBe('cwc' + '.'.repeat(length - 3));
    // Two chars in one insert (as "'t" after a dead key) count as two.
    await page.keyboard.insertText('fx');
    await expect.poll(() => marks(page)).toBe('cwccw' + '.'.repeat(length - 5));
  });

  test('pasting is not counted', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openTypingLesson(page, { hash: anchor });
    await startDrill(page);
    const length = typing.lines[0].length;
    await page.evaluate((text) => navigator.clipboard.writeText(text), typing.lines[0]);
    await page.keyboard.press('ControlOrMeta+v');
    // A drop of text is refused too.
    await drillBlock(page)
      .getByLabel('Typvak')
      .evaluate((field) => {
        const data = new DataTransfer();
        data.setData('text/plain', 'asdf');
        field.dispatchEvent(new DragEvent('drop', { dataTransfer: data, cancelable: true }));
      });
    await expect.poll(() => marks(page)).toBe('.'.repeat(length));
    await expect.poll(() => currentIndex(page)).toBe(0);
    await expect(drillBlock(page).getByLabel('Typvak')).toHaveValue('');
    // Typing still works afterwards.
    await page.keyboard.type('a');
    await expect.poll(() => marks(page)).toBe('c' + '.'.repeat(length - 1));
  });

  test('Tab leaves the typing field and Shift+Tab comes back', async ({ page }) => {
    await openTypingLesson(page, { hash: anchor });
    await startDrill(page);
    const field = drillBlock(page).getByLabel('Typvak');
    await page.evaluate(() => {
      const seen: { key: string; prevented: boolean }[] = [];
      (window as unknown as { seenKeys: typeof seen }).seenKeys = seen;
      document.addEventListener('keydown', (event) =>
        seen.push({ key: event.key, prevented: event.defaultPrevented }),
      );
    });
    await page.keyboard.press('Tab');
    await expect(field).not.toBeFocused();
    await expect(drillBlock(page).getByRole('button', { name: 'Opnieuw beginnen' })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(field).toBeFocused();
    await page.keyboard.press('Escape');
    // Escape did nothing to the drill and did not trap the focus: Tab still leaves.
    await page.keyboard.press('Tab');
    await expect(field).not.toBeFocused();
    const seen = await page.evaluate(
      () => (window as unknown as { seenKeys: { key: string; prevented: boolean }[] }).seenKeys,
    );
    expect(seen.filter((item) => ['Tab', 'Escape'].includes(item.key))).toEqual([
      { key: 'Tab', prevented: false },
      { key: 'Tab', prevented: false },
      { key: 'Escape', prevented: false },
      { key: 'Tab', prevented: false },
    ]);
    // Typing is not counted while the focus is elsewhere, and the child is told how to go on.
    await expect(drillBlock(page).locator('.refocus')).toHaveText(
      'Klik op de regel om verder te typen.',
    );
    // A click on the line puts the focus back.
    await drillBlock(page).locator('.line').click();
    await expect(field).toBeFocused();
    await expect(drillBlock(page).locator('.refocus')).toHaveCount(0);
  });

  test('Caps Lock on shows a message', async ({ page }) => {
    await openTypingLesson(page, { hash: anchor });
    await startDrill(page);
    const caps = drillBlock(page).locator('.caps');
    await expect(caps).toHaveAttribute('role', 'status');
    await expect(caps).toHaveText('');
    // Playwright cannot switch the Caps Lock state of the browser on, so the key press comes as
    // a keydown event that says it is on (what the OS gives), and then as a normal key press.
    const field = drillBlock(page).getByLabel('Typvak');
    const press = (key: string, capsLock: boolean) =>
      field.evaluate(
        (element, args) =>
          element.dispatchEvent(
            new KeyboardEvent('keydown', {
              key: args.key,
              bubbles: true,
              modifierCapsLock: args.capsLock,
            }),
          ),
        { key, capsLock },
      );
    await press('A', true);
    await expect(caps).toHaveText('Caps Lock staat aan');
    // The chars still count as typed.
    await page.keyboard.type('a');
    await expect(drillChars(page).nth(0)).toHaveClass(/correct/);
    await press('s', false);
    await expect(caps).toHaveText('');
  });

  test('the live region speaks at the start of a line, not at every key', async ({ page }) => {
    await openTypingLesson(page, { hash: anchor });
    await startDrill(page);
    const live = drillBlock(page).locator('[aria-live="polite"]');
    await expect(live).toHaveText(`Regel 1 van ${typing.lines.length}: ${typing.lines[0]}`);
    await page.keyboard.type('ax');
    await expect(live).toHaveText(`Regel 1 van ${typing.lines.length}: ${typing.lines[0]}`);
    await page.keyboard.type(typing.lines[0].slice(2));
    await expect(live).toHaveText(`Regel 2 van ${typing.lines.length}: ${typing.lines[1]}`);
  });

  test('Opnieuw beginnen starts over and stores nothing', async ({ page }) => {
    await openTypingLesson(page, { hash: anchor });
    await startDrill(page);
    await typeLine(page, typing.lines[0] + typing.lines[1].slice(0, 3));
    await drillBlock(page).getByRole('button', { name: 'Opnieuw beginnen' }).click();
    await expect(drillBlock(page).getByText('Weet je het zeker?')).toBeVisible();
    await drillBlock(page).getByRole('button', { name: 'Ja, opnieuw beginnen' }).click();
    await expect(drillBlock(page).locator('.counter')).toHaveText(
      `Regel 1 van ${typing.lines.length}`,
    );
    await expect.poll(() => marks(page)).toBe('.'.repeat(typing.lines[0].length));
    await expect(drillBlock(page).getByLabel('Typvak')).toBeFocused();
    await settle(page);
    expect((await storedRecords(page)).interaction_results).toEqual([]);
  });

  test('Tab and a space from the field do not wipe what was typed', async ({ page }) => {
    await openTypingLesson(page, { hash: anchor });
    await startDrill(page);
    await typeLine(page, typing.lines[0].slice(0, 3));
    const before = 'ccc' + '.'.repeat(typing.lines[0].length - 3);
    await expect.poll(() => marks(page)).toBe(before);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Space');
    // Opnieuw beginnen asks first, and the safe answer has the focus: another space goes on.
    await expect(drillBlock(page).getByText('Weet je het zeker?')).toBeVisible();
    const keepTyping = drillBlock(page).getByRole('button', { name: 'Nee, verder typen' });
    await expect(keepTyping).toBeFocused();
    await expect.poll(() => marks(page)).toBe(before);
    await page.keyboard.press('Space');
    await expect(drillBlock(page).getByLabel('Typvak')).toBeFocused();
    await expect.poll(() => marks(page)).toBe(before);
    await page.keyboard.type(typing.lines[0][3] ?? '');
    await expect.poll(() => marks(page)).toBe('cccc' + '.'.repeat(typing.lines[0].length - 4));
  });
});

test.describe('the typing drill: results', () => {
  test.use(laptop);

  test('finishing stores one result without the typed text', async ({ page }) => {
    await openTypingLesson(page, { hash: anchor });
    await startDrill(page);
    // Two wrong keys, counted across all lines: index 3 is the "f" of line 1 ("asdf jkl;"), index
    // 12 the "a" of line 2 ("fdsa ;lkj", 12 - 9 = 3).
    const wrongAt = new Set([3, 12]);
    let index = 0;
    for (const line of typing.lines) {
      const typed = [...line].map((char) => {
        const wrong = wrongAt.has(index);
        index += 1;
        return wrong ? 'x' : char;
      });
      await typeLine(page, typed.join(''));
    }
    await expect(drillBlock(page).getByRole('heading', { name: 'Klaar!' })).toBeVisible();
    await expect.poll(async () => (await storedRecords(page)).interaction_results.length).toBe(1);
    const [result] = (await storedRecords(page)).interaction_results;
    expect(result).toMatchObject({
      lesson_id: typingLesson.id,
      interaction_id: typingStep.interaction.id,
      kind: 'typing-drill',
      score: typingTotal - 2,
      total: typingTotal,
      content_version: typingLesson.version,
    });
    const detail = result['detail'] as {
      keysPerMinute: number;
      durationMs: number;
      mistakes: { key: string; count: number }[];
    };
    expect(Object.keys(detail).sort()).toEqual(['durationMs', 'keysPerMinute', 'mistakes']);
    expect(Number.isInteger(detail.keysPerMinute)).toBe(true);
    expect(detail.durationMs).toBeGreaterThanOrEqual(1000);
    // A mistake counts on the key that should have been pressed: "a" and "f", once each (equal
    // counts in key order).
    expect(detail.mistakes).toEqual([
      { key: 'a', count: 1 },
      { key: 'f', count: 1 },
    ]);
    // Not a single line, nor the wrong char that was typed, is in the record.
    const stored = JSON.stringify(result);
    for (const line of typing.lines) expect(stored).not.toContain(line);
    expect(stored).not.toContain('"x"');
    // The step is done.
    await expect(navLink(page, 2, 'Typen', true)).toBeVisible();
  });

  test('the circle and the previous result are still there after a reload', async ({ page }) => {
    await openTypingLesson(page, { hash: anchor });
    await expect(previous(page)).toHaveCount(0);
    await startDrill(page);
    await typeLine(page, 'x' + typing.lines[0].slice(1));
    for (const line of typing.lines.slice(1)) await typeLine(page, line);
    await expect(drillBlock(page).getByRole('heading', { name: 'Klaar!' })).toBeVisible();
    await expect(navLink(page, 2, 'Typen', true)).toBeVisible();
    await settle(page);
    await page.reload();
    await expect(navLink(page, 2, 'Typen', true)).toBeVisible();
    await expect(previous(page)).toHaveText(
      `Vorige keer: ${Math.floor(((typingTotal - 1) / typingTotal) * 100)}% goed.`,
    );
    // A new drill starts at Start.
    await expect(
      drillBlock(page).getByRole('button', { name: 'Start', exact: true }),
    ).toBeVisible();
  });

  test('Nog een keer starts a new drill and stores a second result', async ({ page }) => {
    await openTypingLesson(page, { hash: anchor });
    await startDrill(page);
    await typeAll(page);
    await drillBlock(page).getByRole('button', { name: 'Nog een keer', exact: true }).click();
    await expect(drillBlock(page).locator('.counter')).toHaveText(
      `Regel 1 van ${typing.lines.length}`,
    );
    await expect.poll(() => marks(page)).toBe('.'.repeat(typing.lines[0].length));
    await expect(drillBlock(page).getByLabel('Typvak')).toBeFocused();
    await typeAll(page);
    await expect.poll(async () => (await storedRecords(page)).interaction_results.length).toBe(2);
  });

  test('a result that cannot be saved shows a message', async ({ page }) => {
    await openTypingLesson(page, { hash: anchor });
    await page.route(resultsPattern, (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({ status: 503, contentType: 'application/json', body: '{}' })
        : route.continue(),
    );
    await startDrill(page);
    await typeAll(page);
    await expect(section(page, typingStep.id).getByRole('alert')).toHaveText(
      'Je score is niet bewaard.',
    );
    // The result stays on the page and the step is not done.
    await expect(drillBlock(page).locator('.results li').nth(0)).toContainText('100% goed');
    await expect(navLink(page, 2, 'Typen', false)).toBeVisible();
    await page.unroute(resultsPattern);
    expect((await storedRecords(page)).interaction_results).toEqual([]);
  });

  test('a second child does not see the result of the first', async ({ page, browser }) => {
    await openTypingLesson(page, { hash: anchor });
    await startDrill(page);
    await typeAll(page);
    await expect.poll(async () => (await storedRecords(page)).interaction_results.length).toBe(1);
    const other = await browser.newPage({
      baseURL: test.info().project.use.baseURL,
      ...laptop,
    });
    try {
      await openTypingLesson(other, { hash: anchor });
      await expect(
        drillBlock(other).getByRole('button', { name: 'Start', exact: true }),
      ).toBeVisible();
      await expect(previous(other)).toHaveCount(0);
      await expect(navLink(other, 2, 'Typen', false)).toBeVisible();
      expect((await storedRecords(other)).interaction_results).toEqual([]);
    } finally {
      await other.close();
    }
  });

  test('the typing drill is loaded as a separate file when the lesson opens', async ({ page }) => {
    const scripts: { url: string; body: Promise<string> }[] = [];
    page.on('response', (response) => {
      if (response.url().endsWith('.js')) {
        scripts.push({ url: response.url(), body: response.text().catch(() => '') });
      }
    });
    await openTypingLesson(page, { hash: anchor });
    await expect(
      drillBlock(page).getByRole('button', { name: 'Start', exact: true }),
    ).toBeVisible();
    const bodies = await Promise.all(
      scripts.map(async (script) => ({ url: script.url, body: await script.body })),
    );
    const withDrill = bodies.filter((script) => script.body.includes('snf-typing-drill'));
    expect(withDrill.map((script) => script.url)).toHaveLength(1);
    expect(withDrill[0].body).not.toContain('snf-lesson-step');
    expect(withDrill[0].url).not.toMatch(/\/main[-.]/);
  });
});

test.describe('the typing drill on a phone', () => {
  test.use(phone);

  test('a touch device without a keyboard sees the message and no typing field', async ({
    page,
  }) => {
    await openTypingLesson(page, { hash: anchor });
    const block = drillBlock(page);
    await expect(block.locator('.message')).toHaveText(
      'Voor deze oefening heb je een toetsenbord nodig. Doe hem op een laptop of computer.',
    );
    await expect(block.locator('input')).toHaveCount(0);
    await expect(block.getByRole('button', { name: 'Start' })).toHaveCount(0);
    await expect(block.locator('snf-ted-says snf-ted svg')).toBeVisible();
  });

  test('a real key press on a touch device starts the drill anyway', async ({ page }) => {
    await openTypingLesson(page, { hash: anchor });
    const block = drillBlock(page);
    await expect(block.locator('.message')).toBeVisible();
    // A modifier, Tab and Escape alone are no real typing.
    await page.keyboard.press('Shift');
    await page.keyboard.press('Escape');
    await expect(block.locator('.message')).toBeVisible();
    await page.keyboard.press('g');
    await expect(block.locator('.message')).toHaveCount(0);
    const start = block.getByRole('button', { name: 'Start', exact: true });
    await expect(start).toBeVisible();
    // That key was not counted: the drill has not started.
    await start.click();
    await expect(block.getByLabel('Typvak')).toBeFocused();
    await expect.poll(() => marks(page)).toBe('.'.repeat(typing.lines[0].length));
    await settle(page);
    expect((await storedRecords(page)).interaction_results).toEqual([]);
  });

  test('no horizontal overflow on a phone', async ({ page }) => {
    const overflow = () =>
      page.evaluate(() => ({
        page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        width: window.innerWidth,
      }));
    await openTypingLesson(page, { hash: anchor });
    expect((await overflow()).page, 'touch message').toBeLessThanOrEqual(0);
    await page.keyboard.press('g');
    await expect(drillBlock(page).getByRole('button', { name: 'Start' })).toBeVisible();
    expect((await overflow()).page, 'start').toBeLessThanOrEqual(0);
    await startDrill(page);
    await page.keyboard.type('ax');
    expect((await overflow()).page, 'typing').toBeLessThanOrEqual(0);
    const keyboard = await drillBlock(page).locator('.keyboard').boundingBox();
    expect(keyboard!.x + keyboard!.width).toBeLessThanOrEqual((await overflow()).width);
    await typeLine(page, typing.lines[0].slice(2));
    for (const line of typing.lines.slice(1)) await typeLine(page, line);
    await expect(drillBlock(page).getByRole('heading', { name: 'Klaar!' })).toBeVisible();
    expect((await overflow()).page, 'finished').toBeLessThanOrEqual(0);
  });
});

test.describe('the typing drill: accessibility and motion', () => {
  test.use(laptop);

  async function expectNoViolations(page: Page, label: string): Promise<void> {
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, label).toEqual([]);
  }

  /** Every button and link in the drill that is smaller than 44 × 44 px. */
  async function smallTargets(page: Page) {
    return drillBlock(page)
      .locator('button, a')
      .evaluateAll((elements) =>
        elements
          .filter((element) => element.getClientRects().length > 0)
          .map((element) => {
            const box = element.getBoundingClientRect();
            return {
              name: (element.textContent ?? '').replace(/\s+/g, ' ').trim(),
              width: box.width,
              height: box.height,
            };
          })
          .filter((size) => size.width < 44 || size.height < 44),
      );
  }

  for (const scheme of ['light', 'dark'] as const) {
    test(`the typing drill has no axe violations in light and dark (${scheme})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await openTypingLesson(page, { hash: anchor });
      await settle(page);
      await expectNoViolations(page, `start, ${scheme}`);
      await startDrill(page);
      await page.keyboard.type('ax');
      await expect(drillChars(page).nth(1)).toHaveClass(/wrong/);
      await expectNoViolations(page, `typing with a wrong char, ${scheme}`);
      await page.keyboard.type(typing.lines[0].slice(2));
      for (const line of typing.lines.slice(1)) await typeLine(page, line);
      await expect(drillBlock(page).getByRole('heading', { name: 'Klaar!' })).toBeVisible();
      await settle(page);
      await expectNoViolations(page, `finished, ${scheme}`);
    });

    test(`the touch message has no axe violations (${scheme})`, async ({ browser, baseURL }) => {
      const context = await browser.newContext({ ...phone, baseURL, colorScheme: scheme });
      const page = await context.newPage();
      try {
        await openTypingLesson(page, { hash: anchor });
        await expect(drillBlock(page).locator('.message')).toBeVisible();
        await settle(page);
        await expectNoViolations(page, `touch message, ${scheme}`);
      } finally {
        await context.close();
      }
    });
  }

  test('Start, Opnieuw beginnen and Nog een keer are at least 44 × 44 px', async ({ page }) => {
    await openTypingLesson(page, { hash: anchor });
    await expect(drillBlock(page).getByRole('button', { name: 'Start' })).toBeVisible();
    expect(await smallTargets(page), 'start').toEqual([]);
    await startDrill(page);
    await expect(drillBlock(page).getByRole('button', { name: 'Opnieuw beginnen' })).toBeVisible();
    expect(await smallTargets(page), 'typing').toEqual([]);
    await typeAll(page);
    await expect(drillBlock(page).getByRole('button', { name: 'Nog een keer' })).toBeVisible();
    expect(await smallTargets(page), 'finished').toEqual([]);
  });

  test('the focus is visible: on the line while typing and on the buttons', async ({ page }) => {
    await openTypingLesson(page, { hash: anchor });
    const box = drillBlock(page).locator('.line-box');
    await drillBlock(page).getByRole('button', { name: 'Start', exact: true }).focus();
    // Reached with the keyboard: the focus ring shows.
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(drillBlock(page).getByRole('button', { name: 'Start' })).toHaveCSS(
      'outline-style',
      'solid',
    );
    await page.keyboard.press('Enter');
    await expect(drillBlock(page).getByLabel('Typvak')).toBeFocused();
    await expect(box).toHaveCSS('outline-style', 'solid');
    await expect(box).toHaveCSS('outline-width', '3px');
    await page.keyboard.press('Tab');
    const restart = drillBlock(page).getByRole('button', { name: 'Opnieuw beginnen' });
    await expect(restart).toBeFocused();
    await expect(restart).toHaveCSS('outline-style', 'solid');
    await expect(restart).toHaveCSS('outline-width', '3px');
    // Without the focus in the field the line has no ring.
    await expect(box).toHaveCSS('outline-style', 'none');
  });

  test('no animation longer than 1 ms with prefers-reduced-motion: reduce', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openTypingLesson(page, { hash: anchor });
    const longAnimations = () =>
      page.evaluate(() =>
        document
          .getAnimations()
          .filter((animation) => {
            const timing = animation.effect?.getComputedTiming();
            return Number(timing?.duration ?? 0) * Number(timing?.iterations ?? 1) > 1;
          })
          .map((animation) => animation.id || animation.constructor.name),
      );
    await expect(drillBlock(page).getByRole('button', { name: 'Start' })).toBeVisible();
    expect(await longAnimations(), 'start').toEqual([]);
    await startDrill(page);
    await page.keyboard.type('ax');
    expect(await longAnimations(), 'typing').toEqual([]);
    // The next key does not hop: no transform, the border stays.
    const next = drillBlock(page).locator('.key.next');
    await expect(next).toHaveCSS('transform', 'none');
    await expect(next).not.toHaveCSS('border-top-width', '0px');
    await page.keyboard.type(typing.lines[0].slice(2));
    for (const line of typing.lines.slice(1)) await typeLine(page, line);
    await expect(drillBlock(page).getByRole('heading', { name: 'Klaar!' })).toBeVisible();
    expect(await longAnimations(), 'finished').toEqual([]);
  });
});
