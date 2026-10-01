import {copyFile,mkdir,writeFile,readFile} from 'node:fs/promises';
import {loadEnv} from 'vite';
const out=new URL('../dist/extension/',import.meta.url);
await mkdir(new URL('icons/',out),{recursive:true});
for(const file of ['manifest.json','background.js'])await copyFile(new URL('../apps/extension/'+file,import.meta.url),new URL(file,out));
await copyFile(new URL('../packages/context/service-domains.json',import.meta.url),new URL('service-domains.json',out));
const configured=process.env.VITE_PUBLIC_APP_URL||loadEnv('production',process.cwd(),'VITE_PUBLIC_').VITE_PUBLIC_APP_URL;
if(configured){const url=new URL(configured);const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);if(url.protocol!=='https:'&&!(url.protocol==='http:'&&local)||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error('VITE_PUBLIC_APP_URL must be a safe app root');const manifestPath=new URL('manifest.json',out);const manifest=JSON.parse(await readFile(manifestPath,'utf8'));manifest.host_permissions=[...manifest.host_permissions,url.protocol+'//'+url.hostname+'/*'];await writeFile(manifestPath,JSON.stringify(manifest,null,2));}
for(const size of [16,48,128])await copyFile(new URL(`../apps/extension/icons/icon${size}.png`,import.meta.url),new URL(`icons/icon${size}.png`,out));
console.log('Extension packaged: dist/extension');
