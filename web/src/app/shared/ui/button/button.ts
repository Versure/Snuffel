import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type ButtonVariant = 'purple' | 'pink' | 'light';

/**
 * Snuffel button. An attribute component, so `type`, `disabled`, forms and links stay native:
 * `<button snf-button variant="pink">` or `<a snf-button href="…">`.
 */
@Component({
  selector: 'button[snf-button], a[snf-button]',
  templateUrl: './button.html',
  styleUrl: './button.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'snf-button',
    '[class.snf-button--purple]': "variant() === 'purple'",
    '[class.snf-button--pink]': "variant() === 'pink'",
    '[class.snf-button--light]': "variant() === 'light'",
  },
})
export class Button {
  readonly variant = input<ButtonVariant>('purple');
}
