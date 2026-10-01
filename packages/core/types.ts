export type QuestionType = 'multiple-choice' | 'true-false' | 'short-answer';
export interface Question { id:string; type:QuestionType; prompt:string; options?:string[]; answer:number|boolean|string[]; explanation?:string; tags:string[]; standard?:string }
export interface QuestionSet { schemaVersion:'1.0'; id:string; version:number; title:string; questions:Question[] }
export type Answer = number|boolean|string;
export interface LearningRecord { id:string; setId:string; setVersion:number; questionId:string; answer:Answer; correct:boolean; durationMs:number; timestamp:number; mode:'focus'|'review' }
export interface ImportIssue { index:number; message:string }
export interface ImportResult { set:QuestionSet|null; issues:ImportIssue[] }
