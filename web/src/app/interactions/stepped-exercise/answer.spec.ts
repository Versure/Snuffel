import answerCases from '../../../../../content/schema/v1/answer-matching.cases.json';
import type {
  CommonMistake,
  ExerciseAnswer,
  NumberAnswer,
  TextAnswer,
} from '../../core/content/content.types';
import { checkAnswer, normalizeText, parseNumber, readFraction } from './answer';

interface NumberCase {
  readonly name: string;
  readonly input: string;
  readonly unit?: string;
  readonly value: number | null;
}

interface TextCase {
  readonly name: string;
  readonly input: string;
  readonly normalized: string;
}

interface AnswerCase {
  readonly name: string;
  readonly answer: ExerciseAnswer;
  readonly commonMistakes: readonly CommonMistake[];
  readonly input: string;
  readonly outcome: string;
  readonly feedback?: string;
}

// The same cases as tools/content/answer.test.mjs, read from content/ (never copied into web/src).
const cases = answerCases as unknown as {
  readonly numbers: readonly NumberCase[];
  readonly texts: readonly TextCase[];
  readonly answers: readonly AnswerCase[];
};

const liters: NumberAnswer = { type: 'number', value: 0.75, tolerance: 0.01, unit: 'liter' };
const sixths: TextAnswer = { type: 'text', accepted: ['5/6', 'vijf zesde'] };
const outcome = (answer: ExerciseAnswer, input: string, mistakes: CommonMistake[] = []) =>
  checkAnswer(answer, input, mistakes).outcome;

describe('answer matching cases', () => {
  it('reads every number in answer-matching.cases.json', () => {
    expect(cases.numbers.length).toBeGreaterThan(20);
    for (const item of cases.numbers) {
      expect(parseNumber(item.input, item.unit), item.name).toBe(item.value);
    }
  });

  it('normalizes every text in answer-matching.cases.json', () => {
    expect(cases.texts.length).toBeGreaterThan(5);
    for (const item of cases.texts) {
      expect(normalizeText(item.input), item.name).toBe(item.normalized);
    }
  });

  it('gives the outcome of every answer in answer-matching.cases.json', () => {
    expect(cases.answers.length).toBeGreaterThan(15);
    for (const item of cases.answers) {
      expect(checkAnswer(item.answer, item.input, item.commonMistakes), item.name).toEqual(
        item.feedback === undefined
          ? { outcome: item.outcome }
          : { outcome: item.outcome, feedback: item.feedback },
      );
    }
  });
});

describe('tolerance', () => {
  it('a number within the tolerance is correct', () => {
    expect(outcome(liters, '0,755')).toBe('correct');
    expect(outcome(liters, '0,745')).toBe('correct');
  });

  it('a number exactly on the edge of the tolerance is correct', () => {
    expect(outcome(liters, '0,76')).toBe('correct');
    expect(outcome(liters, '0,74')).toBe('correct');
  });

  it('a number just outside the tolerance is wrong', () => {
    expect(outcome(liters, '0,7601')).toBe('wrong');
    expect(outcome(liters, '0,7399')).toBe('wrong');
    expect(outcome(liters, '0,8')).toBe('wrong');
  });

  it('tolerance 0 accepts a rounding error of the computer but not 0.0001', () => {
    const exact: NumberAnswer = { type: 'number', value: 0.3, tolerance: 0 };
    expect(outcome(exact, String(0.1 + 0.2))).toBe('correct');
    expect(outcome(exact, '0,3')).toBe('correct');
    expect(outcome(exact, '0,3001')).toBe('wrong');
    expect(outcome(exact, '0,2999')).toBe('wrong');
  });

  it('a fraction, a mixed number and a decimal with a comma or a point are the same number', () => {
    for (const input of ['5/4', '1 1/4', '1,25', '1.25', ' 5 / 4 ']) {
      expect(parseNumber(input), input).toBe(1.25);
    }
    for (const input of ['-5/4', '−1 1/4', '-1,25', '−1.25']) {
      expect(parseNumber(input), input).toBe(-1.25);
    }
  });

  it('the unit may be typed after the number', () => {
    expect(outcome(liters, '0,75 liter')).toBe('correct');
    expect(outcome(liters, '3/4 Liter')).toBe('correct');
    expect(outcome(liters, '0.75liter')).toBe('correct');
    expect(outcome(liters, '0,75')).toBe('correct');
  });

  it('another unit is unreadable', () => {
    expect(outcome(liters, '0,75 ml')).toBe('unreadable');
    expect(outcome(liters, '0,75 liters')).toBe('unreadable');
    expect(outcome({ type: 'number', value: 0.75, tolerance: 0.01 }, '0,75 liter')).toBe(
      'unreadable',
    );
  });
});

