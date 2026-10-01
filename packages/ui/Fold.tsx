import type {ReactNode} from 'react';
import {ChevronDown} from 'lucide-react';
import './sea.css';
/** 기본으로 접혀 있고, 제목을 선택하면 펼쳐지는 메뉴. 메뉴마다 해양생물 이모지를 가진다. */
export function Fold({title,icon,tone='teal',className='',open=false,children}:{title:string;icon?:string;tone?:'teal'|'blue'|'sand'|'coral';className?:string;open?:boolean;children:ReactNode}){return <details className={('app-card fold '+className).trim()} open={open||undefined}><summary>{icon&&<span className={'sea-icon-chip small '+tone} aria-hidden="true">{icon}</span>}<span className="fold-title">{title}</span><ChevronDown size={18} aria-hidden="true"/></summary><div className="fold-body">{children}</div></details>;}
