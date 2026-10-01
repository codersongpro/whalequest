import {test,expect} from '@playwright/test';
test('web landing states the current phase and renders without browser exceptions',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/');
 await expect(page.getByRole('heading',{name:'수업을 잇는 작은 바다.'})).toBeVisible();await page.getByRole('link',{name:'웨일에서 시작하기'}).click();await expect(page.getByText('웨일 확장앱 페이지 열기')).toBeVisible();expect(errors).toEqual([]);
});
for(const width of [360,390,590,1280])test(`web layout fits ${width}px and exposes keyboard navigation`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto('/');await page.keyboard.press('Tab');await expect(page.getByRole('link',{name:'본문으로 건너뛰기'})).toBeFocused();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
