import fs from 'node:fs';

const FILES=['index.html','TESTVERSION.html'];
const TERMS=['globalSearch','global-search','searchInput','searchResults','renderSearch','openSearch','performSearch','buildSearch','searchIndex','shipmentsearch','Suchen','Suche','suchen','Kunde','Sendung','Aufgabe','input type="search"','type="search"'];

function snippets(text, needle, limit=10, radius=1200){
  const out=[]; let from=0;
  while(out.length<limit){
    const p=text.toLowerCase().indexOf(needle.toLowerCase(),from);
    if(p<0)break;
    out.push({p,text:text.slice(Math.max(0,p-radius),Math.min(text.length,p+needle.length+radius))});
    from=p+Math.max(1,needle.length);
  }
  return out;
}

function scriptBlocks(html){
  const blocks=[];
  const re=/<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let m;
  while((m=re.exec(html))){
    const attrs=m[1]||'';
    const body=m[2]||'';
    const id=(attrs.match(/\bid=["']([^"']+)["']/i)||[])[1]||'';
    const funcs=[...body.matchAll(/function\s+([A-Za-z0-9_$]+)\s*\(/g)].map(x=>x[1]);
    const low=body.toLowerCase();
    let score=0;
    for(const t of TERMS){ if(low.includes(t.toLowerCase())) score++; }
    if(low.includes('customers')) score+=2;
    if(low.includes('shipments')) score+=2;
    if(low.includes('tasks')) score+=2;
    if(low.includes('search')) score+=4;
    if(low.includes('suche')||low.includes('suchen')) score+=2;
    blocks.push({id,attrs,body,funcs,score,start:m.index});
  }
  return blocks;
}

for(const file of FILES){
  const html=fs.readFileSync(file,'utf8');
  console.log(`\n================ ${file} FULL SEARCH DIAGNOSE ================`);
  const blocks=scriptBlocks(html).sort((a,b)=>b.score-a.score);
  for(const b of blocks.filter(x=>x.score>=6).slice(0,20)){
    console.log(`\nSCRIPT id=${b.id||'(none)'} score=${b.score} chars=${b.body.length} start=${b.start}`);
    console.log('FUNCTIONS:',b.funcs.slice(0,80).join(', '));
    for(const term of TERMS){
      const hit=snippets(b.body,term,2,700);
      if(hit.length){
        console.log(`\n--- ${term}: ${hit.length}+ ---`);
        for(const s of hit) console.log(s.text);
      }
    }
  }
  console.log('\n===== RAW SEARCH MARKUP / OWNER HITS =====');
  for(const term of ['type="search"','globalSearch','searchInput','searchResults','placeholder="Suchen','placeholder="Suche','Sendung suchen','globale Suche']){
    const hit=snippets(html,term,8,1000);
    console.log(`\n### ${term}: ${hit.length}`);
    for(const s of hit) console.log(s.text);
  }
}
