import { afterEach, describe, expect, it, vi } from 'vitest';
import { grade, importSet, selectReview } from '../packages/core/engine';
import { exampleSets } from '../packages/core/examples';
import { teamboardCards } from '../packages/core/exports';
import { loadSets, restoreBackup, validateBackup } from '../packages/core/storage';
import type { LearningRecord, QuestionSet } from '../packages/core/types';

const set: QuestionSet = { schemaVersion: '1.0', id: 'test', version: 1, title: '테스트', questions: [
  { id: 'mc', type: 'multiple-choice', prompt: '선택', options: ['가', '나'], answer: 1, tags: [] },
  { id: 'tf', type: 'true-false', prompt: '참 거짓', answer: true, tags: [] },
  { id: 'sa', type: 'short-answer', prompt: '문자', answer: ['ABC', '정답'], tags: [] },
] };
const record = (questionId: string, correct: boolean, timestamp: number, overrides: Partial<LearningRecord> = {}): LearningRecord => ({ id: `${questionId}-${timestamp}`, setId: set.id, setVersion: 1, questionId, answer: 0, correct, durationMs: 1200, timestamp, mode: 'focus', ...overrides });
afterEach(() => vi.unstubAllGlobals());

describe('grading', () => {
  it('keeps choice and OX answer types strict', () => {
    expect(grade(set.questions[0], 1)).toBe(true); expect(grade(set.questions[0], '1')).toBe(false);
    expect(grade(set.questions[1], true)).toBe(true); expect(grade(set.questions[1], 1)).toBe(false);
  });
  it('normalizes Unicode compatibility characters and surrounding whitespace only', () => {
    expect(grade(set.questions[2], '  ＡＢＣ\n')).toBe(true); expect(grade(set.questions[2], '정답 ')).toBe(true);
    expect(grade(set.questions[2], 'abc')).toBe(false); expect(grade(set.questions[2], '정 답')).toBe(false);
  });
});
describe('question import', () => {
  it('imports all four teacher review examples', () => exampleSets.forEach(example => { expect(importSet(example).issues).toEqual([]); expect(example.questions.length).toBeGreaterThanOrEqual(3); }));
  it('reports invalid questions while retaining a reviewable valid subset', () => {
    const result = importSet({ ...set, questions: [set.questions[0], { ...set.questions[1], answer: 'true' }, { ...set.questions[2], id: 'mc' }] });
    expect(result.set?.questions.map(question => question.id)).toEqual(['mc']); expect(result.issues.map(issue => issue.index)).toEqual([1, 2]);
  });
  it('rejects wrong schema, broken JSON, and entirely invalid questions', () => {
    expect(importSet('{').set).toBeNull(); expect(importSet({ ...set, version: 0 }).set).toBeNull();
    expect(importSet({ ...set, questions: [{ ...set.questions[0], answer: 2 }] }).set).toBeNull();
  });
  it('rejects whitespace-only answers and malformed tags', () => {
    expect(importSet({ ...set, questions: [{ ...set.questions[2], answer: [' '] }] }).issues).toHaveLength(1);
    expect(importSet({ ...set, questions: [{ ...set.questions[1], tags: 'tag' }] }).issues).toHaveLength(1);
  });
  it('converts original PRD JSON 1.0 consistently without guessing an unsupported version', () => {
    const legacy = { version: '1.0', title: '분수', grade: '초6', subject: '수학', questions: [{ id: 'q1', type: 'multiple_choice', question: '2/3 ÷ 4는?', choices: ['1/6', '2/7'], answer: 0, difficulty: 1, tags: ['분수'] }] };
    const imported = importSet(legacy); expect(imported.issues).toEqual([]); expect(imported.set?.id).toBe(importSet(JSON.stringify(legacy)).set?.id);
    expect(imported.set?.questions[0]).toMatchObject({ type: 'multiple-choice', prompt: '2/3 ÷ 4는?', options: ['1/6', '2/7'], tags: ['분수', '초6', '수학'] });
    expect(importSet({ ...legacy, version: '2.0' }).set).toBeNull();
    expect(importSet({ ...legacy, questions: [{ ...legacy.questions[0], difficulty: 4 }] }).set).toBeNull();
  });
});
describe('review selection', () => {
  it('puts recent outstanding wrong answers before unattempted questions and excludes resolved answers', () => {
    const attempts = [record('mc', false, 10), record('mc', true, 30), record('tf', false, 20)];
    expect(selectReview([set], attempts).map(item => item.question.id)).toEqual(['tf', 'sa']);
  });
  it('keeps versions isolated, deduplicates questions, and applies the limit', () => {
    expect(selectReview([set, set], [record('mc', true, 50, { setVersion: 2 })], 2).map(item => item.question.id)).toEqual(['mc', 'tf']);
    expect(selectReview([set], [], -1)).toEqual([]);
  });
  it('prioritizes repeated wrong answers when recency is equal', () => {
    expect(selectReview([set], [record('mc', false, 10), record('tf', false, 5), record('tf', false, 10)]).map(item => item.question.id)).toEqual(['tf', 'mc', 'sa']);
  });
});
describe('backup validation', () => {
  const backup = () => ({ schemaVersion: '1.0', sets: [set], records: [record('mc', false, 10)] });
  it('accepts a roundtrip including historical version records', () => {
    const value = backup(); value.records[0].setVersion = 2;
    expect(validateBackup(JSON.stringify(value))).toEqual({ sets: [set], records: value.records });
  });
  it('rejects duplicates, invalid records, and partial-invalid question sets', () => {
    expect(() => validateBackup({ ...backup(), sets: [set, set] })).toThrow();
    expect(() => validateBackup({ ...backup(), records: [record('mc', false, 10), record('mc', false, 10)] })).toThrow();
    expect(() => validateBackup({ ...backup(), records: [{ ...record('mc', false, 10), durationMs: -1 }] })).toThrow();
    expect(() => validateBackup({ ...backup(), sets: [{ ...set, questions: [...set.questions, { id: 'bad' }] }] })).toThrow();
  });
  it('validates every entry before any database is opened or original data can be changed', async () => {
    const open = vi.fn(); vi.stubGlobal('indexedDB', { open });
    await expect(restoreBackup({ ...backup(), records: [...backup().records, { id: 'broken' }] })).rejects.toThrow();
    expect(open).not.toHaveBeenCalled();
  });
  it('reports unavailable IndexedDB and does not silently use localStorage', async () => {
    vi.stubGlobal('indexedDB', undefined); const setItem = vi.fn(); vi.stubGlobal('localStorage', { setItem });
    await expect(loadSets()).rejects.toThrow('IndexedDB'); expect(setItem).not.toHaveBeenCalled();
  });
});
describe('aggregate handoff text', () => {
  it('shows choice totals and excludes raw short answers that may contain student identifiers', () => {
    const output = teamboardCards(set, [{ questionId: 'mc', answer: 0, correct: false }, { questionId: 'mc', answer: 1, correct: true }, { questionId: 'sa', answer: '학생 이름 비공개', correct: false }]);
    expect(output).toContain('오답 1회 / 응답 2회'); expect(output).toContain('1. 가: 1회'); expect(output).not.toContain('학생 이름 비공개');
  });
});
