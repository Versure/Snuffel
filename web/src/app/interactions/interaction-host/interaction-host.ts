import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  inputBinding,
  outputBinding,
  resource,
  untracked,
  viewChild,
  ViewContainerRef,
  type ComponentRef,
} from '@angular/core';
import type { Interaction, InteractionStep, LessonTed } from '../../core/content/content.types';
import { LessonProgress } from '../../shared/lesson-progress/lesson-progress';
import { Button } from '../../shared/ui/button/button';
import { TedSays } from '../../shared/ui/ted-says/ted-says';
import type { InteractionResult } from '../interaction';
import { InteractionPlaceholder } from '../interaction-placeholder/interaction-placeholder';
import { INTERACTION_REGISTRY } from '../registry';
import { accuracy } from '../typing-drill/drill';

/** What the host says per kind of interaction when its component cannot be loaded. */
const LOAD_ERRORS: Record<Interaction['kind'], string> = {
  'trace-game': 'Dit spel kan ik nu niet laden.',
  'stepped-exercise': 'Deze oefening kan ik nu niet laden.',
  'typing-drill': 'Deze typoefening kan ik nu niet laden.',
};

/**
 * The interaction of a lesson step: loads the component of its kind through the registry (a
 * separate file, only when needed), gives it `config` and `ted`, and stores what it reports
 * through LessonProgress: the first answer makes the step started, a finished game is a result
 * and makes the step completed. Without LessonProgress the game works in memory only. A kind
 * without a component shows the placeholder.
 */
@Component({
  selector: 'snf-interaction',
  imports: [Button, InteractionPlaceholder, TedSays],
  templateUrl: './interaction-host.html',
  styleUrl: './interaction-host.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InteractionHost {
  private readonly registry = inject(INTERACTION_REGISTRY);
  private readonly progress = inject(LessonProgress, { optional: true });

  readonly step = input.required<InteractionStep>();
  readonly ted = input.required<LessonTed>();

  private readonly outlet = viewChild.required('outlet', { read: ViewContainerRef });

  private readonly loader = computed(() => this.registry[this.step().interaction.kind]);

  protected readonly component = resource({
    params: () => this.loader(),
    loader: ({ params }) => params(),
  });

  /** none: no component for this kind; loading; error: loading failed; ready. */
  protected readonly status = computed(() => {
    if (!this.loader()) return 'none';
    switch (this.component.status()) {
      case 'error':
        return 'error';
      case 'resolved':
      case 'local':
        return 'ready';
      default:
        return 'loading';
    }
  });

  protected readonly loadError = computed(() => LOAD_ERRORS[this.step().interaction.kind]);
  /** An exercise or typing drill is a light card, a game a dark panel (also while loading). */
  protected readonly light = computed(() => this.step().interaction.kind !== 'trace-game');

  protected readonly unavailable = computed(() => this.progress?.state() === 'unavailable');
  protected readonly error = computed(() => this.progress?.saveError(this.step().id) ?? null);
  protected readonly previous = computed(
    () => this.progress?.latestResult(this.step().interaction.id) ?? null,
  );
  /**
   * "Vorige keer: 92% goed." for a typing drill (right keys of all keys, rounded down as in the
   * drill), "<score> van <totaal> goed." for the others.
   */
  protected readonly previousText = computed(() => {
    const result = this.previous();
    if (!result) return '';
    if (this.step().interaction.kind === 'typing-drill') {
      return `Vorige keer: ${accuracy(result.score, result.total)}% goed.`;
    }
    return `Vorige keer: ${result.score} van ${result.total} goed.`;
  });

  private created: ComponentRef<unknown> | null = null;

  constructor() {
    // Creates the loaded component in the outlet: DOM work the template cannot do for a type
    // that is only known at run time.
    effect(() => {
      const type = this.component.hasValue() ? this.component.value() : undefined;
      const outlet = this.outlet();
      untracked(() => {
        if (this.created?.componentType === type) return;
        outlet.clear();
        this.created = null;
        if (!type) return;
        this.created = outlet.createComponent(type, {
          bindings: [
            inputBinding('config', () => this.step().interaction.config),
            inputBinding('ted', () => this.ted()),
            outputBinding('answered', () => this.onAnswered()),
            outputBinding<InteractionResult>('completed', (result) => this.onCompleted(result)),
          ],
        });
      });
    });
  }

  protected retryLoad(): void {
    this.component.reload();
  }

  protected retryProgress(): void {
    void this.progress?.reload();
  }

  private onAnswered(): void {
    void this.progress?.markStep(this.step().id, 'started');
  }

  private onCompleted(result: InteractionResult): void {
    const step = this.step();
    void this.progress?.recordInteraction(step.id, step.interaction, result);
  }
}
