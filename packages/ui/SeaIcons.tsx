import type {SVGProps} from 'react';
import './sea.css';
type P=SVGProps<SVGSVGElement>&{size?:number};
function Svg({size=24,children,...rest}:P){return <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...rest}>{children}</svg>;}
export const WhaleIcon=(p:P)=><Svg {...p}><path d="M3 18c0-7 8-10 14-7 4 2 5 6 9 6l3-4v8c-4 4-10 5-15 4-6-1-11-3-11-7Z"/><circle cx="9" cy="16" r="1" fill="currentColor"/><path d="M13 8V4m0 2 3-2"/></Svg>;
export const FishIcon=(p:P)=><Svg {...p}><path d="M3 16c4-7 12-8 18-2l7-4v12l-7-4c-6 6-14 5-18-2Z"/><circle cx="9" cy="14" r="1" fill="currentColor"/></Svg>;
export const JellyfishIcon=(p:P)=><Svg {...p}><path d="M6 14a10 9 0 0 1 20 0Z"/><path d="M10 14v7m6-7v10m6-10v7"/></Svg>;
export const OctopusIcon=(p:P)=><Svg {...p}><path d="M7 15a9 9 0 0 1 18 0c0 3-1 4-1 6 0 2 2 3 4 3M7 15c0 3 1 4 1 6 0 2-2 3-4 3m8-6c0 3-1 5-3 6m10-6c0 3 1 5 3 6"/><circle cx="12" cy="13" r="1" fill="currentColor"/><circle cx="20" cy="13" r="1" fill="currentColor"/></Svg>;
export const ShellIcon=(p:P)=><Svg {...p}><path d="M4 24c-1-9 5-17 12-17s13 8 12 17Z"/><path d="M16 7v17M10 9l3 15M22 9l-3 15M6 15l8 9M26 15l-8 9"/></Svg>;
export const StarfishIcon=(p:P)=><Svg {...p}><path d="m16 3 3.5 8.5 9 .8-6.9 6 2.2 8.9L16 22l-7.8 5.2 2.2-8.9-6.9-6 9-.8Z"/></Svg>;
export const TurtleIcon=(p:P)=><Svg {...p}><path d="M6 19c0-6 5-10 10-10s10 4 10 10Z"/><path d="M12 19l2-6h4l2 6M3 22l4-3m22 3-4-3M27 14l3-2"/></Svg>;
export const CrabIcon=(p:P)=><Svg {...p}><ellipse cx="16" cy="19" rx="8" ry="5"/><path d="M8 15 4 8m24 0-4 7M9 22l-4 3m22 0-4-3M13 14v-3m6 3v-3"/></Svg>;
export const BubbleIcon=(p:P)=><Svg {...p}><circle cx="12" cy="20" r="6"/><circle cx="22" cy="9" r="3"/><circle cx="24" cy="21" r="1.5"/></Svg>;
export const DolphinIcon=(p:P)=><Svg {...p}><path d="M3 21c2-8 9-13 17-10l5-6-1 9c2 1 4 0 6-2-1 7-6 10-12 9l-4 5 1-6c-6 1-10 1-12 1Z"/><circle cx="11" cy="15" r="1" fill="currentColor"/></Svg>;
export const SeahorseIcon=(p:P)=><Svg {...p}><path d="M13 5c4-2 8 0 8 4 0 3-3 4-3 7 0 3 3 4 3 7 0 3-3 4-6 3-3-1-3-5-1-6M13 5l-5 2 5 3"/><circle cx="16" cy="8" r="1" fill="currentColor"/></Svg>;
