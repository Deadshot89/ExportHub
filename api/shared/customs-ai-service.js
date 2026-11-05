'use strict';

const contextBuilder=require('./customs-ai-context');
const deterministic=require('./customs-ai-deterministic');
const sourceSelector=require('./customs-ai-sources');
const policy=require('./customs-ai-policy');
const provider=require('./customs-ai-provider');
const apiI18n=require('./i18n');

function text(value,max=5000){return String(value==null?'':value).trim().slice(0,max)}
function contextSummary(context){
 const analysis=context&&context.analysis&&typeof context.analysis==='object'?context.analysis:{},invoice=context&&context.invoice&&typeof context.invoice==='object'?context.invoice:{},review=analysis.review&&typeof analysis.review==='object'?analysis.review:{};
 return{
  reference:text(context&&context.reference,80),
  destinationCountry:text(context&&context.destinationCountry,80),
  invoiceNumber:text(invoice.invoiceNumber,80),
  invoiceDate:text(invoice.invoiceDate,40),
  currency:text(invoice.currency,8),
  groupCount:Array.isArray(analysis.groups)?analysis.groups.length:0,
  unassignedCount:Array.isArray(analysis.unassigned)?analysis.unassigned.length:0,
  reviewComplete:review.complete===true
 }
}
function latestCheckedAt(sources){
 return (Array.isArray(sources)?sources:[]).map(item=>text(item&&item.checkedAt,40)).filter(Boolean).sort().reverse()[0]||''
}
function publicSources(sources,ids){
 const list=Array.isArray(sources)?sources:[],hasFilter=Array.isArray(ids),allowed=hasFilter?new Set(ids):null;
 return list.filter(item=>!hasFilter||allowed.has(item.id)).map(item=>({id:item.id,title:item.title,sourceName:item.sourceName,sourceUrl:item.sourceUrl,publishedAt:item.publishedAt,checkedAt:item.checkedAt}))
}
function invalid(code,answer){return{ok:false,code,answer,mode:'validation',sources:[],checkedAt:'',uncertainty:true,recoverable:true,contextSummary:{}}}

async function answerCustomsQuestion(options={}){
 const language=apiI18n.normalize(options.language)||'de',raw=String(options.question==null?'':options.question),question=raw.trim();
 if(!question)return invalid('QUESTION_REQUIRED',apiI18n.tLang(language,'api.customsAi.questionRequired'));
 if(raw.length>2000)return invalid('QUESTION_TOO_LONG',apiI18n.tLang(language,'api.customsAi.questionTooLong'));
 const invoiceAnalysis=options.invoiceAnalysis&&typeof options.invoiceAnalysis==='object'?options.invoiceAnalysis:{};
 const safeContext=contextBuilder.buildCustomsAiContext({reference:options.reference,destinationCountry:options.destinationCountry,abdRequest:options.abdRequest,invoiceAnalysis});
 const summary=contextSummary(safeContext);
 const direct=deterministic.answerDeterministicCustomsQuestion({question,analysis:invoiceAnalysis,language});
 if(direct.matched){
  return{ok:true,mode:'deterministic',answer:direct.answer,facts:direct.facts,sources:[],checkedAt:'',uncertainty:direct.uncertainty===true,recoverable:true,contextSummary:summary,evidence:'invoice-analysis'}
 }
 const sources=sourceSelector.selectCustomsAiSources({question,context:safeContext,articles:options.articles,limit:6,minScore:2});
 if(!sources.length){
  return{ok:true,mode:'no-source',answer:apiI18n.tLang(language,'api.customsAi.noSource'),sources:[],checkedAt:'',uncertainty:true,recoverable:true,contextSummary:summary}
 }
 const askModel=typeof options.askModel==='function'?options.askModel:provider.askCustomsModel;
 const modelResult=await askModel({systemInstructions:policy.buildSystemInstructions(language),question,context:safeContext,sources,env:options.env,fetchImpl:options.fetchImpl,timeoutMs:options.timeoutMs});
 const checkedAt=latestCheckedAt(sources);
 if(!modelResult||modelResult.ok!==true){
  const reason=text(modelResult&&modelResult.reason,20),textKey={config:'api.customsAi.unavailableConfig',busy:'api.customsAi.unavailableBusy',timeout:'api.customsAi.unavailableTimeout'}[reason]||'api.customsAi.unavailable';
  return{ok:false,mode:'provider-error',code:text(modelResult&&modelResult.code,80)||'AI_PROVIDER_ERROR',reason:reason||'server',providerStatus:Number(modelResult&&modelResult.status)||0,answer:apiI18n.tLang(language,textKey),sources:publicSources(sources),checkedAt,uncertainty:true,recoverable:modelResult&&modelResult.recoverable!==false,contextSummary:summary}
 }
 // Nur Marker im tatsächlich angezeigten Antworttext zählen. Provider-Metadaten allein sind kein Quellenbeleg.
 const answer=text(modelResult.answer,12000),markers=Array.from(answer.matchAll(/\[\[([A-Za-z0-9._:-]{1,48})\]\]/g),match=>match[1]);
 const allowed=new Set(sources.map(source=>source.id)),hasUnknownMarker=markers.some(id=>!allowed.has(id));
 const citedSources=publicSources(sources,markers);
 return{ok:true,mode:'ai',answer,sources:citedSources,checkedAt:latestCheckedAt(citedSources),uncertainty:citedSources.length===0||hasUnknownMarker,modelInfo:modelResult.modelInfo&&typeof modelResult.modelInfo==='object'?{provider:text(modelResult.modelInfo.provider,40),model:text(modelResult.modelInfo.model,120)}:undefined,recoverable:true,contextSummary:summary}
}

module.exports={answerCustomsQuestion};
