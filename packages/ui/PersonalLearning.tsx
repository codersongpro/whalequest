import {useEffect, useRef, useState} from 'react';
import type {Answer, ImportResult, LearningRecord, Question, QuestionSet, QuestionType} from '../core/types';
import {loadSets, saveSet, deleteSet, loadRecords, saveRecord, clearData, exportBackup, restoreBackup} from '../core/storage';
import {grade, importSet, selectReview} from '../core/engine';
import {exampleSets} from '../core/examples';
import {completionCard, downloadBlob, downloadText, questionPrompt} from '../core/exports';
import './personal.css';
import {LocalShareButton} from './SharedSet';

type Pair = {set: QuestionSet; question: Question};
type Session = {items: Pair[]; index: number; mode: 'focus'|'review'; results: LearningRecord[]; title: string};
type Draft = {id: string; type: QuestionType; prompt: string; options: string; answer: string; explanation: string; tags: string; standard: string};
const uid = () => crypto.randomUUID();
const blankDraft = (): Draft => ({id: uid(), type: 'multiple-choice', prompt: '', options: '', answer: '1', explanation: '', tags: '', standard: ''});
const messageOf = (error: unknown) => error instanceof Error ? error.message : '작업을 완료하지 못했습니다. 다시 시도해 주세요.';
const formatDate = (value: number) => new Date(value).toLocaleString('ko-KR');
const typeLabels: Record<QuestionType, string> = {'multiple-choice': '객관식', 'true-false': '참·거짓', 'short-answer': '단답형'};

