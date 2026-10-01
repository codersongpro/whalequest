import type { Answer, ImportResult, LearningRecord, Question, QuestionSet } from './types';

const normalize = (value: string) => value.normalize('NFKC').trim();
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown, limit = 5000): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= limit;

export function grade(question: Question, answer: Answer): boolean {
  if (question.type === 'multiple-choice') return typeof answer === 'number' && Number.isInteger(answer) && answer === question.answer;
  if (question.type === 'true-false') return typeof answer === 'boolean' && answer === question.answer;
  return typeof answer === 'string' && Array.isArray(question.answer) && question.answer.some(value => normalize(value) === normalize(answer));
}

/** Invalid questions are reported individually; callers must explicitly approve a partial import. */
export function importSet(raw: unknown): ImportResult {
  if (typeof raw === 'string') {
    try { raw = JSON.parse(raw); } catch { return { set: null, issues: [{ index: -1, message: '올바른 JSON 파일이 아닙니다.' }] }; }
  }
  // Original PRD JSON 1.0 used version/question/choices and underscore type names.
  if (object(raw) && raw.schemaVersion === undefined && raw.version === '1.0' && Array.isArray(raw.questions)) {
    const legacy = raw;
    const legacyQuestions: unknown[] = raw.questions;
    let hash = 2166136261;
    for (const char of JSON.stringify(legacy)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    const metadata = ['grade', 'subject', 'unit'].map(key => legacy[key]).filter((value): value is string => text(value, 100));
    raw = { schemaVersion: '1.0', id: text(legacy.id, 120) ? legacy.id : `import-${(hash >>> 0).toString(16)}`, version: 1, title: legacy.title, questions: legacyQuestions.map(value => {
      if (!object(value)) return value;
      return { ...value, type: typeof value.type === 'string' ? value.type.replaceAll('_', '-') : value.type, prompt: value.question, options: value.choices, tags: value.tags === undefined ? metadata : Array.isArray(value.tags) ? [...value.tags, ...metadata] : value.tags };
    }) };
  }
  if (!object(raw) || raw.schemaVersion !== '1.0' || !text(raw.id, 120) || !text(raw.title, 200) || !Number.isSafeInteger(raw.version) || Number(raw.version) < 1 || !Array.isArray(raw.questions) || raw.questions.length < 1 || raw.questions.length > 500) {
    return { set: null, issues: [{ index: -1, message: 'schemaVersion 1.0, 고유 id, 제목, 1 이상의 정수 version, 1~500개 questions가 필요합니다.' }] };
  }
  const issues: ImportResult['issues'] = [];
  const questions: Question[] = [];
  const ids = new Set<string>();
  raw.questions.forEach((value, index) => {
    const fail = (message: string) => issues.push({ index, message });
    if (!object(value) || !text(value.id, 120) || !text(value.prompt)) { fail('문제 id와 발문이 필요합니다.'); return; }
    if (ids.has(value.id.trim())) { fail('문제 id가 중복되었습니다.'); return; }
    if (!['multiple-choice', 'true-false', 'short-answer'].includes(String(value.type))) { fail('지원하지 않는 문제 유형입니다.'); return; }
    if (value.difficulty !== undefined && (!Number.isInteger(value.difficulty) || Number(value.difficulty) < 1 || Number(value.difficulty) > 3)) { fail('difficulty는 1~3의 정수여야 합니다.'); return; }
    if (value.tags !== undefined && (!Array.isArray(value.tags) || value.tags.length > 30 || value.tags.some(tag => !text(tag, 100)))) { fail('tags는 짧은 문자열 배열이어야 합니다.'); return; }
    if (value.standard !== undefined && !text(value.standard, 500)) { fail('성취기준은 문자열이어야 합니다.'); return; }
    if (value.explanation !== undefined && !text(value.explanation)) { fail('해설은 문자열이어야 합니다.'); return; }
    if (value.type === 'multiple-choice' && (!Array.isArray(value.options) || value.options.length < 2 || value.options.length > 10 || value.options.some(option => !text(option, 2000)) || !Number.isInteger(value.answer) || Number(value.answer) < 0 || Number(value.answer) >= value.options.length)) { fail('객관식은 2~10개 선택지와 0부터 시작하는 정답 번호가 필요합니다.'); return; }
    if (value.type === 'true-false' && typeof value.answer !== 'boolean') { fail('OX 정답은 true 또는 false여야 합니다.'); return; }
    if (value.type === 'short-answer' && (!Array.isArray(value.answer) || value.answer.length < 1 || value.answer.length > 20 || value.answer.some(answer => !text(answer, 500)))) { fail('단답 정답은 허용 답안 문자열 배열이어야 합니다.'); return; }
    ids.add(value.id.trim());
    questions.push({ id: value.id.trim(), type: value.type as Question['type'], prompt: value.prompt.trim(), answer: value.answer as Question['answer'], tags: (value.tags as string[] | undefined)?.map(tag => tag.trim()) ?? [], ...(value.type === 'multiple-choice' ? { options: (value.options as string[]).map(option => option.trim()) } : {}), ...(value.explanation !== undefined ? { explanation: (value.explanation as string).trim() } : {}), ...(value.standard !== undefined ? { standard: (value.standard as string).trim() } : {}) });
  });
  return { set: questions.length ? { schemaVersion: '1.0', id: raw.id.trim(), version: Number(raw.version), title: raw.title.trim(), questions } : null, issues };
}

export function selectReview(sets: QuestionSet[], records: LearningRecord[], limit = 20): Array<{ set: QuestionSet; question: Question }> {
  const candidates: Array<{ set: QuestionSet; question: Question; rank: number; wrongCount: number; timestamp: number }> = [];
  const seen = new Set<string>();
  const history = new Map<string, { latest: LearningRecord; wrongCount: number }>();
  for (const record of records) {
    const key = JSON.stringify([record.setId, record.setVersion, record.questionId]);
    const current = history.get(key);
    if (!current) history.set(key, { latest: record, wrongCount: record.correct ? 0 : 1 });
    else { if (record.timestamp > current.latest.timestamp) current.latest = record; if (!record.correct) current.wrongCount++; }
  }
  for (const set of sets) for (const question of set.questions) {
    const key = JSON.stringify([set.id, set.version, question.id]);
    if (seen.has(key)) continue;
    seen.add(key);
    const attempts = history.get(key);
    if (attempts?.latest.correct) continue;
    candidates.push({ set, question, rank: attempts ? 0 : 1, wrongCount: attempts?.wrongCount ?? 0, timestamp: attempts?.latest.timestamp ?? 0 });
  }
  // Outstanding wrong answers first, newest first; repetition breaks recency ties. Unattempted questions follow.
  return candidates.sort((a, b) => a.rank - b.rank || b.timestamp - a.timestamp || b.wrongCount - a.wrongCount).slice(0, Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 20).map(({ set, question }) => ({ set, question }));
}
