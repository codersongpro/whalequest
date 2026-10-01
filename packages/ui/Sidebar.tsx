import {useEffect,useState} from 'react';
import {ArrowUpRight} from 'lucide-react';
import {WhaleIcon} from './SeaIcons';
import {bundledAppUrl,isExtension,isBundledApp,loadAppUrl,openApp,saveAppUrl} from '../shared/extension';
import {ContextSidebar} from './ContextSidebar';
import {Brand} from './Brand';
export function Sidebar(){
 const [url,setUrl]=useState('');const [draft,setDraft]=useState('');const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);const [ready,setReady]=useState(false);const [error,setError]=useState(false);const target=url||bundledAppUrl();
 useEffect(()=>{let active=true;loadAppUrl().then(value=>{if(active){setUrl(value);setDraft(value);}}).catch(e=>{if(active){setError(true);setMessage(e instanceof Error?e.message:'주소를 불러오지 못했습니다.');}}).finally(()=>{if(active)setReady(true);});return()=>{active=false;};},[]);
 async function act(fn:()=>Promise<void>){if(busy)return;setBusy(true);setMessage('');setError(false);try{await fn();}catch(e){setError(true);setMessage(e instanceof Error?e.message:'다시 시도해 주세요.');}finally{setBusy(false);}}
 return <div className="sidebar-shell"><a className="skip-link" href="#sidebar-main">본문으로 건너뛰기</a><header><Brand/></header><main id="sidebar-main"><ContextSidebar url={target}/><details className="sidebar-settings"><summary><WhaleIcon size={18}/>&nbsp;설정</summary><div className="connection-panel">{url&&<span className="saved-url" title={url}>{url}</span>}<button className="primary full" disabled={!ready||!target||busy} onClick={()=>void act(()=>openApp(target))}>새 탭에서 열기<ArrowUpRight size={18}/></button><form onSubmit={e=>{e.preventDefault();void act(async()=>{const value=await saveAppUrl(draft);setUrl(value);setDraft(value);setMessage('저장했습니다.');});}}><label htmlFor="web-url">웹앱 기본 주소</label><input id="web-url" type="text" inputMode="url" autoComplete="url" spellCheck={false} value={draft} placeholder={isBundledApp(target)?'기본: 확장앱에 포함된 웹앱':'https://your-app.vercel.app'} maxLength={2048} onChange={e=>setDraft(e.target.value)} disabled={busy||!ready}/><button type="submit" disabled={busy||!ready}>{busy?'저장 중…':'주소 저장'}</button></form>{message&&<p className={error?'notice error':'notice success'} role={error?'alert':'status'}>{message}</p>}</div></details></main><footer>{isExtension()?'WHALE QUEST':'WHALE QUEST · 웹 미리보기'}</footer></div>;
}
