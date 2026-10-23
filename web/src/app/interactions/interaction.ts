// The contract between an interaction component (a game such as `trace-game`) and the lesson.
// A component knows nothing of PocketBase: snf-interaction gives it `config` and `ted`, listens
// to `answered` and `completed`, and stores the result through LessonProgress.
import type { InputSignal, OutputEmitterRef } from '@angular/core';
import type { LessonTed } from '../core/content/content.types';

/** Extra data of a finished game, stored as json (at most 4 kB) in `interaction_results`. */
export type InteractionDetail = Readonly<Record<string, unknown>>;

/** The outcome of one finished game. */
export interface InteractionResult {
  readonly score: number;
  readonly total: number;
  readonly detail: InteractionDetail;
}

/** What every interaction component has (see interactions/registry.ts). */
export interface InteractionComponent<Config> {
  /** The `config` of its kind, from the lesson. */
  readonly config: InputSignal<Config>;
  /** The Ted lines of the lesson (`correct`, `incorrect`, …). */
  readonly ted: InputSignal<LessonTed>;
  /** The first answer in a game. */
  readonly answered: OutputEmitterRef<void>;
  /** A finished game. */
  readonly completed: OutputEmitterRef<InteractionResult>;
}
