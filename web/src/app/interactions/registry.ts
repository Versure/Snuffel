import { InjectionToken, type Type } from '@angular/core';
import type { Interaction } from '../core/content/content.types';

/** Loads the component of one kind of interaction (a separate, lazy file). */
export type InteractionLoader = () => Promise<Type<unknown>>;

/** Per kind of interaction (`kind` in the lesson) the loader of its component. */
export type InteractionRegistry = Readonly<Partial<Record<Interaction['kind'], InteractionLoader>>>;

/**
 * Every kind with a component. A new kind is one line here (skill `spelcomponent-bouwen`); its
 * component follows the contract in interaction.ts. A kind without a line shows the placeholder.
 */
export const INTERACTIONS: InteractionRegistry = {
  'trace-game': () => import('./trace-game/trace-game').then((module) => module.TraceGame),
  'stepped-exercise': () =>
    import('./stepped-exercise/stepped-exercise').then((module) => module.SteppedExercise),
};

/** The registry of snf-interaction; a unit test can provide fake components. */
export const INTERACTION_REGISTRY = new InjectionToken<InteractionRegistry>(
  'INTERACTION_REGISTRY',
  {
    providedIn: 'root',
    factory: () => INTERACTIONS,
  },
);
