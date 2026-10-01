import type { Answer, LearningRecord, QuestionSet } from './types';

export const questionPrompt = `교사용 문제 초안을 아래 QuestionSet JSON 형식으로만 작성해 주세요. 학생 이름·학번·연락처·개별 응답 등 학생 식별정보는 입력하거나 포함하지 마세요.\n학년: [입력] / 교과: [입력] / 학습 목표: [입력] / 성취기준: [교사가 확인한 문구 입력]\n형식: {"schemaVersion":"1.0","id":"unique-id","version":1,"title":"제목","questions":[{"id":"q1","type":"multiple-choice","prompt":"발문","options":["선택지1","선택지2"],"answer":0,"explanation":"해설","tags":["교사 검수 필요"],"standard":"교사가 확인한 성취기준"}]}\nmultiple-choice 정답은 0부터 시작하는 선택지 번호, true-false 정답은 true/false, short-answer 정답은 허용 답안 문자열 배열입니다. 문제별 id는 고유해야 합니다. 출처와 성취기준을 지어내지 마세요. 교사는 생성 결과의 사실성·정답·교육과정 적합성·차별 표현을 확인한 뒤 가져옵니다. 이 앱은 외부 AI에 자동 전송하지 않습니다.`;

export function classAnnouncement(title: string, joinUrl: string, code: string): string {
  return `[Whale Quest 수업 안내]\n${title}\n참여 주소: ${joinUrl}\n참여 코드: ${code}\n교사의 안내에 따라 참여하세요. 이름 대신 정해진 별칭을 사용하세요.\n외부 활동을 연 뒤 수업 화면으로 돌아와 주세요.`;
}
export function teamboardCards(set: QuestionSet, submissions: Array<{ questionId: string; answer: Answer; correct: boolean }>): string {
  const cards = set.questions.map(question => {
    const answers = submissions.filter(submission => submission.questionId === question.id);
    return { question, answers, wrong: answers.filter(answer => !answer.correct).length };
  }).filter(card => card.wrong > 0).sort((a, b) => b.wrong - a.wrong).slice(0, 3);
  const content = cards.map(({ question, answers, wrong }, index) => {
    const distribution = question.type === 'multiple-choice' ? question.options?.map((option, optionIndex) => `${optionIndex + 1}. ${option}: ${answers.filter(answer => answer.answer === optionIndex).length}회`).join('\n') : question.type === 'true-false' ? `O: ${answers.filter(answer => answer.answer === true).length}회 / X: ${answers.filter(answer => answer.answer === false).length}회` : '단답 응답 내용은 공유 문안에 포함하지 않습니다.';
    return `카드 ${index + 1} · 오답 ${wrong}회 / 응답 ${answers.length}회\n${question.prompt}\n선택 분포\n${distribution}\n성찰 질문: 이 선택을 한 이유는 무엇인가요? 다시 설명해 봅시다.\n${question.explanation ? `교사 확인용 해설: ${question.explanation}\n` : ''}${question.standard ? `학습 목표/성취기준: ${question.standard}` : ''}`;
  });
  return `[${set.title} · 팀보드 오답 성찰]\n집계만 포함하며 학생 이름과 개별 응답은 포함하지 않습니다.\n\n${content.join('\n\n') || '오답 기록이 없습니다.'}`;
}
export async function completionCard(name: string, setTitle: string, records: LearningRecord[], standards: string[]): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 1200; canvas.height = 800;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('완료 카드 이미지를 만들 수 없습니다.');
  context.fillStyle = '#082435'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#6de0de'; context.font = 'bold 40px sans-serif'; context.fillText('Whale Quest · 학습 완료', 80, 100);
  const line = (value: string, y: number, size = 28) => { context.fillStyle = '#ffffff'; context.font = `${size}px sans-serif`; const chars = Array.from(value); while (chars.length && context.measureText(chars.join('')).width > 1040) chars.pop(); context.fillText(chars.join('') + (chars.length < Array.from(value).length ? '…' : ''), 80, y); };
  line(name.trim() || '학습자', 170, 36); line(setTitle, 230, 32);
  const correct = records.filter(record => record.correct).length;
  const reviews = new Map<string, LearningRecord>();
  records.filter(record => record.mode === 'review').forEach(record => { const key = JSON.stringify([record.setId, record.setVersion, record.questionId]); if ((reviews.get(key)?.timestamp ?? -1) < record.timestamp) reviews.set(key, record); });
  line(`응답 ${records.length}회 · 정답 ${correct}회 · 정답률 ${records.length ? Math.round(correct / records.length * 100) : 0}%`, 305);
  line(`복습 완료 ${[...reviews.values()].filter(record => record.correct).length}문항 · 학습 시간 ${Math.round(records.reduce((sum, record) => sum + record.durationMs, 0) / 1000)}초`, 355);
  line('돌아본 학습 목표 / 성취기준', 430);
  [...new Set(standards)].slice(0, 4).forEach((standard, index) => line(standard, 480 + index * 48, 24));
  line(`${new Date().toLocaleDateString('ko-KR')} · 이 기기에 저장된 개인 학습 기록`, 740, 22);
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('완료 카드 PNG 생성에 실패했습니다.')), 'image/png'));
}
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function downloadText(text: string, filename: string): void { downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), filename); }
