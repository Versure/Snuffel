import { TestBed } from '@angular/core/testing';
import { RANDOM } from './random';

describe('RANDOM', () => {
  it('is Math.random by default', () => {
    expect(TestBed.inject(RANDOM)).toBe(Math.random);
  });

  it('can be replaced, for example by a fixed value in a test', () => {
    TestBed.configureTestingModule({ providers: [{ provide: RANDOM, useValue: () => 0.5 }] });
    expect(TestBed.inject(RANDOM)()).toBe(0.5);
  });
});
