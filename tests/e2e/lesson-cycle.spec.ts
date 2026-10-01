import {test,expect} from '@playwright/test';
test('three student tabs, understanding, assessment, raid, automatic handoff and personal wrong review',async({page,context})=>{const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/#teacher');await page.getByRole('button',{name:'수업방 만들기',exact:true}).click();const code=(await page.getByTestId('room-code').textContent())!;const students=await Promise.all([1,2,3].map(async i=>{const student=await context.newPage();await student.goto('/#join/'+code);await student.getByLabel('번호 또는 별명').fill('체험번호'+i);await student.getByRole('button',{name:'참여하기',exact:true}).click();return student;}));await expect(page.getByText('참여 3/50명')).toBeVisible();await page.getByText('현재 활동 운영',{exact:true}).click();await page.getByRole('button',{name:'이해도 체크 시작',exact:true}).click();await Promise.all(students.map(s=>s.getByRole('button',{name:'잘 이해했어요',exact:true}).click()));await expect(page.getByText('참여 3/50명 · 응답 3/3명')).toBeVisible();await page.getByRole('button',{name:'활동 종료',exact:true}).click();await page.getByRole('button',{name:'형성평가 시작',exact:true}).click();await Promise.all(students.map(s=>s.getByRole('button',{name:'7개',exact:true}).click()));await page.getByRole('button',{name:'활동 종료',exact:true}).click();await page.getByRole('button',{name:'레이드 시작',exact:true}).click();await Promise.all(students.map(s=>s.getByRole('button',{name:'7개',exact:true}).click()));await page.getByRole('button',{name:'활동 종료',exact:true}).click();await page.getByRole('button',{name:'팀보드',exact:true}).click();await page.getByText('전달물 보관함 · 팀보드',{exact:true}).click();await expect(page.getByLabel('레이드 오답 성찰 내용')).toContainText('사탕');const image=page.waitForEvent('download');await page.getByRole('button',{name:'카드 이미지 저장',exact:true}).click();expect((await image).suggestedFilename()).toBe('팀보드-카드.png');await page.getByRole('button',{name:'클래스',exact:true}).click();await page.getByText('클래스 전달물',{exact:true}).click();await page.getByRole('button',{name:'오답 복습 세트 준비',exact:true}).click();await expect(page.getByRole('heading',{name:'다음 차시 추천 · 오답 기반'})).toBeVisible();await students[0].getByRole('button',{name:'내 수업 오답 복습 준비',exact:true}).click();await students[0].getByRole('button',{name:/^오늘의 복습 \(/}).click();await expect(students[0].getByRole('heading',{name:/사탕/})).toBeVisible();await students[0].getByLabel('2. 12개',{exact:true}).check();await students[0].getByRole('button',{name:'답 확인하기',exact:true}).click();await expect(students[0].getByRole('heading',{name:/정답/})).toBeVisible();expect(errors).toEqual([]);});
test('personal history survives reload and PNG completion is downloadable',async({page})=>{await page.goto('/#learn');const card=page.locator('.pl-set-grid article').first();await card.getByRole('button',{name:'집중 학습',exact:true}).click();await page.getByLabel('1. 7개',{exact:true}).check();await page.getByRole('button',{name:'답 확인하기',exact:true}).click();await page.getByRole('button',{name:'다음 문항',exact:true}).click();await page.getByLabel('참 (O)',{exact:true}).check();await page.getByRole('button',{name:'답 확인하기',exact:true}).click();await page.getByRole('button',{name:'다음 문항',exact:true}).click();await page.getByLabel('나의 답',{exact:true}).fill('56');await page.getByRole('button',{name:'답 확인하기',exact:true}).click();await page.getByRole('button',{name:'학습 결과 보기',exact:true}).click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'완료 카드 PNG 내려받기',exact:true}).click();expect((await download).suggestedFilename()).toMatch(/\.png$/);await page.reload();await page.getByRole('button',{name:'학습 이력',exact:true}).click();await expect(page.getByText('3회',{exact:true})).toBeVisible();await page.getByRole('button',{name:'내 문제 세트',exact:true}).click();await page.getByRole('button',{name:/^오답 다시 풀기 \(/}).click();await expect(page.getByRole('heading',{name:/사탕/})).toBeVisible();});
test('teacher layouts and manual UBT lock',async({page})=>{for(const width of [360,390,590]){await page.setViewportSize({width,height:900});await page.goto('/#teacher');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}await page.getByRole('button',{name:'UBT 일시 정지',exact:true}).click();await expect(page.getByRole('button',{name:'수업방 만들기',exact:true})).toBeDisabled();});

test('reviewed readonly share imports a local copy',async({page,context})=>{await page.goto('/#learn');const card=page.locator('.pl-set-grid article').first();await card.getByRole('button',{name:'공유 링크·QR 만들기',exact:true}).click();const url=await page.getByLabel('문제 공유 주소',{exact:true}).inputValue();const shared=await context.newPage();await shared.goto(url);await expect(shared.getByRole('button',{name:'내 문제 세트로 가져오기',exact:true})).toBeDisabled();await shared.getByRole('checkbox').check();await shared.getByRole('button',{name:'내 문제 세트로 가져오기',exact:true}).click();await expect(shared.getByRole('heading',{name:/내 문제 세트/})).toBeVisible();expect(await shared.locator('.pl-set-grid article').count()).toBe(5);});
test('embedded UBT pause blocks navigation to student and booth routes',async({page})=>{await page.goto('/#home');await page.evaluate(()=>{const frame=document.createElement('iframe');frame.src=location.origin+'/?sidebar=1#context';frame.title='pause test';document.body.append(frame);});const frame=page.frameLocator('iframe[title="pause test"]');await expect(frame.getByRole('heading',{name:'수업 순환을 이어가세요',exact:true})).toBeVisible();await page.evaluate(()=>{document.querySelector('iframe')!.contentWindow!.postMessage({type:'WQ_MODE',mode:'paused'},location.origin);});await expect(frame.getByRole('alert')).toContainText('모든 학생 대상 기능');await page.evaluate(()=>{document.querySelector('iframe')!.contentWindow!.location.hash='booth';});await expect(frame.getByRole('button',{name:'부스 시작',exact:true})).toHaveCount(0);});

test('changing to a different room with the same version refreshes the board',async({page})=>{
  await page.goto('/#teacher');
  await page.getByRole('button',{name:'수업방 만들기',exact:true}).click();
  const code=(await page.getByTestId('room-code').textContent())!;
  const nextCode=code==='999999'?'999998':'999999';
  await page.evaluate(({code,nextCode})=>{
    const room=JSON.parse(localStorage.getItem('wq.demo.room.'+code)!);
    room.code=nextCode;
    room.participants=[{id:'another-student',nickname:'체험',joinedAt:Date.now(),help:false}];
    localStorage.setItem('wq.demo.room.'+nextCode,JSON.stringify(room));
  },{code,nextCode});
  await page.goto('/#board/'+code);
  await expect(page.getByText('참여 0명 · 응답 0명',{exact:true})).toBeVisible();
  await page.evaluate(nextCode=>{location.hash='board/'+nextCode;},nextCode);
  await expect(page.getByText('참여 1명 · 응답 0명',{exact:true})).toBeVisible();
});

test('changing a confirmed shared token clears the previous set and consent',async({page})=>{
  await page.goto('/#learn');
  await page.locator('.pl-set-grid article').first().getByRole('button',{name:'공유 링크·QR 만들기',exact:true}).click();
  const url=await page.getByLabel('문제 공유 주소',{exact:true}).inputValue();
  await page.goto(url);
  await page.getByRole('checkbox').check();
  await expect(page.getByRole('button',{name:'내 문제 세트로 가져오기',exact:true})).toBeEnabled();
  await page.evaluate(()=>{location.hash='shared/missing-token';});
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button',{name:'내 문제 세트로 가져오기',exact:true})).toHaveCount(0);
  await page.evaluate(url=>{location.hash=new URL(url).hash;},url);
  await expect(page.getByRole('button',{name:'내 문제 세트로 가져오기',exact:true})).toBeDisabled();
});

test('booth restarts 30 seconds after completion even when the original timer expires',async({page})=>{
  await page.clock.install();
  await page.goto('/#booth');
  await page.getByRole('button',{name:'부스 시작',exact:true}).click();
  await expect(page.getByText('회차 1 · 레이드 종료 후 오답 카드 → 30초 뒤 새 방',{exact:true})).toBeVisible();
  await page.evaluate(()=>{
    const key=Object.keys(localStorage).find(k=>k.startsWith('wq.demo.room.'))!;
    const room=JSON.parse(localStorage.getItem(key)!);
    room.current.hp=0;
    room.current.endsAt=Date.now()+10000;
    room.version++;
    localStorage.setItem(key,JSON.stringify(room));
  });
  await page.clock.runFor(1000);
  await expect(page.getByRole('heading',{name:'팀보드로 이어지는 오답 카드',exact:true})).toBeVisible();
  await page.clock.runFor(10000);
  await page.clock.runFor(20500);
  await expect(page.getByText('회차 2 · 레이드 종료 후 오답 카드 → 30초 뒤 새 방',{exact:true})).toBeVisible();
});
