import {normalizeAppUrl} from './app-url';
interface ExtensionApi {
 runtime?:{id?:string;getURL?:(path:string)=>string;getManifest:()=>{version:string}};
 storage?:{local:{get:(key:string)=>Promise<Record<string,unknown>>;set:(value:Record<string,unknown>)=>Promise<void>}};
 tabs?:{create:(properties:{url:string})=>Promise<unknown>};
}
function api():ExtensionApi|undefined{return (globalThis as typeof globalThis & {chrome?:ExtensionApi}).chrome;}
export function isExtension(){return Boolean(api()?.runtime?.id);}
/** 확장앱에 포함된 웹앱 주소. 확장앱 밖에서는 빈 문자열. */
export function bundledAppUrl():string{const r=api()?.runtime;return r?.id&&r.getURL?r.getURL('app/index.html'):'';}
export function isBundledApp(url:string){return Boolean(url)&&url===bundledAppUrl();}
export function appFrameSrc(url:string){return isBundledApp(url)?url+'?sidebar=1#context':url+'/?sidebar=1#context';}
export function appFrameOrigin(url:string){return isBundledApp(url)?window.location.origin:new URL(url).origin;}
export async function loadAppUrl():Promise<string>{
 const storage=api()?.storage?.local;
 const data=storage?await storage.get('webAppUrl'):{webAppUrl:localStorage.getItem('wq.webAppUrl')};
 const value=data.webAppUrl||import.meta.env.VITE_PUBLIC_APP_URL;
 return typeof value==='string'&&value?normalizeAppUrl(value):'';
}
export async function saveAppUrl(raw:string):Promise<string>{
 const value=normalizeAppUrl(raw);const storage=api()?.storage?.local;
 if(storage)await storage.set({webAppUrl:value});else localStorage.setItem('wq.webAppUrl',value);
 return value;
}
export async function openApp(raw:string){
 const url=isBundledApp(raw)?raw:normalizeAppUrl(raw);const tabs=api()?.tabs;
 if(tabs)await tabs.create({url});else window.open(url,'_blank','noopener,noreferrer');
}
