import { importSet } from './engine';
import { exampleSets } from './examples';
import type { LearningRecord, QuestionSet } from './types';

const DB_NAME = 'whalequest-learning';
let connection: Promise<IDBDatabase> | undefined;
function database(): Promise<IDBDatabase> {
  if (!globalThis.indexedDB) return Promise.reject(new Error('이 브라우저에서 IndexedDB를 사용할 수 없습니다. 데이터를 저장하지 않았습니다.'));
  connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('sets')) db.createObjectStore('sets', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('records')) db.createObjectStore('records', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
    };
    request.onsuccess = () => { request.result.onversionchange = () => { request.result.close(); connection = undefined; }; resolve(request.result); };
    request.onerror = () => { connection = undefined; reject(request.error ?? new Error('학습 저장소를 열 수 없습니다.')); };
    request.onblocked = () => { connection = undefined; reject(new Error('다른 탭이 학습 저장소를 사용 중입니다. 다른 탭을 닫고 다시 시도하세요.')); };
  });
  return connection;
}
async function transaction<T>(stores: string[], mode: IDBTransactionMode, run: (tx: IDBTransaction, result: (value: T) => void) => void): Promise<T> {
  const db = await database();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    let value: T;
    tx.oncomplete = () => resolve(value);
    tx.onerror = () => reject(tx.error ?? new Error('학습 데이터 저장에 실패했습니다.'));
    tx.onabort = () => reject(tx.error ?? new Error('학습 데이터 변경을 취소했습니다.'));
    try { run(tx, next => { value = next; }); } catch (error) { tx.abort(); reject(error); }
  });
}
function validateSet(raw: unknown): QuestionSet {
  const parsed = importSet(raw);
  if (!parsed.set || parsed.issues.length) throw new Error('문제 세트가 유효하지 않습니다. 가져오기 오류를 먼저 확인하세요.');
  return parsed.set;
}
function validateRecord(raw: unknown): LearningRecord {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error('학습 기록 형식이 올바르지 않습니다.');
  const value = raw as Record<string, unknown>;
  for (const key of ['id', 'setId', 'questionId']) if (typeof value[key] !== 'string' || !(value[key] as string).trim() || (value[key] as string).length > 120) throw new Error('학습 기록 식별자가 올바르지 않습니다.');
  if (!Number.isSafeInteger(value.setVersion) || Number(value.setVersion) < 1 || typeof value.correct !== 'boolean' || !['focus', 'review'].includes(String(value.mode)) || typeof value.durationMs !== 'number' || !Number.isFinite(value.durationMs) || value.durationMs < 0 || typeof value.timestamp !== 'number' || !Number.isFinite(value.timestamp) || value.timestamp < 0 || !((typeof value.answer === 'string' && value.answer.length <= 5000) || typeof value.answer === 'boolean' || (typeof value.answer === 'number' && Number.isFinite(value.answer)))) throw new Error('학습 기록의 응답, 시간 또는 버전이 올바르지 않습니다.');
  return { id: value.id as string, setId: value.setId as string, setVersion: Number(value.setVersion), questionId: value.questionId as string, answer: value.answer as LearningRecord['answer'], correct: value.correct, durationMs: value.durationMs, timestamp: value.timestamp, mode: value.mode as LearningRecord['mode'] };
}

/** Pure validation is also used before opening a write transaction, so invalid backups cannot erase data. */
export function validateBackup(raw: unknown): { sets: QuestionSet[]; records: LearningRecord[] } {
  if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch { throw new Error('백업 파일이 올바른 JSON이 아닙니다.'); } }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error('백업 파일 형식이 올바르지 않습니다.');
  const value = raw as Record<string, unknown>;
  if (value.schemaVersion !== '1.0' || !Array.isArray(value.sets) || !Array.isArray(value.records) || value.sets.length > 1000 || value.records.length > 100000) throw new Error('백업 버전이나 데이터 배열을 확인하세요.');
  const sets = value.sets.map(validateSet);
  const records = value.records.map(validateRecord);
  if (new Set(sets.map(set => set.id)).size !== sets.length || new Set(records.map(record => record.id)).size !== records.length) throw new Error('백업에 중복된 식별자가 있습니다.');
  return { sets, records };
}
export function loadSets(): Promise<QuestionSet[]> {
  return transaction(['sets', 'meta'], 'readwrite', (tx, result) => {
    const store = tx.objectStore('sets');
    const request = store.getAll();
    const initialized = tx.objectStore('meta').get('initialized');
    const finish = () => {
      if (request.readyState !== 'done' || initialized.readyState !== 'done') return;
      const sets = request.result as QuestionSet[];
      if (!sets.length && !initialized.result) { exampleSets.forEach(set => store.put(set)); result(structuredClone(exampleSets)); } else result(sets);
      tx.objectStore('meta').put(true, 'initialized');
    };
    request.onsuccess = finish; initialized.onsuccess = finish;
  });
}
export async function saveSet(set: QuestionSet): Promise<void> {
  const valid = validateSet(set);
  return transaction(['sets', 'meta'], 'readwrite', tx => { tx.objectStore('sets').put(valid); tx.objectStore('meta').put(true, 'initialized'); });
}
export function deleteSet(id: string): Promise<void> {
  return transaction(['sets', 'records'], 'readwrite', tx => {
    tx.objectStore('sets').delete(id);
    const request = tx.objectStore('records').openCursor();
    request.onsuccess = () => { const cursor = request.result; if (!cursor) return; if ((cursor.value as LearningRecord).setId === id) cursor.delete(); cursor.continue(); };
  });
}
export function loadRecords(): Promise<LearningRecord[]> {
  return transaction(['records'], 'readonly', (tx, result) => { const request = tx.objectStore('records').getAll(); request.onsuccess = () => result(request.result as LearningRecord[]); });
}
export async function saveRecord(record: LearningRecord): Promise<void> {
  const valid = validateRecord(record);
  return transaction(['records'], 'readwrite', tx => { tx.objectStore('records').put(valid); });
}
export function clearData(): Promise<void> {
  return transaction(['sets', 'records', 'meta'], 'readwrite', tx => { tx.objectStore('sets').clear(); tx.objectStore('records').clear(); tx.objectStore('meta').put(true, 'initialized'); });
}
export function exportBackup(): Promise<string> {
  return transaction(['sets', 'records'], 'readonly', (tx, result) => {
    const sets = tx.objectStore('sets').getAll();
    const records = tx.objectStore('records').getAll();
    const finish = () => { if (sets.readyState === 'done' && records.readyState === 'done') result(JSON.stringify({ schemaVersion: '1.0', exportedAt: new Date().toISOString(), sets: sets.result, records: records.result }, null, 2)); };
    sets.onsuccess = finish; records.onsuccess = finish;
  });
}
export async function restoreBackup(raw: unknown): Promise<void> {
  const valid = validateBackup(raw);
  return transaction(['sets', 'records', 'meta'], 'readwrite', tx => {
    tx.objectStore('sets').clear(); tx.objectStore('records').clear();
    tx.objectStore('meta').put(true, 'initialized');
    valid.sets.forEach(set => tx.objectStore('sets').put(set));
    valid.records.forEach(record => tx.objectStore('records').put(record));
  });
}
