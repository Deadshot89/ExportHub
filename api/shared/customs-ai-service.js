'use strict';

const contextBuilder=require('./customs-ai-context');
const deterministic=require('./customs-ai-deterministic');
const sourceSelector=require('./customs-ai-sources');
const policy=require('./customs-ai-policy');
const provider=require('./customs-ai-provider');

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
 const list=Array.isArray(sources)?sources:[],allowed=Array.isArray(ids)&&ids.length?new Set(ids):null;
 return list.filter(item=>!allowed||allowed.has(item.id)).map(item=>({id:item.id,title:item.title,sourceName:item.sourceName,sourceUrl:item.sourceUrl,publishedAt:item.publishedAt,checkedAt:item.checkedAt}))
}
function invalid(code,answer){return{ok:false,code,answer,mode:'validation',sources:[],checkedAt:'',uncertainty:true,recoverable:true,contextSummary:{}}}

async function answerCustomsQuestion(options={}){
 const raw=String(options.question==null?'':options.question),question=raw.trim();
 if(!question)return invalid('QUESTION_REQUIRED','Bitte eine Zollfrage eingeben.');
 if(raw.length>2000)return invalid('QUESTION_TOO_LONG','Die Zollfrage ist zu lang. Bitte auf maximal 2.000 Zeichen kürzen.');
 const invoiceAnalysis=options.invoiceAnalysis&&typeof options.invoiceAnalysis==='object'?options.invoiceAnalysis:{};
 const safeContext=contextBuilder.buildCustomsAiContext({reference:options.reference,destinationCountry:options.destinationCountry,abdRequest:options.abdRequest,invoiceAnalysis});
 const summary=contextSummary(safeContext);
 const direct=deterministic.answerDeterministicCustomsQuestion({question,analysis:invoiceAnalysis});
 if(direct.matched){
  return{ok:true,mode:'deterministic',answer:direct.answer,facts:direct.facts,sources:[],checkedAt:'',uncertainty:direct.uncertainty===true,recoverable:true,contextSummary:summary,evidence:'invoice-analysis'}
 }
 const sources=sourceSelector.selectCustomsAiSources({question,context:safeContext,articles:options.articles,limit:6,minScore:1});
 if(!sources.length){
  return{ok:true,mode:'no-source',answer:'Für diese Frage ist in der aktuell geprüften Zoll-Wissensbasis keine ausreichend passende Quelle hinterlegt. Ich stelle deshalb keine Zollbehauptung als Fakt dar.',sources:[],checkedAt:'',uncertainty:true,recoverable:true,contextSummary:summary}
 }
 const askModel=typeof options.askModel==='function'?options.askModel:provider.askCustomsModel;
 const modelResult=await askModel({systemInstructions:policy.buildSystemInstructions(),question,context:safeContext,sources,env:options.env,fetchImpl:options.fetchImpl,timeoutMs:options.timeoutMs});
 const checkedAt=latestCheckedAt(sources);
 if(!modelResult||modelResult.ok!==true){
  return{ok:false,mode:'provider-error',code:text(modelResult&&modelResult.code,80)||'AI_PROVIDER_ERROR',answer:text(modelResult&&modelResult.message,400)||'Der KI-Zollexperte ist vorübergehend nicht verfügbar.',sources:publicSources(sources),checkedAt,uncertainty:true,recoverable:modelResult&&modelResult.recoverable!==false,contextSummary:summary}
 }
 const citations=Array.isArray(modelResult.citations)?modelResult.citations:[],citedSources=publicSources(sources,citations);
 return{ok:true,mode:'ai',answer:text(modelResult.answer,12000),sources:citedSources,checkedAt,uncertainty:citations.length===0,modelInfo:modelResult.modelInfo&&typeof modelResult.modelInfo==='object'?{provider:text(modelResult.modelInfo.provider,40),model:text(modelResult.modelInfo.model,120)}:undefined,recoverable:true,contextSummary:summary}
}

module.exports={answerCustomsQuestion};
