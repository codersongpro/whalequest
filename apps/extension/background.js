/* global chrome */
let rules=[];
const ready=fetch(chrome.runtime.getURL('service-domains.json')).then(r=>r.json()).then(config=>{rules=config.rules;});
async function update(tab){await ready;let mode='lesson';try{const u=new URL(tab.url||'');if(u.protocol==='https:')mode=rules.find(rule=>rule.host===u.hostname)?.mode||'lesson';}catch{mode='lesson';}await chrome.storage.local.set({wqTabContext:{tabId:tab.id,mode}});}
async function active(){const tabs=await chrome.tabs.query({active:true,lastFocusedWindow:true});if(tabs[0])await update(tabs[0]);}
chrome.runtime.onInstalled.addListener(()=>{void active();});
chrome.tabs.onActivated.addListener(()=>{void active();});
chrome.tabs.onUpdated.addListener((_id,change,tab)=>{if(tab.active&&(change.url||change.status==='complete'))void active();});
chrome.windows.onFocusChanged.addListener(()=>{void active();});
chrome.runtime.onMessage.addListener((message,_sender,reply)=>{if(message?.type==='WQ_CONTEXT'){void active().then(()=>reply({ok:true})).catch(()=>reply({ok:false}));return true;}return false;});
void active();
