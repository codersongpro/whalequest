import type {ReactNode} from 'react';
import {WhaleIcon} from './SeaIcons';
/** 기본으로 접혀 있고, 제목을 선택하면 펼쳐지는 메뉴. */
export function Fold({title,className='',open=false,children}:{title:string;className?:string;open?:boolean;children:ReactNode}){return <details className={('app-card fold '+className).trim()} open={open||undefined}><summary><span>{title}</span><WhaleIcon size={22}/></summary><div className="fold-body">{children}</div></details>;}
