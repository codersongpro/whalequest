import {copyFile,mkdir,writeFile,readFile} from 'node:fs/promises';
import {loadEnv} from 'vite';
import {deflateSync} from 'node:zlib';
const out=new URL('../dist/extension/',import.meta.url);
await mkdir(new URL('icons/',out),{recursive:true});
for(const file of ['manifest.json','background.js'])await copyFile(new URL('../apps/extension/'+file,import.meta.url),new URL(file,out));
await copyFile(new URL('../packages/context/service-domains.json',import.meta.url),new URL('service-domains.json',out));
const configured=process.env.VITE_PUBLIC_APP_URL||loadEnv('production',process.cwd(),'VITE_PUBLIC_').VITE_PUBLIC_APP_URL;
if(configured){const url=new URL(configured);const local=['localhost','127.0.0.1','[::1]'].includes(url.hostname);if(url.protocol!=='https:'&&!(url.protocol==='http:'&&local)||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error('VITE_PUBLIC_APP_URL must be a safe app root');const manifestPath=new URL('manifest.json',out);const manifest=JSON.parse(await readFile(manifestPath,'utf8'));manifest.host_permissions=[...manifest.host_permissions,url.protocol+'//'+url.hostname+'/*'];await writeFile(manifestPath,JSON.stringify(manifest,null,2));}
function crc32(data){let c=0xffffffff;for(const b of data){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0);}return(c^0xffffffff)>>>0;}
function chunk(name,data){const type=Buffer.from(name);const result=Buffer.alloc(data.length+12);result.writeUInt32BE(data.length);type.copy(result,4);data.copy(result,8);result.writeUInt32BE(crc32(Buffer.concat([type,data])),data.length+8);return result;}
function icon(size){
 const scan=Buffer.alloc((size*4+1)*size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const a=x/size,b=y/size;let color=[8,127,144,255];
  const round=Math.hypot(Math.max(.2-a,0,a-.8),Math.max(.2-b,0,b-.8))>.2;
  if(round)color=[0,0,0,0];
  if(((a-.43)/.29)**2+((b-.53)/.2)**2<1||(a>.65&&a<.87&&b>.4&&b<.69&&b>.4+(a-.65)*.3))color=[204,245,237,255];
  if(Math.hypot(a-.29,b-.49)<.028)color=[7,75,90,255];
  if(a>.42&&a<.46&&b>.2&&b<.36)color=[204,245,237,255];
  const pos=y*(size*4+1)+1+x*4;for(let i=0;i<4;i++)scan[pos+i]=color[i];
 }
 const header=Buffer.alloc(13);header.writeUInt32BE(size);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(scan)),chunk('IEND',Buffer.alloc(0))]);
}
for(const size of [16,48,128])await writeFile(new URL(`icons/icon${size}.png`,out),icon(size));
console.log('Extension packaged: dist/extension');
