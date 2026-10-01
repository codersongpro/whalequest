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
function inPoly(x,y,pts){let c=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const[a,b]=pts[i],[p,q]=pts[j];if((b>y)!==(q>y)&&x<(p-a)*(y-b)/(q-b)+a)c=!c;}return c;}
function seg(x,y,x1,y1,x2,y2){const dx=x2-x1,dy=y2-y1;const t=Math.max(0,Math.min(1,((x-x1)*dx+(y-y1)*dy)/(dx*dx+dy*dy)));return Math.hypot(x-x1-t*dx,y-y1-t*dy);}
const TAIL=[[66,58],[80,54],[84,40],[88,38],[90,48],[98,44],[95,60],[84,66],[66,64]];
/* 100x100 좌표의 고래 아이콘: 청록 바탕, 밝은 고래(분수·꼬리·배 포함) */
function sample(x,y){
 const rr=Math.max(Math.abs(x-50)-30,0)**2+Math.max(Math.abs(y-50)-30,0)**2;if(rr>20**2)return[0,0,0,0];
 const t=y/100;let c=[8+10*t,127-10*t,144-8*t,255];
 const body=((x-42)/32)**2+((y-58)/19)**2<1||inPoly(x,y,TAIL);
 if(body){c=[204,245,237,255];if(y>66&&((x-42)/32)**2+((y-58)/19)**2<1)c=[160,225,220,255];}
 if(Math.hypot(x-22,y-54)<2.6)c=[7,75,90,255];
 if(seg(x,y,38,40,38,26)<2.4||seg(x,y,38,28,30,22)<2.4||seg(x,y,38,28,46,22)<2.4)c=[204,245,237,255];
 return c;}
function icon(size){
 const scan=Buffer.alloc((size*4+1)*size);const N=4;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const acc=[0,0,0,0];
  for(let i=0;i<N;i++)for(let j=0;j<N;j++){const c=sample((x+(i+.5)/N)/size*100,(y+(j+.5)/N)/size*100);acc[0]+=c[0]*c[3];acc[1]+=c[1]*c[3];acc[2]+=c[2]*c[3];acc[3]+=c[3];}
  const pos=y*(size*4+1)+1+x*4;const a=acc[3];
  scan[pos]=a?Math.round(acc[0]/a):0;scan[pos+1]=a?Math.round(acc[1]/a):0;scan[pos+2]=a?Math.round(acc[2]/a):0;scan[pos+3]=Math.round(a/(N*N));
 }
 const header=Buffer.alloc(13);header.writeUInt32BE(size);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(scan)),chunk('IEND',Buffer.alloc(0))]);
}
for(const size of [16,48,128])await writeFile(new URL(`icons/icon${size}.png`,out),icon(size));
console.log('Extension packaged: dist/extension');