describe('accepted forms', () => {
  it('every form in accepted is correct', () => {
    for (const form of sixths.accepted) {
      expect(outcome(sixths, form), form).toBe('correct');
    }
    expect(outcome(sixths, '1/6')).toBe('wrong');
  });

  it('case, extra spaces, spaces around a slash, curly quotes and a final full stop do not count', () => {
    expect(outcome(sixths, '  Vijf   ZESDE ')).toBe('correct');
    expect(outcome(sixths, '5 / 6')).toBe('correct');
    expect(outcome(sixths, 'Vijf zesde.')).toBe('correct');
    const quoted: TextAnswer = { type: 'text', accepted: ['zo\'n "vijf"'] };
    expect(outcome(quoted, 'Zo’n “vijf”')).toBe('correct');
    expect(outcome(sixths, 'vijf zesde..')).toBe('wrong');
  });

  it('accents do count', () => {
    const cafe: TextAnswer = { type: 'text', accepted: ['café'] };
    expect(outcome(cafe, 'Café')).toBe('correct');
    expect(outcome(cafe, 'cafe')).toBe('wrong');
    expect(outcome({ type: 'text', accepted: ['cafe'] }, 'café')).toBe('wrong');
  });

  it('markup in accepted is ignored', () => {
    const marked: TextAnswer = { type: 'text', accepted: ['**vijf** [[zesde]]', '*5/6*'] };
    expect(outcome(marked, 'vijf zesde')).toBe('correct');
    expect(outcome(marked, '5/6')).toBe('correct');
  });
});

describe('common mistakes', () => {
  const thirds: CommonMistake = { answer: '2/6', feedback: 'Tel de noemers niet op.' };

  it('a common mistake gives its feedback', () => {
    const text: TextAnswer = { type: 'text', accepted: ['3/5'] };
    const mistakes = [{ answer: '3/10', feedback: 'Je telde de noemers ook op.' }];
    expect(checkAnswer(text, '3/10', mistakes)).toEqual({
      outcome: 'mistake',
      feedback: 'Je telde de noemers ook op.',
    });
    expect(checkAnswer(text, '3/11', mistakes)).toEqual({ outcome: 'wrong' });
  });

  it('a number mistake matches within the tolerance', () => {
    const half = { answer: '0,5', feedback: 'Je vergat de room.' };
    expect(checkAnswer(liters, '0,51 liter', [half])).toEqual({
      outcome: 'mistake',
      feedback: 'Je vergat de room.',
    });
    expect(checkAnswer(liters, '1/3', [half, thirds])).toEqual({
      outcome: 'mistake',
      feedback: thirds.feedback,
    });
    expect(outcome(liters, '0,52', [half])).toBe('wrong');
    // With tolerance 0 an approximation of 2/6 is no match.
    expect(outcome({ type: 'number', value: 0.75, tolerance: 0 }, '0,3333', [thirds])).toBe(
      'wrong',
    );
  });

  it('a choice mistake matches its option id', () => {
    const choice: ExerciseAnswer = {
      type: 'choice',
      options: [
        { id: 'goed', text: '1/2 + 1/4' },
        { id: 'fout', text: '3/4 + 3/4' },
        { id: 'anders', text: '1/4' },
      ],
      correctOptionId: 'goed',
    };
    const mistakes = [{ answer: 'fout', feedback: 'Dat is twee keer 3/4.' }];
    expect(checkAnswer(choice, 'goed', mistakes)).toEqual({ outcome: 'correct' });
    expect(checkAnswer(choice, 'fout', mistakes)).toEqual({
      outcome: 'mistake',
      feedback: 'Dat is twee keer 3/4.',
    });
    expect(checkAnswer(choice, 'anders', mistakes)).toEqual({ outcome: 'wrong' });
  });

  it('correct wins over a mistake', () => {
    expect(outcome(liters, '0,75', [{ answer: '0,75', feedback: 'Nee.' }])).toBe('correct');
    expect(outcome(sixths, '5/6', [{ answer: '5 / 6', feedback: 'Nee.' }])).toBe('correct');
  });

  it('empty and unreadable input are no attempt', () => {
    expect(outcome(liters, '', [thirds])).toBe('empty');
    expect(outcome(liters, '   ')).toBe('empty');
    expect(outcome(liters, 'abc', [{ answer: 'abc', feedback: 'Nee.' }])).toBe('unreadable');
    expect(outcome(liters, '1/0')).toBe('unreadable');
    expect(outcome(sixths, '  ')).toBe('empty');
  });
});

