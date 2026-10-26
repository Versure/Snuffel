import { TypedInput } from './typed-input';

describe('TypedInput', () => {
  let field: HTMLInputElement;
  let chars: string[];
  let capsLock: boolean[];
  let reader: TypedInput;

  beforeEach(() => {
    field = document.createElement('input');
    document.body.append(field);
    chars = [];
    capsLock = [];
    reader = new TypedInput(field, {
      char: (char) => chars.push(char),
      capsLock: (on) => capsLock.push(on),
    });
  });

  afterEach(() => {
    reader.destroy();
    field.remove();
  });

  /** What the browser does for a normal key: the char lands in the field, then `input`. */
  function type(text: string, inputType = 'insertText'): void {
    field.value += text;
    field.dispatchEvent(new InputEvent('input', { inputType, data: text, bubbles: true }));
  }

  function keydown(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    field.dispatchEvent(event);
    return event;
  }

  function beforeinput(inputType: string, data: string | null = null): InputEvent {
    const event = new InputEvent('beforeinput', { inputType, data, cancelable: true });
    field.dispatchEvent(event);
    return event;
  }

  /** A dead key: the composition starts and the dead char stands in the field while composing. */
  function deadKey(char: string): void {
    keydown('Dead');
    field.dispatchEvent(new CompositionEvent('compositionstart', { data: '' }));
    field.value += char;
    field.dispatchEvent(
      new InputEvent('input', {
        inputType: 'insertCompositionText',
        data: char,
        isComposing: true,
      }),
    );
  }

  /** The key after a dead key: the composition ends with `result` in the field. */
  function endComposition(result: string): void {
    field.value = field.value.slice(0, -1) + result;
    field.dispatchEvent(
      new InputEvent('input', {
        inputType: 'insertCompositionText',
        data: result,
        isComposing: true,
      }),
    );
    field.dispatchEvent(new CompositionEvent('compositionend', { data: result }));
  }

  it('a typed char is passed on and the input is emptied', () => {
    keydown('a');
    type('a');
    expect(chars).toEqual(['a']);
    expect(field.value).toBe('');
    keydown('A', { shiftKey: true });
    type('A');
    type(' ');
    expect(chars).toEqual(['a', 'A', ' ']);
    expect(field.value).toBe('');
  });

  it('a dead key gives nothing until the composition ends', () => {
    deadKey("'");
    expect(chars).toEqual([]);
    // Another input while composing is not read either.
    field.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: "'" }));
    expect(chars).toEqual([]);
    endComposition("'");
    expect(chars).toEqual(["'"]);
  });

  it('a dead key and a space give the char itself', () => {
    deadKey("'");
    keydown(' ');
    endComposition("'");
    // The input event after compositionend (Firefox) finds the field empty: no double char.
    field.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: "'" }));
    expect(chars).toEqual(["'"]);
    expect(field.value).toBe('');
  });

  it('a dead key and t give two chars in order', () => {
    deadKey("'");
    keydown('t');
    endComposition("'t");
    expect(chars).toEqual(["'", 't']);
    expect(field.value).toBe('');
  });

  it('a composed é is one char', () => {
    deadKey("'");
    keydown('e');
    endComposition('é');
    expect(chars).toEqual(['é']);
  });

  it('paste and drop are refused and not counted', () => {
    expect(beforeinput('insertFromPaste', 'asdf').defaultPrevented).toBe(true);
    expect(beforeinput('insertFromDrop', 'asdf').defaultPrevented).toBe(true);
    const paste = new Event('paste', { cancelable: true });
    field.dispatchEvent(paste);
    expect(paste.defaultPrevented).toBe(true);
    const drop = new Event('drop', { cancelable: true });
    field.dispatchEvent(drop);
    expect(drop.defaultPrevented).toBe(true);
    expect(chars).toEqual([]);
    // A normal char is not refused.
    expect(beforeinput('insertText', 'a').defaultPrevented).toBe(false);
    expect(beforeinput('insertCompositionText', "'").defaultPrevented).toBe(false);
  });

  it('Backspace, Delete, Enter and arrows are not counted', () => {
    for (const key of ['Backspace', 'Delete', 'Enter', 'ArrowLeft', 'ArrowRight', 'Home', 'End']) {
      keydown(key);
    }
    for (const inputType of [
      'deleteContentBackward',
      'deleteContentForward',
      'deleteWordBackward',
      'insertLineBreak',
      'insertParagraph',
      'historyUndo',
    ]) {
      expect(beforeinput(inputType).defaultPrevented, inputType).toBe(true);
    }
    expect(chars).toEqual([]);
  });

  it('Shift, Control, Alt, Meta and CapsLock alone are not counted', () => {
    for (const key of [
      'Shift',
      'Control',
      'Alt',
      'Meta',
      'CapsLock',
      'AltGraph',
      'Dead',
      'Process',
    ]) {
      expect(keydown(key).defaultPrevented, key).toBe(false);
    }
    expect(chars).toEqual([]);
  });

  it('Ctrl or Cmd with a key is not counted', () => {
    keydown('a', { ctrlKey: true });
    keydown('v', { metaKey: true });
    expect(beforeinput('insertFromPaste', 'asdf').defaultPrevented).toBe(true);
    expect(chars).toEqual([]);
  });

  it('Tab and Escape are not prevented', () => {
    expect(keydown('Tab').defaultPrevented).toBe(false);
    expect(keydown('Tab', { shiftKey: true }).defaultPrevented).toBe(false);
    expect(keydown('Escape').defaultPrevented).toBe(false);
  });

  it('Caps Lock on is reported', () => {
    keydown('A', { modifierCapsLock: true });
    keydown('a');
    expect(capsLock).toEqual([true, false]);
  });

  it('destroy stops listening and empties the field', () => {
    field.value = 'as';
    reader.destroy();
    expect(field.value).toBe('');
    type('d');
    expect(chars).toEqual([]);
  });
});
