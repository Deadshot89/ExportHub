'use strict';

const path=require('node:path');
const fs=require('node:fs');

function text(value,max=4000){return String(value==null?'':value).trim().slice(0,max)}
function slug(value){return text(value,120).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,100)}
function list(value,maxItems=40,maxLen=80){return Array.from(new Set((Array.isArray(value)?value:[]).map(item=>text(item,maxLen)).filter(Boolean))).slice(0,maxItems)}
function isoDate(value){const raw=text(value,40);if(!raw)return'';return /^\d{4}-\d{2}-\d{2}(?:T[^\s]+)?$/.test(raw)?raw:''}
function safeUrl(value){
 const raw=text(value,600);if(!raw)return'';
 try{const url=new URL(raw);return url.protocol==='https:'?url.toString():''}catch(_){return''}
}
function normalizeKnowledgeArticle(article){
 const source=article&&typeof article==='object'?article:{};
 const title=text(source.title,240),normalizedSlug=slug(source.slug||title),id=slug(source.id||normalizedSlug);
 return{
  id,
  slug:normalizedSlug,
  title,
  summary:text(source.summary,800),
  content:text(source.content,8000),
  topics:list(source.topics,40,80).map(item=>slug(item)).filter(Boolean),
  countries:list(source.countries,40,16).map(item=>text(item,16).toUpperCase()),
  sourceName:text(source.sourceName,180),
  sourceUrl:safeUrl(source.sourceUrl),
  publishedAt:isoDate(source.publishedAt),
  checkedAt:isoDate(source.checkedAt),
  status:text(source.status||'draft',24).toLowerCase(),
  updatedAt:isoDate(source.updatedAt)
 }
}
function validateKnowledgeArticle(article){
 const normalized=normalizeKnowledgeArticle(article),errors=[];
 if(!normalized.id)errors.push('id');
 if(!normalized.slug)errors.push('slug');
 if(!normalized.title)errors.push('title');
 if(!['draft','published','retired'].includes(normalized.status))errors.push('status');
 if(normalized.status==='published'){
  if(!normalized.summary&&!normalized.content)errors.push('content');
  if(!normalized.sourceName)errors.push('sourceName');
  if(!normalized.sourceUrl)errors.push('sourceUrl');
  if(!normalized.checkedAt)errors.push('checkedAt');
 }
 return{valid:errors.length===0,errors,article:normalized}
}
function publishedArticles(rows){
 const input=Array.isArray(rows)?rows:[],out=[],seen=new Set();
 for(const row of input){
  const checked=validateKnowledgeArticle(row);
  if(!checked.valid||checked.article.status!=='published'||seen.has(checked.article.id))continue;
  seen.add(checked.article.id);out.push(checked.article)
 }
 return out
}
function loadBundledKnowledge(){
 try{
  const file=path.resolve(__dirname,'../../data/customs-knowledge.json');
  const parsed=JSON.parse(fs.readFileSync(file,'utf8'));
  return publishedArticles(parsed)
 }catch(_){return[]}
}
module.exports={normalizeKnowledgeArticle,validateKnowledgeArticle,publishedArticles,loadBundledKnowledge};
