import type { QuestionSet } from './types';

// These are instructional drafts. Teachers must check suitability and current curriculum wording before use.
export const exampleSets: QuestionSet[] = [
  { schemaVersion: '1.0', id: 'sample-elementary-math', version: 1, title: '🫍 초등 3학년 수학 · 곱셈 (교사 검수용)', questions: [
    { id: 'm1', type: 'multiple-choice', prompt: '한 봉지에 사탕 4개가 있습니다. 3봉지에는 모두 몇 개가 있나요?', options: ['7개', '12개', '16개'], answer: 1, tags: ['초3', '수학', '교사 검수 필요'], standard: '검수용 학습 목표: 같은 수의 묶음을 곱셈으로 나타내기', explanation: '4개씩 3묶음이므로 4 × 3 = 12입니다.' },
    { id: 'm2', type: 'true-false', prompt: '6 × 5와 5 × 6의 값은 같습니다.', answer: true, tags: ['초3', '수학', '교사 검수 필요'], standard: '검수용 학습 목표: 곱셈의 계산 원리 이해하기', explanation: '두 식 모두 30입니다.' },
    { id: 'm3', type: 'short-answer', prompt: '7 × 8의 값을 숫자로 쓰세요.', answer: ['56'], tags: ['초3', '수학', '교사 검수 필요'], standard: '검수용 학습 목표: 곱셈구구 활용하기', explanation: '7을 8번 더하면 56입니다.' },
  ] },
  { schemaVersion: '1.0', id: 'sample-elementary-korean', version: 1, title: '🫍 초등 5학년 국어 · 근거와 주장 (교사 검수용)', questions: [
    { id: 'k1', type: 'multiple-choice', prompt: '“운동장을 깨끗이 사용하자.”라는 주장에 가장 알맞은 근거는 무엇인가요?', options: ['쓰레기가 있으면 다치거나 활동하기 불편하다.', '오늘은 수요일이다.', '우리 학교 이름이 마음에 든다.'], answer: 0, tags: ['초5', '국어', '교사 검수 필요'], standard: '검수용 학습 목표: 주장에 알맞은 근거 찾기', explanation: '운동장의 청결이 필요한 이유를 설명하는 근거입니다.' },
    { id: 'k2', type: 'true-false', prompt: '주장을 뒷받침하는 근거는 주장과 관련이 있어야 합니다.', answer: true, tags: ['초5', '국어', '교사 검수 필요'], standard: '검수용 학습 목표: 주장과 근거의 관계 이해하기', explanation: '관련 있는 이유나 자료가 주장을 뒷받침합니다.' },
    { id: 'k3', type: 'short-answer', prompt: '자신의 의견을 뒷받침하는 이유나 자료를 무엇이라고 하나요? 두 글자로 쓰세요.', answer: ['근거'], tags: ['초5', '국어', '교사 검수 필요'], standard: '검수용 학습 목표: 주장과 근거 구별하기', explanation: '의견을 뒷받침하는 이유나 자료를 근거라고 합니다.' },
  ] },
  { schemaVersion: '1.0', id: 'sample-middle-science', version: 1, title: '🫍 중학교 과학 · 상태 변화 (교사 검수용)', questions: [
    { id: 's1', type: 'multiple-choice', prompt: '얼음이 물로 변하는 상태 변화의 이름은 무엇인가요?', options: ['응고', '융해', '액화'], answer: 1, tags: ['중학교', '과학', '교사 검수 필요'], standard: '검수용 학습 목표: 물질의 상태 변화 설명하기', explanation: '고체가 액체로 변하는 현상을 융해라고 합니다.' },
    { id: 's2', type: 'true-false', prompt: '액체인 물이 수증기로 변하면 물 입자가 사라집니다.', answer: false, tags: ['중학교', '과학', '교사 검수 필요'], standard: '검수용 학습 목표: 상태 변화를 입자 모형으로 설명하기', explanation: '상태가 변해도 물질을 이루는 입자는 사라지지 않습니다.' },
    { id: 's3', type: 'short-answer', prompt: '액체가 고체로 변하는 현상을 무엇이라고 하나요?', answer: ['응고'], tags: ['중학교', '과학', '교사 검수 필요'], standard: '검수용 학습 목표: 물질의 상태 변화 설명하기', explanation: '물이 얼음으로 변하는 것이 응고의 예입니다.' },
  ] },
  { schemaVersion: '1.0', id: 'sample-high-social', version: 1, title: '🫍 고등학교 통합사회 · 민주적 의사 결정 (교사 검수용)', questions: [
    { id: 'h1', type: 'multiple-choice', prompt: '학급 규칙을 민주적으로 정하는 과정에 가장 알맞은 행동은 무엇인가요?', options: ['반장이 혼자 결정한다.', '다양한 의견을 듣고 근거를 토론한다.', '다른 의견을 말하지 못하게 한다.'], answer: 1, tags: ['고등학교', '통합사회', '교사 검수 필요'], standard: '검수용 학습 목표: 민주적 의사 결정과 시민 참여 이해하기', explanation: '참여와 토론을 통해 서로 다른 의견을 검토할 수 있습니다.' },
    { id: 'h2', type: 'true-false', prompt: '다수의 의견으로 결정하더라도 소수의 기본적 권리를 존중해야 합니다.', answer: true, tags: ['고등학교', '통합사회', '교사 검수 필요'], standard: '검수용 학습 목표: 민주주의와 기본권의 관계 이해하기', explanation: '다수결은 기본권을 침해해도 된다는 뜻이 아닙니다.' },
    { id: 'h3', type: 'short-answer', prompt: '여러 사람이 공통의 문제에 대해 의견을 나누고 근거를 검토하는 활동을 무엇이라고 하나요?', answer: ['토론'], tags: ['고등학교', '통합사회', '교사 검수 필요'], standard: '검수용 학습 목표: 토론을 통한 공동 문제 해결하기', explanation: '토론은 공동 문제를 해결하기 위해 의견과 근거를 검토하는 활동입니다.' },
  ] },
];
