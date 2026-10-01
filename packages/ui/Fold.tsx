import type {ComponentType,ReactNode} from 'react';
import {ChevronDown} from 'lucide-react';
type Icon=ComponentType<{size?:number}>;
/** 기본으로 접혀 있고, 제목을 선택하면 펼쳐지는 메뉴. 메뉴마다 해양생물 아이콘을 가진다. */
export function Fold({title,icon:Icon,tone='teal',className='',open=false,children}:{title:string;icon?:Icon;tone?:'teal'|'blue'|'sand'|'coral';className?:string;open?:boolean;children:ReactNode}){return <details className={('app-card fold '+className).trim()} open={open||undefined}><summary>{Icon&&<span className={'sea-icon-chip small '+tone}><Icon size={22}/></span>}<span className="fold-title">{title}</span><ChevronDown size={18} aria-hidden="true"/></summary><div className="fold-body">{children}</div></details>;}
