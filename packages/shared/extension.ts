import {normalizeAppUrl} from './app-url';
interface ExtensionApi {
 runtime?:{id?:string;getManifest:()=>{version:string}};
 storage?:{local:{get:(key:string)=>Promise<Record<string,unknown>>;set:(value:Record<string,unknown>)=>Promise<void>}};
 tabs?:{create:(properties:{url:string})=>Promise<unknown>};
}
function api():ExtensionApi|undefined{return (globalThis as typeof globalThis & {chrome?:ExtensionApi}).chrome;}
export function isExtension(){return Boolean(api()?.runtime?.id);}
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
 const url=normalizeAppUrl(raw);const tabs=api()?.tabs;
 if(tabs)await tabs.create({url});else window.open(url,'_blank','noopener,noreferrer');
}
