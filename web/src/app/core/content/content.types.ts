// Generated from content/schema/v1 by `npm run content:types`. Do not edit.
// Change the schemas instead; `npm run check` fails when this file is out of date.

export type ContentId = string;

export type ContentText = string;

/**
 * A course (learning path or practice set): course.json in content/courses/<course-id>/.
 */
export interface Course {
  schemaVersion: 1;
  id: ContentId;
  title: ContentText;
  audience: ContentText;
  goal: ContentText;
  successCriterion: ContentText;
  /**
   * course: learning path; practice: homework practice for a school subject.
   */
  kind: 'course' | 'practice';
  subject?: ContentText;
  schoolLevel?: ContentText;
  method?: ContentText;
  chapter?: ContentText;
  ted: CourseTed;
  /**
   * @minItems 1
   */
  lessons: CourseLesson[];
  sources: Source[];
}

export interface CourseTed {
  greeting: ContentText;
}

/**
 * A lesson entry in course.json. planned: id and title only; published: file required.
 */
export interface CourseLesson {
  id: ContentId;
  title: ContentText;
  status: 'planned' | 'published';
  file?: string;
}

export interface Source {
  id: ContentId;
  title: ContentText;
  url: string;
  publisher: ContentText;
  type:
    | 'government'
    | 'association'
    | 'education'
    | 'science'
    | 'media'
    | 'encyclopedia'
    | 'manufacturer'
    | 'shop'
    | 'blog'
    | 'forum'
    | 'method';
  /**
   * high: government, association, education, science; medium: established media, encyclopedia, manufacturer about its own product; low: shop, blog, forum.
   */
  reliability: 'high' | 'medium' | 'low';
  accessedOn: string;
  note?: ContentText;
}

export type TedMood = 'cool' | 'happy' | 'thinking' | 'oops';

export type LessonStep = ExplainStep | InteractionStep | QuizStep | PracticeStep;

export type Block =
  TextBlock | ExampleBlock | SignalCardsBlock | RuleBlock | TipBlock | FigureBlock | TedSaysBlock;

/**
 * Ids from sources in course.json. Empty only for text without a factual claim.
 */
export type SourceRefs = ContentId[];

/**
 * Name of an icon from the app's fixed icon set; the app draws each one itself.
 */
export type SignalIcon =
  'tick' | 'shake' | 'stop' | 'check' | 'cross' | 'question' | 'idea' | 'warning';

/**
 * Its id is the interaction_id in interaction_results.
 */
export type Interaction = TraceGameInteraction | SteppedExerciseInteraction;

/**
 * Id of one of the choices.
 */
export type ContentId1 = string;

export type ShapePart = ShapeBase | ShapePulse | ShapePulses | ShapeRamp | ShapeWobble;

/**
 * A time or height on the 0-1 scale of the trace.
 */
export type TraceUnit = number;

export type TracePositiveUnit = number;

export type ExerciseAnswer = NumberAnswer | TextAnswer | ChoiceAnswer;

/**
 * A wrong answer as a child would type or choose it.
 */
export type ContentText1 = string;

/**
 * Shown only after an own attempt and all hints.
 */
export type ContentText2 = string;

/**
 * A lesson: lessons/<nn>-<slug>.json in a course directory.
 */
export interface Lesson {
  schemaVersion: 1;
  id: ContentId;
  /**
   * Raise by one on every change after publication; stored as content_version with progress.
   */
  version: number;
  title: ContentText;
  sticker: ContentText;
  objective: ContentText;
  concept: ContentText;
  estimatedMinutes: number;
  glossary: GlossaryEntry[];
  ted: LessonTed;
  /**
   * @minItems 1
   */
  steps: LessonStep[];
  furtherReading: FurtherReading[];
  faq: FaqEntry[];
}

export interface GlossaryEntry {
  term: ContentText;
  definition: ContentText;
}

export interface LessonTed {
  intro: TedLine;
  /**
   * @minItems 1
   */
  correct: ContentText[];
  /**
   * @minItems 1
   */
  incorrect: ContentText[];
  finished: ContentText;
}

export interface TedLine {
  mood: TedMood;
  text: ContentText;
}

export interface ExplainStep {
  id: ContentId;
  type: 'explain';
  title: ContentText;
  /**
   * @minItems 1
   */
  blocks: Block[];
}

export interface TextBlock {
  type: 'text';
  text: ContentText;
  sourceRefs: SourceRefs;
}

export interface ExampleBlock {
  type: 'example';
  text: ContentText;
  sourceRefs: SourceRefs;
}

export interface SignalCardsBlock {
  type: 'signal-cards';
  /**
   * @minItems 1
   */
  cards: SignalCard[];
}

export interface SignalCard {
  icon: SignalIcon;
  title: ContentText;
  text: ContentText;
  sourceRefs: SourceRefs;
}

export interface RuleBlock {
  type: 'rule';
  title: ContentText;
  text: ContentText;
  sourceRefs: SourceRefs;
}

export interface TipBlock {
  type: 'tip';
  title?: ContentText;
  text: ContentText;
  sourceRefs: SourceRefs;
}

export interface FigureBlock {
  type: 'figure';
  /**
   * Path of an svg in the course's assets directory, for example assets/hengeltop.svg.
   */
  src: string;
  alt: ContentText;
  caption?: ContentText;
  sourceRefs: SourceRefs;
}

export interface TedSaysBlock {
  type: 'ted-says';
  mood: TedMood;
  text: ContentText;
  sourceRefs: SourceRefs;
}

export interface InteractionStep {
  id: ContentId;
  type: 'interaction';
  title: ContentText;
  intro: ContentText;
  interaction: Interaction;
  sourceRefs: SourceRefs;
}

