import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../core/auth/auth.service';
import type { UserRecord } from '../../core/pocketbase/types';
import { Home } from './home';

describe('Home', () => {
  let user: ReturnType<typeof signal<UserRecord | null>>;

  async function render() {
    user = signal<UserRecord | null>({
      id: 'a1',
      username: 'kind-a',
      name: 'Kind A',
      role: 'child',
    });
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: { user } }] });
    const fixture = TestBed.createComponent(Home);
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  it('renders the Snuffel heading', async () => {
    const { element } = await render();
    expect(element.querySelector('h1')?.textContent).toBe('Snuffel');
  });

  it('greets the user by name with a happy Ted', async () => {
    const { element } = await render();
    expect(element.querySelector('snf-ted-says')?.textContent?.trim()).toBe('Hoi, Kind A!');
    const svg = element.querySelector<SVGSVGElement>('snf-ted svg');
    expect(svg?.style.getPropertyValue('--m-ogen-blij').trim()).toBe('inline');
  });

  it('follows a change of name', async () => {
    const { fixture, element } = await render();
    user.set({ id: 'a1', username: 'kind-a', name: 'Anna', role: 'child' });
    await fixture.whenStable();
    expect(element.querySelector('snf-ted-says')?.textContent?.trim()).toBe('Hoi, Anna!');
  });
});
