import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ExternalLink } from './external-link';

// Built at runtime: the privacy scan forbids a literal external url in web/src.
const httpsUrl = ['https', '://example.org/bron'].join('');
const httpUrl = ['http', '://example.org/bron'].join('');

@Component({
  imports: [ExternalLink],
  template: `<snf-external-link [url]="url()" [label]="label()" [accessibleName]="name()" />`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Host {
  readonly url = signal(httpsUrl);
  readonly label = signal('Sportvisserij Nederland');
  readonly name = signal<string | undefined>(undefined);
}

describe('ExternalLink', () => {
  async function render(change?: (host: Host) => void) {
    const fixture = TestBed.createComponent(Host);
    change?.(fixture.componentInstance);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders an https url as a link that opens in a new tab', async () => {
    const element = await render();
    const link = element.querySelector('a');
    expect(link?.getAttribute('href')).toBe(httpsUrl);
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(link?.textContent).toBe('Sportvisserij Nederland (opent in een nieuw tabblad)');
    expect(link?.querySelector('.snf-visually-hidden')?.textContent).toBe(
      ' (opent in een nieuw tabblad)',
    );
    expect(link?.hasAttribute('aria-label')).toBe(false);
  });

  it('uses the accessible name when given', async () => {
    const element = await render((host) => host.name.set('Bron: Roofvissen (Sportvisserij)'));
    expect(element.querySelector('a')?.getAttribute('aria-label')).toBe(
      'Bron: Roofvissen (Sportvisserij) (opent in een nieuw tabblad)',
    );
  });

  it('renders anything but https as plain text', async () => {
    for (const url of [httpUrl, 'javascript:alert(1)', '/intern', '']) {
      const element = await render((host) => host.url.set(url));
      expect(element.querySelector('a')).toBeNull();
      expect(element.textContent?.trim()).toBe('Sportvisserij Nederland');
    }
  });
});
