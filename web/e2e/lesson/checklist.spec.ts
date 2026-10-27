import { plainText } from '../../src/app/shared/inline-text/inline-markup';
import { expect, test } from '../fixtures';
import { checkbox, navLink, practice, section, settle, storedRecords } from './actions';
import { openLesson } from './fixture';

const [first, second] = practice.items;
const withLink = practice.items.find((item) => item.links?.length)!;

test.describe('the checklist', () => {
  test.beforeEach(async ({ page }) => {
    await openLesson(page, { hash: `#stap-${practice.id}` });
  });

  test('ticking an item saves it', async ({ page }) => {
    await checkbox(page, second.id).check();
    await expect(checkbox(page, second.id)).toBeChecked();
    await expect
      .poll(async () => (await storedRecords(page)).checklist_states)
      .toEqual([
        expect.objectContaining({
          lesson_id: 'proefles',
          checklist_id: practice.id,
          checked: [second.id],
        }),
      ]);
    // In item order, whatever the order of ticking.
    await checkbox(page, first.id).check();
    await expect
      .poll(async () =>
        (await storedRecords(page)).checklist_states.map((state) => state['checked']),
      )
      .toEqual([[first.id, second.id]]);

    await page.reload();
    await expect(checkbox(page, first.id)).toBeChecked();
    await expect(checkbox(page, second.id)).toBeChecked();
    await expect(checkbox(page, practice.items[2].id)).not.toBeChecked();
  });

  test('the whole row toggles the item', async ({ page }) => {
    const row = section(page, practice.id)
      .locator('label')
      .filter({ hasText: plainText(second.text) });
    const box = await row.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    // Tap on the text, far from the checkbox.
    await row.click({ position: { x: box!.width - 10, y: box!.height / 2 } });
    await expect(checkbox(page, second.id)).toBeChecked();
    await row.locator('.text').click();
    await expect(checkbox(page, second.id)).not.toBeChecked();
    await settle(page);
    expect((await storedRecords(page)).checklist_states.map((state) => state['checked'])).toEqual([
      [],
    ]);
  });

  test('a link in an item opens in a new tab and does not tick it', async ({ page, context }) => {
    const link = withLink.links![0];
    // Never really go out: the new tab gets an empty page from the test.
    await context.route(`${new URL(link.url).origin}/**`, (route) =>
      route.fulfill({ status: 200, contentType: 'text/plain', body: 'ok' }),
    );
    const anchor = section(page, practice.id).getByRole('link', { name: link.label });
    await expect(anchor).toHaveAttribute('target', '_blank');
    await expect(anchor).toHaveAttribute('rel', 'noopener noreferrer');
    expect(await anchor.evaluate((element) => element.closest('label'))).toBeNull();
    const popupPromise = page.waitForEvent('popup');
    await anchor.click();
    const popup = await popupPromise;
    await popup.close();
    await expect(checkbox(page, withLink.id)).not.toBeChecked();
    await settle(page);
    expect((await storedRecords(page)).checklist_states).toEqual([]);
  });

  test('ticking every item fills the practice circle', async ({ page }) => {
    for (const item of practice.items.slice(0, -1)) await checkbox(page, item.id).check();
    await settle(page);
    await expect(navLink(page, 4, 'Zelf doen', 'started')).toBeVisible();
    await checkbox(page, practice.items.at(-1)!.id).check();
    await expect(navLink(page, 4, 'Zelf doen', true)).toBeVisible();
    await expect
      .poll(async () =>
        (await storedRecords(page)).lesson_progress.map((record) => [
          record['step_id'],
          record['status'],
        ]),
      )
      .toEqual([[practice.id, 'completed']]);

    // Unticking afterwards keeps the circle filled ("once finished").
    await checkbox(page, first.id).uncheck();
    await settle(page);
    await expect(navLink(page, 4, 'Zelf doen', true)).toBeVisible();
    await page.reload();
    await expect(navLink(page, 4, 'Zelf doen', true)).toBeVisible();
    await expect(checkbox(page, first.id)).not.toBeChecked();
  });
});
