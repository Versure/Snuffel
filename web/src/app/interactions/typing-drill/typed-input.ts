// Reads typed chars from a real <input>, so a char after a dead key of US-International arrives
// too (plan M15 question 4): `keydown` only says `Dead` and then the next letter, and loses the
// `'` of `'t`; the input field gets both. The field is emptied after every read, so no typed text
// stays anywhere.

/** What a TypedInput reports. */
export interface TypedInputHandlers {
  /** One typed char (one key press), in order. */
  readonly char: (char: string) => void;
  /** Whether Caps Lock is on, at every key press. */
  readonly capsLock?: (on: boolean) => void;
}

/**
 * Input types that are no key press of one char: pasting, dropping, deleting, a new line, undo.
 * They are refused, so they never count.
 */
function refused(inputType: string): boolean {
  return (
    inputType.startsWith('insertFrom') ||
    inputType.startsWith('delete') ||
    inputType.startsWith('history') ||
    inputType === 'insertLineBreak' ||
    inputType === 'insertParagraph' ||
    inputType === 'insertReplacementText' ||
    inputType === 'insertLink'
  );
}

/**
 * Listens to an input field and passes on every typed char:
 * - after an `input` that is not composing and after `compositionend` the value of the field is
 *   read, every char is passed on in order, and the field is emptied (reading twice is harmless);
 * - while a composition runs (after a dead key) nothing is read;
 * - paste, drop, Backspace, Delete, Enter and undo are refused (`beforeinput`, `paste`, `drop`);
 * - a `keydown` never counts by itself (a dead key, a modifier, a shortcut or an arrow gives no
 *   char in the field) and is never prevented, so Tab and Escape keep working.
 */
export class TypedInput {
  private composing = false;
  private readonly listeners: readonly [string, (event: Event) => void][];

  constructor(
    private readonly field: HTMLInputElement,
    private readonly handlers: TypedInputHandlers,
  ) {
    this.listeners = [
      ['beforeinput', (event) => this.onBeforeInput(event as InputEvent)],
      ['paste', (event) => event.preventDefault()],
      ['drop', (event) => event.preventDefault()],
      ['compositionstart', () => (this.composing = true)],
      ['compositionend', () => this.onCompositionEnd()],
      ['input', (event) => this.onInput(event as InputEvent)],
      ['keydown', (event) => this.onKeydown(event as KeyboardEvent)],
    ];
    for (const [type, listener] of this.listeners) field.addEventListener(type, listener);
  }

  /** Stops listening and empties the field. */
  destroy(): void {
    for (const [type, listener] of this.listeners) this.field.removeEventListener(type, listener);
    this.field.value = '';
  }

  private onBeforeInput(event: InputEvent): void {
    if (refused(event.inputType)) event.preventDefault();
  }

  private onCompositionEnd(): void {
    this.composing = false;
    this.read();
  }

  private onInput(event: InputEvent): void {
    if (event.isComposing || this.composing) return;
    this.read();
  }

  private onKeydown(event: KeyboardEvent): void {
    if (typeof event.getModifierState === 'function') {
      this.handlers.capsLock?.(event.getModifierState('CapsLock'));
    }
  }

  private read(): void {
    const value = this.field.value;
    if (value === '') return;
    this.field.value = '';
    for (const char of value) this.handlers.char(char);
  }
}
