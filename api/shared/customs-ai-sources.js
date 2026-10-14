'use strict';

const knowledge=require('./customs-knowledge');

function text(value,max=5000){return String(value==null?'':value).trim().slice(0,max)}
function fold(value){return text(value).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim()}
const ALIASES=Object.freeze([
 {canonical:'praferenz',prefixes:['praferenz','preferen','preferenc','preferency']},
 {canonical:'ursprung',prefixes:['ursprung','origin','origine','origen','pochodzen']},
 {canonical:'ausfuhr',prefixes:['ausfuhr','export','eksport','esportaz']},
 {canonical:'zolltarif',prefixes:['zolltarif','customstariff','tariff','tarif','taryf','arancel']},
 {canonical:'formalitat',prefixes:['formalitat','formaliti','formalidad']},
 {canonical:'beschrank',prefixes:['beschrank','restriction','restriccion','restric','ogranicz']},
 {canonical:'exportanforder',prefixes:['exportanforder','requirement','requisito','exigence','wymagan','requisiti']}
]);
const STOPWORDS=new Set([
 'wie','ist','sind','die','der','das','den','dem','des','ein','eine','einen','einem','einer','und','oder','fur','mit','von','zur','zum','welche','welcher','welches','welchen','muss','soll','ich','wir','diese','dieser','dieses','prufen','regel','regeln',
 'what','which','is','are','the','a','an','and','or','for','with','from','to','should','must','check','this','that','rule','rules',
 'jaka','jakie','jest','sa','dla','oraz','lub','czy','mam','sprawdzic','tego','tej','regula','reguly','zasada','zasady',
 'que','cual','cuales','es','son','el','la','los','las','un','una','y','o','para','con','de','del','debo','comprobar','esta','este','regla','reglas',
 'quel','quelle','quels','quelles','est','sont','le','la','les','un','une','et','ou','pour','avec','de','des','dois','verifier','cette','ce','regle','regles',
 'quale','quali','e','sono','il','lo','la','i','gli','le','un','una','e','o','per','con','di','del','devo','verificare','questa','questo','regola','regole'
]);
function canonicalAliases(token){
 const out=[];
 for(const rule of ALIASES){if(rule.prefixes.some(prefix=>token.startsWith(prefix)))out.push(rule.canonical)}
 return out
}
function tokens(value){
 const raw=fold(value).split(/\s+/).filter(token=>token.length>=3&&!STOPWORDS.has(token)),out=new Set(raw);
 const stems=['praferenz','ursprung','ausfuhr','zolltarif','warentarif','tarifier','formalitat','beschrank','exportanforder'];
 for(const token of raw){
  for(const stem of stems){if(token.includes(stem))out.add(stem)}
  for(const alias of canonicalAliases(token))out.add(alias)
 }
 return Array.from(out).slice(0,100)
}
function terms(article){
 const high=[article.title,...(article.topics||[])].map(fold).join(' ');
 const medium=[article.summary,...(article.countries||[])].map(fold).join(' ');
 const low=fold(article.content);
 return{high,medium,low}
}
function scoreArticle(article,queryTokens,contextTokens){
 const fields=terms(article);let queryScore=0;
 for(const token of queryTokens){
  if(fields.high.includes(token))queryScore+=4;
  else if(fields.medium.includes(token))queryScore+=2;
  else if(fields.low.includes(token))queryScore+=1;
 }
 if(queryScore<=0)return 0;
 let score=queryScore;
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
