/** Only app roots are supported; never persist credentials, queries, or fragments. */
export function normalizeAppUrl(raw:string):string {
 let url:URL;
 try {url=new URL(raw.trim());}catch{throw new Error('https://로 시작하는 웹앱 주소를 입력해 주세요.');}
 const local=url.hostname==='localhost'||url.hostname==='127.0.0.1'||url.hostname==='[::1]';
 if(url.protocol!=='https:'&&!(local&&url.protocol==='http:'))throw new Error('HTTPS 주소를 사용해 주세요. 개발용 localhost는 HTTP를 사용할 수 있어요.');
 if(url.username||url.password||url.search||url.hash||url.pathname!=='/')throw new Error('경로·로그인 정보·검색어 없이 웹앱의 기본 주소만 입력해 주세요.');
 return url.origin;
}