describe('readFraction', () => {
  const sixthsNumber: NumberAnswer = { type: 'number', value: 3 / 5, tolerance: 0.001 };
  const choice: ExerciseAnswer = {
    type: 'choice',
    options: [
      { id: 'drie-vijfde', text: '3/5' },
      { id: 'twee-tiende', text: '2/10' },
    ],
    correctOptionId: 'drie-vijfde',
  };

  it('reads 3/5, 3 / 5 and 1 1/4 as fractions', () => {
    for (const answer of [sixthsNumber, sixths]) {
      expect(readFraction(answer, '3/5')).toEqual({
        negative: false,
        numerator: '3',
        denominator: '5',
      });
      expect(readFraction(answer, ' 3 / 5 ')).toEqual({
        negative: false,
        numerator: '3',
        denominator: '5',
      });
      expect(readFraction(answer, '1 1/4')).toEqual({
        negative: false,
        whole: '1',
        numerator: '1',
        denominator: '4',
      });
    }
    expect(readFraction(sixths, '1  1/4')).toEqual({
      negative: false,
      whole: '1',
      numerator: '1',
      denominator: '4',
    });
  });

  it('11/4 is not 1 1/4', () => {
    expect(readFraction(sixthsNumber, '11/4')).toEqual({
      negative: false,
      numerator: '11',
      denominator: '4',
    });
  });

  it('a number answer drops its unit and reads a minus', () => {
    expect(readFraction(liters, '3/4 liter')).toEqual({
      negative: false,
      numerator: '3',
      denominator: '4',
    });
    expect(readFraction(liters, '3/4 Liter')).toEqual({
      negative: false,
      numerator: '3',
      denominator: '4',
    });
    expect(readFraction(sixthsNumber, '-1/2')).toEqual({
      negative: true,
      numerator: '1',
      denominator: '2',
    });
    expect(readFraction(sixthsNumber, '−1 1/2')).toEqual({
      negative: true,
      whole: '1',
      numerator: '1',
      denominator: '2',
    });
    expect(readFraction(liters, '3/4 kilo')).toBeNull();
  });

  it('a decimal, words, empty, 3/0 and a choice are no fraction', () => {
    for (const input of ['0,75', '0.75', '3', 'drie vijfde', '', '  ', '3/0', '1 1/0', '3/']) {
      expect(readFraction(sixthsNumber, input), input).toBeNull();
      expect(readFraction(sixths, input), input).toBeNull();
    }
    expect(readFraction(choice, '3/5')).toBeNull();
    expect(readFraction(choice, 'drie-vijfde')).toBeNull();
  });
});