export interface TraceGameInteraction {
  id: ContentId;
  kind: 'trace-game';
  config: TraceGameConfig;
}

export interface TraceGameConfig {
  /**
   * @minItems 2
   * @maxItems 6
   */
  choices: TraceChoice[];
  /**
   * @minItems 2
   */
  patterns: TracePattern[];
  rounds: number;
  durationMs: number;
}

export interface TraceChoice {
  id: ContentId;
  label: ContentText;
  /**
   * Name of a colour token, never a colour value.
   */
  color: 'yellow' | 'pink' | 'purple' | 'blue' | 'green' | 'orange';
}

export interface TracePattern {
  id: ContentId;
  answer: ContentId1;
  /**
   * Building blocks; the line is the sum of all blocks at time t (0-1).
   *
   * @minItems 1
   */
  shape: ShapePart[];
  explanation: ContentText;
}

/**
 * Constant level.
 */
export interface ShapeBase {
  type: 'base';
  level: TraceUnit;
}

/**
 * One peak at time at.
 */
export interface ShapePulse {
  type: 'pulse';
  at: TraceUnit;
  width: TracePositiveUnit;
  height: TraceUnit;
}

/**
 * count peaks, interval apart, from start.
 */
export interface ShapePulses {
  type: 'pulses';
  start: TraceUnit;
  interval: TracePositiveUnit;
  count: number;
  width: TracePositiveUnit;
  height: TraceUnit;
}

/**
 * Smooth rise of height between from and to.
 */
export interface ShapeRamp {
  type: 'ramp';
  from: TraceUnit;
  to: TraceUnit;
  height: TraceUnit;
}

/**
 * Trembling with an amplitude and a frequency (waves over the whole trace), optionally only between from and to.
 */
export interface ShapeWobble {
  type: 'wobble';
  amplitude: TraceUnit;
  frequency: number;
  from?: TraceUnit;
  to?: TraceUnit;
}

export interface SteppedExerciseInteraction {
  id: ContentId;
  kind: 'stepped-exercise';
  config: SteppedExerciseConfig;
}

export interface SteppedExerciseConfig {
  /**
   * @minItems 1
   */
  exercises: Exercise[];
}

export interface Exercise {
  id: ContentId;
  prompt: ContentText;
  answer: ExerciseAnswer;
  /**
   * Increasingly concrete hints, shown one at a time.
   */
  hints: ContentText[];
  steps: ExerciseStep[];
  commonMistakes: CommonMistake[];
  workedSolution: ContentText2;
}

export interface NumberAnswer {
  type: 'number';
  value: number;
  tolerance: number;
  unit?: ContentText;
}

export interface TextAnswer {
  type: 'text';
  /**
   * @minItems 1
   */
  accepted: ContentText[];
}

export interface ChoiceAnswer {
  type: 'choice';
  /**
   * @minItems 2
   */
  options: ChoiceOption[];
  correctOptionId: ContentId;
}

export interface ChoiceOption {
  id: ContentId;
  text: ContentText;
}

export interface ExerciseStep {
  id: ContentId;
  title: ContentText;
  text: ContentText;
}

export interface CommonMistake {
  answer: ContentText1;
  feedback: ContentText;
}

export interface QuizStep {
  id: ContentId;
  type: 'quiz';
  title: ContentText;
  intro?: ContentText;
  /**
   * @minItems 1
   */
  questions: QuizQuestion[];
}

export interface QuizQuestion {
  id: ContentId;
  prompt: ContentText;
  /**
   * @minItems 1
   */
  options: QuizOption[];
  correctOptionId: ContentId;
  hints: ContentText[];
  sourceRefs: SourceRefs;
}

export interface QuizOption {
  id: ContentId;
  text: ContentText;
  feedback: ContentText;
}

/**
 * A checklist; its id is the checklist_id in checklist_states.
 */
export interface PracticeStep {
  id: ContentId;
  type: 'practice';
  practiceKind: 'at-the-water' | 'do-it-yourself';
  title: ContentText;
  intro: ContentText;
  /**
   * @minItems 1
   */
  items: PracticeItem[];
  successCriterion: ContentText;
}

export interface PracticeItem {
  id: ContentId;
  text: ContentText;
  links?: Link[];
  sourceRefs: SourceRefs;
}

export interface Link {
  label: ContentText;
  url: string;
}

export interface FurtherReading {
  sourceRef: ContentId;
  why: ContentText;
}

export interface FaqEntry {
  q: ContentText;
  a: ContentText;
}

/**
 * First 16 hex characters of the sha-256 of the file.
 */
export type ContentHash = string;

/**
 * web/public/content/manifest.json, written by npm run content:build. Paths are relative to /content/.
 */
export interface ContentManifest {
  schemaVersion: 1;
  courses: ManifestCourse[];
}

export interface ManifestCourse {
  id: ContentId;
  title: string;
  kind: 'course' | 'practice';
  file: string;
  hash: ContentHash;
  lessons: ManifestLesson[];
  /**
   * Every asset a published lesson of the course uses, sorted by path. Empty if there are none.
   */
  assets: ManifestAsset[];
}

export interface ManifestLesson {
  id: ContentId;
  title: string;
  status: 'planned' | 'published';
  version?: number;
  estimatedMinutes?: number;
  file?: string;
  hash?: ContentHash;
}

export interface ManifestAsset {
  /**
   * Path relative to the course directory, the same as figure.src in the lesson.
   */
  path: string;
  hash: ContentHash;
}

/**
 * content/terms.json: subject terms that must be in the glossary of a lesson that uses them.
 */
export interface Terms {
  schemaVersion: 1;
  terms: Term[];
}

export interface Term {
  term: string;
  /**
   * Other forms that also count, for example inflections.
   */
  forms?: string[];
}
