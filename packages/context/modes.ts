import config from './service-domains.json';
export type SidebarMode='class'|'teamboard'|'remote'|'lesson'|'paused';
export const modeNames:Record<SidebarMode,string>={class:'클래스',teamboard:'팀보드',remote:'원격 수업',lesson:'수업',paused:'UBT 일시 정지'};
export function detectMode(raw?:string):SidebarMode{try{const url=new URL(raw||'');if(url.protocol!=='https:')return 'lesson';return (config.rules.find(rule=>rule.host===url.hostname)?.mode as SidebarMode)||'lesson';}catch{return 'lesson';}}
export function chooseMode(url:string|undefined,manual?:SidebarMode):SidebarMode{const detected=detectMode(url);return detected==='paused'?'paused':manual||detected;}
export const serviceUrls={class:'https://class.whalespace.io',teamboard:'https://teamboard.whalespace.io',remote:'https://study.whaleon.naver.com',ubt:'https://ubt.whalespace.io'};
