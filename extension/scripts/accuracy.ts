// Run from extension/: npx tsx scripts/accuracy.ts. No provider keys are read.
import { readFile, writeFile } from 'node:fs/promises';
import { classifyKeywords } from '../src/classify/keywords';
import { parseAIClassification } from '../src/classify/validate';
interface Label { title: string; category: string; itemType: string; categoryText?: string; imageUrl?: string | null; }
const labels: Label[] = JSON.parse(await readFile(new URL('../tests/labels.json', import.meta.url), 'utf8'));
if (!labels.length) throw new Error('No labels');
const { PROXY_URL, EXTENSION_TOKEN, UNHAUL_ORIGIN } = process.env;
let endpoint: URL | undefined;
if (PROXY_URL && EXTENSION_TOKEN && UNHAUL_ORIGIN) {
 endpoint = new URL(PROXY_URL);
 if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new Error('Plain HTTPS PROXY_URL required');
 if (!/^chrome-extension:\/\/[a-p]{32}$/.test(UNHAUL_ORIGIN)) throw new Error('Actual allowlisted UNHAUL_ORIGIN required');
 endpoint.pathname = '/classify';
}
let kt=0,kc=0,at=0,ac=0,failures=0;
const times:number[]=[], rows:string[]=[];
for (const label of labels) {
 const basic=classifyKeywords(label.title,label.categoryText??'');
 kt+=Number(basic.itemType===label.itemType); kc+=Number(basic.category===label.category);
 let ai=null, status='unavailable (missing configuration)';
 if(endpoint){
  const start=performance.now(); const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),3000);
  try{
   const body=JSON.stringify({title:label.title,categoryText:label.categoryText??'',imageUrl:label.imageUrl??null});
   if(new TextEncoder().encode(body).length>2048)throw new Error('size');
   const response=await fetch(endpoint,{method:'POST',redirect:'error',signal:controller.signal,headers:{'Content-Type':'application/json','X-Unhaul-Origin':UNHAUL_ORIGIN!,'X-Unhaul-Token':EXTENSION_TOKEN!},body});
   if(!response.ok)status=`HTTP ${response.status}`;
   else{
    const reader=response.body?.getReader();if(!reader)throw new Error('empty');
    let text='',size=0;const decoder=new TextDecoder();
    while(true){const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>8192){await reader.cancel();throw new Error('size');}text+=decoder.decode(next.value,{stream:true});}
    ai=parseAIClassification(JSON.parse(text+decoder.decode())); status=ai?'ok':'invalid reply';
   }
  }catch{status=controller.signal.aborted?'timeout':'request failed';}
  finally{clearTimeout(timer);times.push(performance.now()-start);}
 }
 if(!ai)failures++;else{at+=Number(ai.itemType===label.itemType);ac+=Number(ai.category===label.category);}
 rows.push(`| ${label.title.replace(/[|\r\n]/g,' ')} | ${basic.category}/${basic.itemType} | ${ai?`${ai.category}/${ai.itemType}`:status} |`);
}
const pct=(n:number)=>`${n}/${labels.length} (${(100*n/labels.length).toFixed(1)}%)`;
times.sort((a,b)=>a-b);
const median=times.length?(times[Math.floor((times.length-1)/2)]+times[Math.floor(times.length/2)])/2:null;
const report=`## Phase 6 measured accuracy — ${new Date().toISOString()}\n\nKeyword itemType: ${pct(kt)}; category: ${pct(kc)}.\n`+
(endpoint?`AI itemType: ${pct(at)}; category: ${pct(ac)} (failures count as incorrect).\n`:'AI accuracy unmeasured: PROXY_URL, EXTENSION_TOKEN and/or UNHAUL_ORIGIN absent.\n')+
`AI failures/unavailable: ${failures}/${labels.length}; attempted: ${times.length}.\nMedian AI request time: ${median===null?'unmeasured':median.toFixed(0)+' ms'}; slowest: ${times.length?times[times.length-1].toFixed(0)+' ms':'unmeasured'} (includes failed attempts).\n\n| Title | Keyword category/itemType | AI category/itemType or failure |\n|---|---|---|\n${rows.join('\n')}\n\nOnly ${labels.length} unchanged labels; not a general benchmark. Their referenced captures are absent from current fixtures. Missing imageUrl means text-only evaluation, not a vision benchmark. No labels edited.\n`;
console.log(report);
const path=new URL('../../docs/testing.md',import.meta.url), original=await readFile(path,'utf8');
const begin='<!-- phase6-accuracy:start -->',end='<!-- phase6-accuracy:end -->',start=original.indexOf(begin),finish=original.indexOf(end),section=`${begin}\n${report}${end}`;
await writeFile(path,start>=0&&finish>=start?original.slice(0,start)+section+original.slice(finish+end.length):original.trimEnd()+'\n\n'+section+'\n');
