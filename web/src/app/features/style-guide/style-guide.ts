import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Band } from '../../shared/ui/band/band';
import { Button } from '../../shared/ui/button/button';
import { Card } from '../../shared/ui/card/card';
import { SpeechBubble } from '../../shared/ui/speech-bubble/speech-bubble';
import { Sticker } from '../../shared/ui/sticker/sticker';
import { StickyNote } from '../../shared/ui/sticky-note/sticky-note';
import { Ted, type TedMood } from '../../shared/ui/ted/ted';
import { TedSays } from '../../shared/ui/ted-says/ted-says';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeOption {
  value: Theme;
  label: string;
}

interface MoodOption {
  mood: TedMood;
  label: string;
}

interface Swatch {
  token: string;
  label: string;
}

/** Shows the house style on /stijl. Not linked anywhere; for Jop to compare with the reference. */
@Component({
  selector: 'snf-style-guide',
  imports: [Band, Button, Card, RouterLink, SpeechBubble, Sticker, StickyNote, Ted, TedSays],
  templateUrl: './style-guide.html',
  styleUrl: './style-guide.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StyleGuide {
  private readonly root = inject(DOCUMENT).documentElement;

  protected readonly themeOptions: readonly ThemeOption[] = [
    { value: 'light', label: 'Licht' },
    { value: 'dark', label: 'Donker' },
    { value: 'system', label: 'Systeem' },
  ];

  protected readonly swatches: readonly Swatch[] = [
    { token: '--snf-color-yellow', label: 'Geel' },
    { token: '--snf-color-purple', label: 'Paars' },
    { token: '--snf-color-pink', label: 'Roze' },
    { token: '--snf-color-ink', label: 'Inkt' },
    { token: '--snf-color-paper', label: 'Papier' },
    { token: '--snf-color-surface', label: 'Vlak' },
    { token: '--snf-color-background', label: 'Achtergrond' },
    { token: '--snf-color-text', label: 'Tekst' },
    { token: '--snf-color-text-muted', label: 'Zachte tekst' },
    { token: '--snf-color-heading', label: 'Kop' },
    { token: '--snf-color-link', label: 'Link' },
    { token: '--snf-color-success', label: 'Goed' },
    { token: '--snf-color-success-soft', label: 'Goed (zacht)' },
    { token: '--snf-color-error', label: 'Fout' },
    { token: '--snf-color-error-soft', label: 'Fout (zacht)' },
    { token: '--snf-color-panel', label: 'Paneel' },
    { token: '--snf-color-panel-text', label: 'Paneeltekst' },
  ];

  protected readonly moodOptions: readonly MoodOption[] = [
    { mood: 'cool', label: 'Stoer' },
    { mood: 'happy', label: 'Blij' },
    { mood: 'thinking', label: 'Nadenkend' },
    { mood: 'oops', label: 'Oeps' },
  ];

  protected readonly theme = signal<Theme>(this.currentTheme());

  constructor() {
    inject(DestroyRef).onDestroy(() => this.root.removeAttribute('data-theme'));
  }

  protected selectTheme(theme: Theme): void {
    this.theme.set(theme);
    if (theme === 'system') {
      this.root.removeAttribute('data-theme');
    } else {
      this.root.setAttribute('data-theme', theme);
    }
  }

  private currentTheme(): Theme {
    const value = this.root.getAttribute('data-theme');
    return value === 'light' || value === 'dark' ? value : 'system';
  }
}