export function PersonalLearning() {
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [records, setRecords] = useState<LearningRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<'library'|'import'|'editor'|'history'|'data'>('library');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [raw, setRaw] = useState('');
  const [imported, setImported] = useState<ImportResult|null>(null);
  const [confirmed, setConfirmed] = useState<string[]>([]);
  const [editing, setEditing] = useState<QuestionSet|null>(null);
  const [title, setTitle] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [draftError, setDraftError] = useState('');
  const [session, setSession] = useState<Session|null>(null);
  const [answer, setAnswer] = useState<Answer>('');
  const [feedback, setFeedback] = useState<LearningRecord|null>(null);
  const [name, setName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<QuestionSet|null>(null);
  const [deleteText, setDeleteText] = useState('');
  const [clearText, setClearText] = useState('');
  const [restoreRaw, setRestoreRaw] = useState('');
  const [restoreConfirmed, setRestoreConfirmed] = useState(false);
  const startedAt = useRef(Date.now());
  const operationLock = useRef(false);
  const feedbackHeading = useRef<HTMLHeadingElement>(null);
  const current = session?.items[session.index];
  const complete = !!session && session.index >= session.items.length;

  useEffect(() => {
    let active = true;
    Promise.all([loadSets(), loadRecords()]).then(([nextSets, nextRecords]) => {
      if (active) {setSets(nextSets); setRecords(nextRecords); setLoaded(true);}
    }).catch(error => {if (active) setError(`저장된 자료를 읽지 못했습니다: ${messageOf(error)}`);});
    return () => {active = false;};
  }, []);
  useEffect(() => {if (feedback) feedbackHeading.current?.focus();}, [feedback]);

  async function run(action: () => Promise<void>) {
    if (operationLock.current) return;
    operationLock.current = true;
    setBusy(true); setError(''); setNotice('');
    try {await action();} catch (error) {setError(messageOf(error));}
    finally {operationLock.current = false; setBusy(false);}
  }
  function changeTab(next: typeof tab) {setTab(next); setError(''); setNotice('');}
  function begin(items: Pair[], mode: Session['mode'], sessionTitle: string) {
    if (!items.length) {setNotice('복습할 문항이 없습니다. 문제 세트를 먼저 학습해 주세요.'); return;}
    setSession({items, index: 0, mode, results: [], title: sessionTitle});
    setAnswer(''); setFeedback(null); setError(''); setNotice(''); startedAt.current = Date.now();
  }
  function wrongItems(): Pair[] {
    return sets.flatMap(set => set.questions.flatMap(question => {
      const latest = records.filter(record => record.setId === set.id && record.setVersion === set.version && record.questionId === question.id).sort((a, b) => b.timestamp - a.timestamp)[0];
      return latest && !latest.correct ? [{set, question}] : [];
    }));
  }
  async function submitAnswer() {
    if (!current || !session || feedback) return;
    if (answer === '' || (typeof answer === 'string' && !answer.trim())) {setError('답을 선택하거나 입력해 주세요.'); return;}
    const result: LearningRecord = {id: uid(), setId: current.set.id, setVersion: current.set.version, questionId: current.question.id, answer, correct: grade(current.question, answer), durationMs: Math.max(0, Date.now() - startedAt.current), timestamp: Date.now(), mode: session.mode};
    await run(async () => {
      await saveRecord(result);
      setRecords(previous => [...previous, result]);
      setSession(previous => previous ? {...previous, results: [...previous.results, result]} : previous);
      setFeedback(result);
    });
  }
  function nextQuestion() {
    const nextIndex = (session?.index ?? 0) + 1;
    setSession(previous => previous ? {...previous, index: nextIndex} : previous);
    setAnswer(''); setFeedback(null); setError(''); startedAt.current = Date.now();
  }
  function parseImport() {
    setError(''); setNotice(''); setImported(null); setConfirmed([]);
    try {const result = importSet(JSON.parse(raw)); setImported(result); if (!result.set) setError('저장할 수 있는 문제 세트가 없습니다. 검토 내용을 확인해 주세요.');}
    catch (error) {setError(`JSON을 읽지 못했습니다: ${messageOf(error)}`);}
  }
  async function readFile(file: File|undefined, target: 'import'|'restore') {
    if (!file) return;
    await run(async () => {
      if (file.size > 4 * 1024 * 1024) throw new Error('4MB 이하의 JSON 파일을 선택해 주세요.');
      const text = await file.text();
      if (target === 'import') {setRaw(text); setImported(null); setConfirmed([]); setNotice('파일을 읽었습니다. 문항 검토를 실행해 주세요.');}
      else {setRestoreRaw(text); setRestoreConfirmed(false); setNotice('백업 파일을 읽었습니다. 복원 확인 후 실행해 주세요.');}
    });
  }
  async function saveImported() {
    const set = imported?.set;
    if (!set) return;
    const selected = set.questions.filter(question => confirmed.includes(question.id));
    if (!selected.length) {setError('검토를 마친 문항에 확인 표시를 해 주세요.'); return;}
    await run(async () => {
      const saved: QuestionSet = {...set, id: uid(), version: 1, questions: selected};
      await saveSet(saved); setSets(previous => [...previous, saved]); setImported(null); setConfirmed([]); setRaw(''); setTab('library'); setNotice(`${selected.length}개 문항을 새 세트로 저장했습니다.`);
    });
  }
  function openEditor(set: QuestionSet|null) {
    setEditing(set); setTitle(set?.title ?? ''); setQuestions(set?.questions ?? []); setDraft(blankDraft()); setDraftError(''); changeTab('editor');
  }
  function editQuestion(question: Question) {
    setDraft({id: question.id, type: question.type, prompt: question.prompt, options: (question.options ?? []).join('\n'), answer: question.type === 'multiple-choice' ? String(Number(question.answer) + 1) : question.type === 'true-false' ? String(question.answer) : (question.answer as string[]).join('\n'), explanation: question.explanation ?? '', tags: question.tags.join(', '), standard: question.standard ?? ''});
    setDraftError('');
  }
  function addQuestion() {
    const question: Question = {id: draft.id, type: draft.type, prompt: draft.prompt.trim(), tags: draft.tags.split(',').map(tag => tag.trim()).filter(Boolean), ...(draft.explanation.trim() ? {explanation: draft.explanation.trim()} : {}), ...(draft.standard.trim() ? {standard: draft.standard.trim()} : {}), answer: draft.type === 'multiple-choice' ? Number(draft.answer) - 1 : draft.type === 'true-false' ? draft.answer === 'true' : draft.answer.split('\n').map(value => value.trim()).filter(Boolean)};
    if (draft.type === 'multiple-choice') question.options = draft.options.split('\n').map(option => option.trim()).filter(Boolean);
    const parsed = importSet({schemaVersion: '1.0', id: 'editor-check', version: 1, title: '문항 검토', questions: [question]});
    if (!parsed.set?.questions.length || parsed.issues.length) {setDraftError(parsed.issues.map(issue => issue.message).join(' / ') || '문항과 정답을 확인해 주세요.'); return;}
    setQuestions(previous => previous.some(item => item.id === question.id) ? previous.map(item => item.id === question.id ? question : item) : [...previous, question]);
    setDraft(blankDraft()); setDraftError(''); setNotice('문항을 편집 목록에 반영했습니다. 세트 저장을 눌러야 기기에 저장됩니다.');
  }
  async function saveEditor() {
    if (!title.trim() || !questions.length) {setError('세트 제목과 한 개 이상의 문항이 필요합니다.'); return;}
    await run(async () => {
      const set: QuestionSet = {schemaVersion: '1.0', id: editing?.id ?? uid(), version: (editing?.version ?? 0) + 1, title: title.trim(), questions};
      await saveSet(set); setSets(previous => [...previous.filter(item => item.id !== set.id), set]); setEditing(null); setQuestions([]); setTitle(''); setTab('library'); setNotice(`세트를 저장했습니다. 버전 ${set.version}의 학습 기록을 새로 쌓습니다.`);
    });
  }
  const correctCount = records.filter(record => record.correct).length;
  const reviewCount = selectReview(sets, records, 20).length;
  const wrongCount = wrongItems().length;
  const draftIsEditing = questions.some(question => question.id === draft.id);

  return <section className="personal-learning" aria-label="개인 학습">
    <div className="pl-intro"><div><span className="pl-kicker">기말고사 · 개인 학습</span><h1>한 문항씩, 나의 속도로</h1><p>내 문제 세트로 공부하고 오답을 다시 풀어 보세요.</p></div><span className="pl-badge">이 기기에만 저장</span></div>
    <p className="pl-local-note">로그인 없이 이 기기에 저장됩니다. 공용 PC에서는 사용 후 백업·설정에서 기록을 삭제해 주세요.</p>
    {error && <p className="pl-alert pl-error" role="alert">{error}</p>}
    {notice && <p className="pl-alert pl-success" role="status">{notice}</p>}
    {!loaded && !error && <p role="status">저장된 자료를 불러오는 중입니다…</p>}
    {!loaded && error && <button disabled={busy} onClick={() => run(async () => {const [nextSets, nextRecords] = await Promise.all([loadSets(), loadRecords()]); setSets(nextSets); setRecords(nextRecords); setLoaded(true);})}>저장소 다시 불러오기</button>}
    {session ? <div className="pl-session">
      <div className="pl-session-top"><span>{session.title}</span><button onClick={() => {setSession(null); setFeedback(null); setNotice('저장된 풀이 기록은 학습 이력에서 확인할 수 있습니다.');}} disabled={busy}>학습 나가기</button></div>
      {complete ? <div className="pl-card pl-completion"><span className="pl-kicker">오늘도 한 걸음</span><h2>학습을 완료했어요</h2><p>{session.results.length}문항 중 {session.results.filter(record => record.correct).length}문항 정답 · {Math.round(session.results.reduce((sum, record) => sum + record.durationMs, 0) / 1000)}초 학습</p>
        <label className="pl-field">완료 카드에 표시할 이름 (선택)<input value={name} maxLength={30} onChange={event => setName(event.target.value)} placeholder="직접 입력 · 이름 없이도 가능" autoComplete="off"/></label>
        <div className="pl-actions"><button className="primary" disabled={busy} onClick={() => run(async () => {const standards = [...new Set(session.items.map(item => item.question.standard).filter((value): value is string => !!value))]; const blob = await completionCard(name.trim(), session.title, session.results, standards); downloadBlob(blob, '학습-완료-카드.png'); setNotice('완료 카드를 내려받았습니다. 웨일 클래스의 과제에 파일을 직접 첨부해 주세요.');})}>완료 카드 PNG 내려받기</button>
        <button disabled={busy || !session.results.some(record => !record.correct)} onClick={() => begin(session.items.filter(item => session.results.some(record => record.setId === item.set.id && record.questionId === item.question.id && !record.correct)), 'review', '이번 학습 오답 다시 풀기')}>이번 오답 다시 풀기</button><button onClick={() => setSession(null)}>내 문제 세트로</button></div><p className="pl-help">카드는 이 기기의 풀이 결과입니다. 클래스 제출과 교사 확인은 직접 진행해 주세요.</p>
      </div> : current && <div className="pl-card pl-question-card">
        <div className="pl-meta"><span>{session.index + 1} / {session.items.length}</span><span>{typeLabels[current.question.type]} · {session.mode === 'focus' ? '집중 학습' : '복습'}</span></div><progress value={session.index} max={session.items.length} aria-label="학습 진행률"/>
        <p className="pl-help">{current.set.title} · 버전 {current.set.version}{current.question.standard ? ` · ${current.question.standard}` : ''}</p>
        <h2>{current.question.prompt}</h2>
        <form onSubmit={event => {event.preventDefault(); void submitAnswer();}}><fieldset disabled={busy || !!feedback}><legend className="pl-sr-only">답 선택 또는 입력</legend>
          {current.question.type === 'multiple-choice' && <div className="pl-answer-options">{current.question.options?.map((option, index) => <label className={answer === index ? 'pl-answer selected' : 'pl-answer'} key={index}><input type="radio" name="answer" checked={answer === index} onChange={() => setAnswer(index)}/><span>{index + 1}. {option}</span></label>)}</div>}
          {current.question.type === 'true-false' && <div className="pl-answer-options pl-two">{[true, false].map(value => <label className={answer === value ? 'pl-answer selected' : 'pl-answer'} key={String(value)}><input type="radio" name="answer" checked={answer === value} onChange={() => setAnswer(value)}/><span>{value ? '참 (O)' : '거짓 (X)'}</span></label>)}</div>}
          {current.question.type === 'short-answer' && <label className="pl-field">나의 답<input autoComplete="off" value={String(answer)} onChange={event => setAnswer(event.target.value)} maxLength={1000} placeholder="정답을 입력해 주세요"/></label>}
        </fieldset>{!feedback && <button className="primary pl-submit" disabled={busy} type="submit">{busy ? '기록 저장 중…' : '답 확인하기'}</button>}</form>
        {feedback && <div className={`pl-feedback ${feedback.correct ? 'pl-success' : 'pl-error'}`}><h3 ref={feedbackHeading} tabIndex={-1}>{feedback.correct ? '정답이에요!' : '다시 익혀 볼까요?'}</h3>{!feedback.correct && <p>정답: {current.question.type === 'multiple-choice' ? current.question.options?.[current.question.answer as number] : current.question.type === 'true-false' ? current.question.answer ? '참' : '거짓' : (current.question.answer as string[]).join(' / ')}</p>}{current.question.explanation && <p>{current.question.explanation}</p>}<button className="primary" onClick={nextQuestion}>{session.index + 1 === session.items.length ? '학습 결과 보기' : '다음 문항'}</button></div>}
      </div>}
    </div> : <>
      <nav className="pl-tabs" aria-label="개인 학습 메뉴">{([['library', '내 문제 세트'], ['import', '문제 가져오기'], ['editor', '직접 만들기'], ['history', '학습 이력'], ['data', '백업·설정']] as const).map(([value, label]) => <button key={value} aria-current={tab === value ? 'page' : undefined} onClick={() => value === 'editor' && tab !== 'editor' ? openEditor(null) : changeTab(value)} disabled={busy}>{label}</button>)}</nav>
      {tab === 'library' && <><div className="pl-review-banner"><div><h2>오늘의 복습</h2><p>미학습 문항과 최근 풀이를 기준으로 최대 20문항을 고릅니다.</p></div><div className="pl-actions"><button className="primary" disabled={!loaded || busy || !reviewCount} onClick={() => begin(selectReview(sets, records, 20), 'review', '오늘의 복습 20')}>오늘의 복습 ({reviewCount})</button><button disabled={busy || !wrongCount} onClick={() => begin(wrongItems(), 'review', '오답 복습')}>오답 다시 풀기 ({wrongCount})</button></div></div>
        <div className="pl-section-title"><h2>내 문제 세트 <span>{sets.length}</span></h2><button onClick={() => openEditor(null)} disabled={busy}>+ 새 세트 만들기</button></div>
        {!sets.length && loaded && <div className="pl-card pl-empty"><h3>첫 문제 세트를 준비해 보세요</h3><p>예제는 연습용입니다. 학교의 실제 시험 범위와 정답은 직접 확인해 주세요.</p><div className="pl-actions"><button className="primary" disabled={busy} onClick={() => run(async () => {const next = exampleSets.map(set => ({...set, id: uid(), version: 1})); for (const set of next) await saveSet(set); setSets(await loadSets()); setNotice('예제 문제 세트를 추가했습니다.');})}>예제 세트로 시작하기</button><button onClick={() => changeTab('import')}>JSON 문제 가져오기</button></div></div>}
        <div className="pl-set-grid">{sets.map(set => <article className="pl-card" key={set.id}><div className="pl-meta"><span>버전 {set.version}</span><span>{set.questions.length}문항</span></div><h3>{set.title}</h3><p className="pl-help">{[...new Set(set.questions.flatMap(question => question.tags))].slice(0, 5).join(' · ') || '태그 없음'}</p><div className="pl-actions"><button className="primary" disabled={busy} onClick={() => begin(set.questions.map(question => ({set, question})), 'focus', set.title)}>집중 학습</button><button onClick={() => openEditor(set)} disabled={busy}>편집</button><button disabled={busy} onClick={() => downloadText(JSON.stringify(set, null, 2), '문제-세트.json')}>JSON 내보내기</button><LocalShareButton set={set}/><button onClick={() => {setDeleteTarget(set); setDeleteText('');}} disabled={busy}>삭제</button></div></article>)}</div>
        {deleteTarget && <div className="pl-card pl-danger" role="region" aria-label="세트 삭제 확인"><h3>세트 삭제 확인</h3><p>「{deleteTarget.title}」과 이 세트의 모든 풀이 기록을 삭제합니다.</p><label className="pl-field">확인하려면 세트 제목을 그대로 입력하세요<input value={deleteText} onChange={event => setDeleteText(event.target.value)}/></label><div className="pl-actions"><button disabled={busy || deleteText !== deleteTarget.title} onClick={() => run(async () => {await deleteSet(deleteTarget.id); setSets(previous => previous.filter(set => set.id !== deleteTarget.id)); setRecords(previous => previous.filter(record => record.setId !== deleteTarget.id)); setDeleteTarget(null); setNotice('세트와 이 세트의 풀이 기록을 삭제했습니다.');})}>세트 삭제 실행</button><button onClick={() => setDeleteTarget(null)} disabled={busy}>취소</button></div></div>}
      </>}
      {tab === 'import' && <div className="pl-card"><h2>검토한 문항만 가져오기</h2><p>JSON 파일을 올리거나 내용을 붙여 넣어 주세요. 문제가 있는 문항은 제외하며, 정답을 직접 확인한 문항만 저장합니다.</p><label className="pl-field">문제 세트 JSON 파일<input type="file" accept=".json,application/json" onChange={event => {void readFile(event.target.files?.[0], 'import'); event.target.value = '';}} disabled={busy}/></label><label className="pl-field">JSON 내용<textarea rows={10} value={raw} onChange={event => {setRaw(event.target.value); setImported(null); setConfirmed([]);}} placeholder='{"schemaVersion":"1.0", ...}'/></label><div className="pl-actions"><button className="primary" disabled={busy || !raw.trim()} onClick={parseImport}>문항 검토</button><button disabled={busy} onClick={() => run(async () => {const prompt = questionPrompt; if (!navigator.clipboard?.writeText) throw new Error('현재 환경에서 클립보드를 사용할 수 없습니다. 아래 프롬프트를 직접 선택해 복사해 주세요.'); await navigator.clipboard.writeText(typeof prompt === 'string' ? prompt : String(prompt)); setNotice('문제 생성 요청 프롬프트를 복사했습니다. 외부 도구에 직접 붙여 넣고 결과를 검토해 주세요.');})}>문제 생성 요청 프롬프트 복사</button></div><details className="pl-details"><summary>문제 생성 요청 프롬프트와 JSON 형식 보기</summary><pre>{typeof questionPrompt === 'string' ? questionPrompt : String(questionPrompt)}</pre><pre>{JSON.stringify(exampleSets[0], null, 2)}</pre><p className="pl-help">앱은 AI API를 호출하지 않습니다. 외부 도구가 만든 내용도 정답·시험 범위를 직접 확인해 주세요.</p></details>
        {imported && <div className="pl-import-review"><h3>검토 결과</h3>{imported.issues.length > 0 && <ul className="pl-issues">{imported.issues.map((issue, index) => <li key={index}>{issue.index >= 0 ? `원본 ${issue.index + 1}번 문항: ` : ''}{issue.message}</li>)}</ul>}{imported.set && <><p>{imported.set.title} · 저장 가능한 문항 {imported.set.questions.length}개</p>{imported.set.questions.map((question, index) => <article className="pl-review-question" key={question.id}><h4>{index + 1}. {question.prompt}</h4>{question.options && <ol>{question.options.map((option, number) => <li key={number}>{option}</li>)}</ol>}<p>정답: {question.type === 'multiple-choice' ? question.options?.[question.answer as number] : question.type === 'true-false' ? question.answer ? '참' : '거짓' : (question.answer as string[]).join(' / ')}</p>{question.explanation && <p>해설: {question.explanation}</p>}<label className="pl-check"><input type="checkbox" checked={confirmed.includes(question.id)} onChange={event => setConfirmed(previous => event.target.checked ? [...previous, question.id] : previous.filter(id => id !== question.id))}/>문항과 정답을 직접 확인했습니다</label></article>)}<button className="primary" disabled={busy || !confirmed.length} onClick={() => void saveImported()}>확인한 {confirmed.length}개 문항 저장</button></>}</div>}
      </div>}
      {tab === 'editor' && <div className="pl-editor-grid"><div className="pl-card"><h2>{editing ? '문제 세트 편집' : '문제 세트 직접 만들기'}</h2>{editing && <p className="pl-help">저장하면 버전 {editing.version + 1}이 됩니다. 이전 버전의 풀이 기록은 보관됩니다.</p>}<label className="pl-field">세트 제목<input value={title} maxLength={120} onChange={event => setTitle(event.target.value)} placeholder="예: 2학기 과학 기말 범위"/></label><h3>세트에 담긴 문항 ({questions.length})</h3>{!questions.length && <p className="pl-help">아래 문항 작성에서 문항을 추가해 주세요.</p>}<ol className="pl-editor-list">{questions.map(question => <li key={question.id}><strong>{question.prompt}</strong><div className="pl-actions"><button onClick={() => editQuestion(question)}>문항 편집</button><button onClick={() => setQuestions(previous => previous.filter(item => item.id !== question.id))}>문항 제거</button></div></li>)}</ol><button className="primary" disabled={busy || !questions.length || !title.trim()} onClick={() => void saveEditor()}>세트 저장</button><p className="pl-help">작성 중인 문항은 ‘문항 추가·수정 반영’을 눌러 목록에 담은 뒤 저장해 주세요.</p></div>
        <form className="pl-card" onSubmit={event => {event.preventDefault(); addQuestion();}}><h2>{draftIsEditing ? '문항 수정' : '문항 작성'}</h2><label className="pl-field">문항 유형<select value={draft.type} onChange={event => {const type = event.target.value as QuestionType; setDraft(previous => ({...previous, type, answer: type === 'multiple-choice' ? '1' : type === 'true-false' ? 'true' : ''}));}}>{Object.entries(typeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><label className="pl-field">문제<textarea required value={draft.prompt} maxLength={4000} rows={3} onChange={event => setDraft(previous => ({...previous, prompt: event.target.value}))}/></label>{draft.type === 'multiple-choice' && <><label className="pl-field">선택지 (한 줄에 하나 · 최소 2개)<textarea value={draft.options} rows={4} onChange={event => setDraft(previous => ({...previous, options: event.target.value}))}/></label><label className="pl-field">정답 선택지 번호 (1부터)<input type="number" min={1} value={draft.answer} onChange={event => setDraft(previous => ({...previous, answer: event.target.value}))}/></label></>}{draft.type === 'true-false' && <label className="pl-field">정답<select value={draft.answer} onChange={event => setDraft(previous => ({...previous, answer: event.target.value}))}><option value="true">참 (O)</option><option value="false">거짓 (X)</option></select></label>}{draft.type === 'short-answer' && <label className="pl-field">허용할 정답 (한 줄에 하나)<textarea value={draft.answer} rows={3} onChange={event => setDraft(previous => ({...previous, answer: event.target.value}))}/></label>}<label className="pl-field">해설 (선택)<textarea value={draft.explanation} rows={2} onChange={event => setDraft(previous => ({...previous, explanation: event.target.value}))}/></label><label className="pl-field">태그 (쉼표로 구분)<input value={draft.tags} onChange={event => setDraft(previous => ({...previous, tags: event.target.value}))} placeholder="과학, 전기"/></label><label className="pl-field">성취기준 (선택)<input value={draft.standard} onChange={event => setDraft(previous => ({...previous, standard: event.target.value}))} placeholder="성취기준 코드 또는 내용"/></label>{draftError && <p role="alert" className="pl-alert pl-error">{draftError}</p>}<div className="pl-actions"><button className="primary" type="submit">{draftIsEditing ? '문항 수정 반영' : '문항 추가'}</button><button type="button" onClick={() => {setDraft(blankDraft()); setDraftError('');}}>작성 초기화</button></div></form>
      </div>}
      {tab === 'history' && <><div className="pl-stats"><div><span>누적 풀이</span><strong>{records.length}회</strong></div><div><span>정답률</span><strong>{records.length ? Math.round(correctCount / records.length * 100) : 0}%</strong></div><div><span>현재 세트의 오답</span><strong>{wrongCount}문항</strong></div></div><div className="pl-card"><h2>학습 이력</h2><p className="pl-help">재시도도 개별 기록으로 남습니다. 복습 목록은 현재 버전의 가장 최근 풀이를 기준으로 바뀝니다.</p>{!records.length && <p>아직 풀이 기록이 없습니다.</p>}<ol className="pl-history">{records.slice().sort((a, b) => b.timestamp - a.timestamp).slice(0, 200).map(record => {const set = sets.find(item => item.id === record.setId); const question = set?.questions.find(item => item.id === record.questionId); return <li key={record.id}><span className={record.correct ? 'pl-result correct' : 'pl-result incorrect'}>{record.correct ? '정답' : '오답'}</span><div><strong>{set?.title ?? '삭제된 세트'} · 버전 {record.setVersion}</strong><p>{set?.version === record.setVersion ? question?.prompt ?? '제거된 문항' : '이전 버전 문항'}</p><small>{formatDate(record.timestamp)} · {record.mode === 'focus' ? '집중 학습' : '복습'} · {Math.round(record.durationMs / 1000)}초</small></div></li>;})}</ol>{records.length > 200 && <p className="pl-help">최근 200개를 표시합니다. 전체 기록은 백업 파일에 포함됩니다.</p>}</div></>}
      {tab === 'data' && <div className="pl-data-grid"><div className="pl-card"><h2>학습 자료 백업</h2><p>브라우저 데이터 삭제, 기기 변경 전에 JSON 백업을 내려받으세요. 이름은 완료 카드 생성에만 사용하며 저장하지 않습니다.</p><button className="primary" disabled={busy} onClick={() => run(async () => {downloadText(await exportBackup(), '학습-자료-백업.json'); setNotice('문제 세트와 풀이 기록을 백업 파일로 내려받았습니다.');})}>전체 자료 백업 내려받기</button><h3 className="pl-spaced">백업 복원</h3><label className="pl-field">백업 JSON 파일<input type="file" accept=".json,application/json" disabled={busy} onChange={event => {void readFile(event.target.files?.[0], 'restore'); event.target.value = '';}}/></label><label className="pl-field">백업 JSON 내용<textarea rows={6} value={restoreRaw} onChange={event => {setRestoreRaw(event.target.value); setRestoreConfirmed(false);}}/></label><label className="pl-check"><input type="checkbox" checked={restoreConfirmed} onChange={event => setRestoreConfirmed(event.target.checked)}/>현재 자료가 백업 내용으로 교체될 수 있음을 확인했습니다</label><button disabled={busy || !restoreRaw.trim() || !restoreConfirmed} onClick={() => run(async () => {await restoreBackup(JSON.parse(restoreRaw)); const [nextSets, nextRecords] = await Promise.all([loadSets(), loadRecords()]); setSets(nextSets); setRecords(nextRecords); setRestoreRaw(''); setRestoreConfirmed(false); setNotice('백업을 복원했습니다.');})}>확인한 백업 복원</button></div><div className="pl-card pl-danger"><h2>기기 자료 전체 삭제</h2><p>문제 세트와 모든 풀이 기록을 삭제합니다. 복원하려면 미리 내려받은 백업이 필요합니다.</p><label className="pl-field">삭제하려면 ‘전체 삭제’를 입력하세요<input value={clearText} onChange={event => setClearText(event.target.value)} autoComplete="off"/></label><button disabled={busy || clearText !== '전체 삭제'} onClick={() => run(async () => {await clearData(); setSets([]); setRecords([]); setClearText(''); setEditing(null); setQuestions([]); setImported(null); setDeleteTarget(null); setNotice('이 기기의 문제 세트와 풀이 기록을 삭제했습니다.');})}>기기 자료 전체 삭제 실행</button></div></div>}
    </>}
  </section>;
}
