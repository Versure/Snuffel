import { TestBed } from '@angular/core/testing';
import { TopBar } from './top-bar';

describe('TopBar', () => {
  async function render(name = 'Kind A') {
    const fixture = TestBed.createComponent(TopBar);
    fixture.componentRef.setInput('name', name);
    await fixture.whenStable();
    return { fixture, element: fixture.nativeElement as HTMLElement };
  }

  it('shows the name in a header', async () => {
    const { element } = await render('Kind A');
    expect(element.querySelector('header')?.textContent).toContain('Kind A');
  });

  it('has an Uitloggen button that emits logout', async () => {
    const { fixture, element } = await render();
    const logout = vi.fn();
    fixture.componentInstance.logout.subscribe(logout);
    const button = element.querySelector('button');
    expect(button?.textContent?.trim()).toBe('Uitloggen');
    expect(button?.type).toBe('button');
    button?.click();
    expect(logout).toHaveBeenCalledTimes(1);
  });
});
