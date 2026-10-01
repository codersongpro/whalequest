import {chromium,expect} from '@playwright/test';
import {mkdir,readFile,writeFile,mkdtemp} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=process.cwd();
const executablePath=process.env.WHALE_EXECUTABLE||'C:\\Program Files\\Naver\\Naver Whale\\Application\\whale.exe';
const extensionPath=path.join(root,'dist','extension');
await mkdir(path.join(root,'.work'),{recursive:true});
const profile=await mkdtemp(path.join(root,'.work','whale-profile-'));
const manifest=JSON.parse(await readFile(path.join(extensionPath,'manifest.json'),'utf8'));
assert.equal(manifest.manifest_version,3);assert.equal(manifest.sidebar_action.default_page,'sidebar.html');assert.equal(manifest.action,undefined);
const browser=await chromium.launchPersistentContext(profile,{executablePath,headless:true,ignoreDefaultArgs:['--disable-extensions'],args:[`--disable-extensions-except=${extensionPath}`,`--load-extension=${extensionPath}`,'--no-first-run','--no-default-browser-check'],viewport:{width:390,height:960}});
const errors=[];
const evidence={browser:'Naver Whale',version:'',extensionId:'',checks:[],manualGate:'실제 브라우저 외곽 사이드바 버튼 클릭은 수동 확인 필요'};
try{
 const worker=browser.serviceWorkers()[0]||await browser.waitForEvent('serviceworker',{timeout:20000});
 const id=new URL(worker.url()).host;evidence.extensionId=id;
 const runtime=await worker.evaluate(()=>({manifest:globalThis.chrome.runtime.getManifest(),sidebar:typeof (globalThis.whale?.sidebarAction||globalThis.chrome.sidebarAction)==='object',userAgent:navigator.userAgent}));
 assert.equal(runtime.manifest.name,'웨일 퀘스트');assert.ok(runtime.sidebar,'Whale sidebarAction API must exist');evidence.version=runtime.userAgent;
 evidence.checks.push('Whale loaded the unpacked MV3 extension and exposes sidebarAction');
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`chrome-extension://${id}/sidebar.html`);
 await expect(page.getByText('웨일 확장앱에서 실행 중')).toBeVisible();
 await expect(page.getByText('확장앱에 포함된 웹앱')).toBeVisible();
 await expect(page.frameLocator('iframe[title="수업 운영과 전달물"]').getByRole('heading',{name:'수업 순환을 이어가세요'})).toBeVisible();
 evidence.checks.push('Bundled web app renders inside the sidebar iframe without a deployed URL');
 await page.getByLabel('웹앱 기본 주소').fill('javascript:alert(1)');await page.getByRole('button',{name:'주소 저장',exact:true}).click();await expect(page.getByRole('alert')).toBeVisible();
 await page.getByLabel('웹앱 기본 주소').fill('http://127.0.0.1:5183');await page.getByRole('button',{name:'주소 저장',exact:true}).click();await expect(page.getByRole('status')).toHaveText('웹앱 주소를 저장했습니다.');
 await page.reload();await expect(page.getByText('http://127.0.0.1:5183',{exact:true})).toBeVisible();
 evidence.checks.push('Unsafe URL rejected; app address persisted through extension reload');
 for(const width of [390,590]){
  await page.setViewportSize({width,height:1000});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`No horizontal overflow at ${width}px`);
  await page.screenshot({path:path.join(root,'.work',`whale-sidebar-${width}.png`),fullPage:true});
 }
 evidence.checks.push('Sidebar document renders at 390px and 590px without horizontal overflow');
 const next=browser.waitForEvent('page');await page.getByRole('button',{name:'웹앱 열기',exact:true}).click();const web=await next;await web.waitForLoadState('domcontentloaded');
 assert.equal(new URL(web.url()).origin,'http://127.0.0.1:5183');
 await expect(web.getByRole('heading',{name:'수업을 잇는 작은 바다.'})).toBeVisible();
 evidence.checks.push('Sidebar opens configured web app in a new Whale tab');
 assert.deepEqual(errors,[]);evidence.checks.push('No sidebar JavaScript page errors');
 await writeFile(path.join(root,'.work','whale-verification.json'),JSON.stringify(evidence,null,2));
 console.log(JSON.stringify(evidence,null,2));
}finally{await browser.close();}
