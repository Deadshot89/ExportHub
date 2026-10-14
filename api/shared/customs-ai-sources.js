'use strict';

const knowledge=require('./customs-knowledge');

function text(value,max=5000){return String(value==null?'':value).trim().slice(0,max)}
function fold(value){return text(value).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim()}
function tokens(value){
 const raw=fold(value).split(/\s+/).filter(token=>token.length>=3),out=new Set(raw);
 const stems=['praferenz','ursprung','ausfuhr','zolltarif','warentarif','tarifier','formalitat','beschrank','exportanforder'];
 for(const token of raw){for(const stem of stems){if(token.includes(stem))out.add(stem)}}
 return Array.from(out).slice(0,80)
}
function terms(article){
 const high=[article.title,...(article.topics||[])].map(fold).join(' ');
 const medium=[article.summary,...(article.countries||[])].map(fold).join(' ');
 const low=fold(article.content);
 return{high,medium,low}
}
function scoreArticle(article,queryTokens,contextTokens){
 const fields=terms(article);let score=0;
 for(const token of queryTokens){
  if(fields.high.includes(token))score+=4;
  else if(fields.medium.includes(token))score+=2;
  else if(fields.low.includes(token))score+=1;
 }
 for(const token of contextTokens){
  if(fields.high.includes(token))score+=2;
  else if(fields.medium.includes(token))score+=1;
 }
 return score
}
function excerpt(article){return text(article.summary||article.content,1600)}
function toSource(article){
 return{id:article.id,title:article.title,excerpt:excerpt(article),sourceName:article.sourceName,sourceUrl:article.sourceUrl,publishedAt:article.publishedAt,checkedAt:article.checkedAt}
}
function selectCustomsAiSources(options={}){
 const rows=Array.isArray(options.articles)?options.articles:knowledge.loadBundledKnowledge();
 const published=knowledge.publishedArticles(rows),limit=Math.min(8,Math.max(1,Number(options.limit)||6)),minScore=Math.max(1,Number(options.minScore)||1);
 const questionTokens=tokens(options.question),contextTokens=tokens(JSON.stringify(options.context&&typeof options.context==='object'?options.context:{}));
 if(!questionTokens.length)return[];
 return published.map((article,index)=>({article,index,score:scoreArticle(article,questionTokens,contextTokens)}))
  .filter(row=>row.score>=minScore)
  .sort((a,b)=>b.score-a.score||a.index-b.index||a.article.id.localeCompare(b.article.id))
  .slice(0,limit).map(row=>toSource(row.article))
}
module.exports={selectCustomsAiSources};
