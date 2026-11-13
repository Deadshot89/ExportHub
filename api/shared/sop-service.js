'use strict';

// SOP2 phase 1: pure draft, submission and version operations. The HTTP layer
// must pass a session-validated user; the ETag store must persist this result.
const {createHash} = require('node:crypto');
const {appendEvent, verifyChain} = require('./hash-chain');
const {STATUS, userKey, canEdit, canApprove, validateContent} = require('./sop-rules');

const SOP_ID = /^SOP-EH-\d{3}$/;
const VERSION_ID = /^(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const EMPTY_CONTENT = Object.freeze({de:{}, en:{}, steps:[]});

function error(code, status, errors) {
  const result = new Error(code);
  result.code = code;
  result.status = status;
  if (errors) result.errors = errors;
  return result;
}
function object(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function text(value, max, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw error('INVALID_' + label, 400);
  return value.trim();
}
function timestamp(now) {
  if (typeof now !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(now) ||
      !Number.isFinite(Date.parse(now)) || new Date(Date.parse(now)).toISOString() !== now) {
    throw error('INVALID_TIMESTAMP',400);
  }
  return now;
}
function editor(user) {
  if (!canEdit(user) || !userKey(user)) throw error('SOP_EDIT_FORBIDDEN',403);
  return userKey(user);
}
function contentCopy(value) {
  if (!object(value)) throw error('INVALID_CONTENT',400);
  try {
    const copied = clone(value);
    if (!object(copied)) throw new TypeError('not an object');
    return copied;
  } catch (_) { throw error('INVALID_CONTENT',400); }
}
function digest(value) {
  return createHash('sha256').update(JSON.stringify(value),'utf8').digest('hex');
}
function checkDocument(doc) {
  if (!object(doc) || doc.schemaVersion !== 1 || typeof doc.id !== 'string' || !SOP_ID.test(doc.id) ||
      !Number.isSafeInteger(doc.revision) || doc.revision < 1 || !Array.isArray(doc.versions) ||
      !Array.isArray(doc.events)) throw error('INVALID_DOCUMENT',409);
  if (!verifyChain(doc.events).ok || doc.events.length !== doc.revision) throw error('HISTORY_BROKEN',409);
  const {events, ...state} = doc;
  if (doc.events[doc.events.length - 1].data?.stateSha256 !== digest(state)) throw error('HISTORY_BROKEN',409);
  const ids = new Set();
  for (const version of doc.versions) {
    if (!object(version) || typeof version.version !== 'string' || ids.has(version.version) ||
        !Object.values(STATUS).includes(version.status) || !object(version.content)) {
      throw error('INVALID_DOCUMENT',409);
    }
    ids.add(version.version);
  }
  return doc;
}
function current(doc, input, desiredStatus) {
  if (!object(input) || !Number.isSafeInteger(input.revision) || input.revision !== doc.revision) {
    throw error('REVISION_CONFLICT',409);
  }
  const selected = doc.versions.find(v => object(v) && v.version === input.version);
  if (!selected || doc.versions.filter(v=>object(v)&&v.version===input.version).length!==1) throw error('VERSION_NOT_FOUND',404);
  if (selected.status !== desiredStatus) throw error(desiredStatus === STATUS.DRAFT ? 'NOT_DRAFT':'NOT_IN_REVIEW',409);
  return selected;
}
function updated(doc, versions, action, actor, at, data, extras={}) {
  const next = {...clone(doc),...extras,revision:doc.revision+1,versions};
  const {events, ...state} = next;
  next.events=[...clone(doc.events),appendEvent(doc.events,{action,actor,at,data:{...data,stateSha256:digest(state)}})];
  return next;
}
function createDraft(doc, input, user, now) {
  const actor = editor(user);
  timestamp(now);
  if (doc !== null) throw error('SOP_EXISTS',409);
  if (!object(input) || typeof input.id !== 'string' || !SOP_ID.test(input.id)) throw error('INVALID_SOP_ID',400);
  const title = text(input.title,180,'TITLE');
  const area = text(input.area,120,'AREA');
  const functionId = text(input.functionId,120,'FUNCTION_ID');
  const content = input.content === undefined ? clone(EMPTY_CONTENT) : contentCopy(input.content);
  const version = {version:'1.0',status:STATUS.DRAFT,author:actor,lastEditor:actor,content,createdAt:now,updatedAt:now};
  const first = {schemaVersion:1,id:input.id,revision:1,title,area,functionId,versions:[version],events:[]};
  const {events, ...state} = first;
  first.events=[appendEvent([],{action:'CREATED',actor,at:now,data:{version:version.version,contentSha256:digest(content),title,area,functionId,stateSha256:digest(state)}})];
  return first;
}
function updateDraft(doc, input, user, now) {
  const actor=editor(user);
  timestamp(now);
  checkDocument(doc);
  const selected=current(doc,input,STATUS.DRAFT);
  if (input.content === undefined && input.title === undefined) throw error('NO_CHANGES',400);
  const title=input.title === undefined ? doc.title : text(input.title,180,'TITLE');
  const content=input.content === undefined ? clone(selected.content) : contentCopy(input.content);
  const versions=clone(doc.versions).map(v => v.version === selected.version ? {...v,content,lastEditor:actor,updatedAt:now} : v);
  return updated(doc,versions,'UPDATED',actor,now,{version:selected.version,contentSha256:digest(content),title},{title});
}
function submit(doc, input, user, now) {
  const actor=editor(user);
  timestamp(now);
  checkDocument(doc);
  const selected=current(doc,input,STATUS.DRAFT);
  if (actor !== selected.author) throw error('ONLY_AUTHOR_MAY_SUBMIT',403);
  const result=validateContent(selected.content);
  if (!result.ok) throw error('CONTENT_INCOMPLETE',422,result.errors);
  const versions=clone(doc.versions).map(v=> v.version === selected.version ? {...v,status:STATUS.REVIEW,submittedBy:actor,submittedAt:now,updatedAt:now} : v);
  return updated(doc,versions,'SUBMITTED',actor,now,{version:selected.version,contentSha256:digest(selected.content)});
}
function nextVersionNumber(all) {
  const sorted = all.map(v=> {
    const match = VERSION_ID.exec(v && v.version);
    if (!match) throw error('INVALID_VERSION',409);
    return [Number(match[1]),Number(match[2])];
  }).sort((a,b)=>b[0]-a[0]||b[1]-a[1]);
  const [major,minor] = sorted[0];
  if (!Number.isSafeInteger(major) || !Number.isSafeInteger(minor) || major > 999 || minor > 999) throw error('VERSION_LIMIT',409);
  return minor >= 9 ? String(major+1)+'.0' : String(major)+'.'+String(minor+1);
}
function newVersion(doc, input, user, now) {
  const actor=editor(user);
  timestamp(now);
  checkDocument(doc);
  if (!object(input) || !Number.isSafeInteger(input.revision) || input.revision !== doc.revision) throw error('REVISION_CONFLICT',409);
  const approved=doc.versions.filter(v=>object(v)&&v.status===STATUS.APPROVED);
  if (approved.length !== 1) throw error('APPROVED_VERSION_REQUIRED',409);
  if (doc.versions.some(v=>v.status===STATUS.DRAFT || v.status===STATUS.REVIEW)) throw error('ACTIVE_DRAFT_EXISTS',409);
  const number=nextVersionNumber(doc.versions);
  if (doc.versions.some(v=>v.version===number)) throw error('VERSION_EXISTS',409);
  const content=contentCopy(approved[0].content);
  const version={version:number,status:STATUS.DRAFT,author:actor,lastEditor:actor,content,createdAt:now,updatedAt:now};
  return updated(doc,[...clone(doc.versions),version],'NEW_VERSION',actor,now,{version:number,sourceVersion:approved[0].version,contentSha256:digest(content)});
}


function approve(doc, input, user, now) {
  const actor=editor(user);
  timestamp(now);
  checkDocument(doc);
  const selected=current(doc,input,STATUS.REVIEW);
  if (!canApprove(user,selected)) throw error('FOUR_EYES',403);
  const validation=validateContent(selected.content);
  if (!validation.ok) throw error('CONTENT_INCOMPLETE',422,validation.errors);
  const previouslyApproved=doc.versions.filter(v=>v.status===STATUS.APPROVED);
  if (previouslyApproved.length>1) throw error('INVALID_DOCUMENT',409);
  const versions=clone(doc.versions).map(v=>{
    if (v.version===selected.version) return {...v,status:STATUS.APPROVED,approvedBy:actor,approvedAt:now,updatedAt:now};
    if (v.status===STATUS.APPROVED) return {...v,status:STATUS.ARCHIVED,archivedBy:actor,archivedAt:now,updatedAt:now};
    return v;
  });
  return updated(doc,versions,'APPROVED',actor,now,{version:selected.version,previousVersion:previouslyApproved[0]?.version||null});
}
function reject(doc, input, user, now) {
  const actor=editor(user);
  timestamp(now);
  checkDocument(doc);
  const selected=current(doc,input,STATUS.REVIEW);
  if (!canApprove(user,selected)) throw error('FOUR_EYES',403);
  if (!object(input) || typeof input.reason!=='string' || input.reason.trim().length<8 || input.reason.length>1000) {
    throw error('REASON_REQUIRED',422);
  }
  const reason=input.reason.trim();
  const versions=clone(doc.versions).map(v=>v.version===selected.version
    ? {...v,status:STATUS.DRAFT,rejectedBy:actor,rejectedAt:now,updatedAt:now} : v);
  return updated(doc,versions,'REJECTED',actor,now,{version:selected.version,reason});
}
function archive(doc, input, user, now) {
  const actor=editor(user);
  timestamp(now);
  checkDocument(doc);
  if (!object(input) || !Number.isSafeInteger(input.revision) || input.revision!==doc.revision) {
    throw error('REVISION_CONFLICT',409);
  }
  const approved=doc.versions.filter(v=>v.status===STATUS.APPROVED);
  if (approved.length!==1) throw error('APPROVED_VERSION_REQUIRED',409);
  const selected=approved[0];
  if (!canApprove(user,selected)) throw error('FOUR_EYES',403);
  if (doc.versions.some(v=>v.status===STATUS.REVIEW)) throw error('ACTIVE_REVIEW_EXISTS',409);
  const versions=clone(doc.versions).map(v=>v.version===selected.version
    ? {...v,status:STATUS.ARCHIVED,archivedBy:actor,archivedAt:now,updatedAt:now} : v);
  return updated(doc,versions,'ARCHIVED',actor,now,{version:selected.version});
}

module.exports={createDraft,updateDraft,submit,newVersion,approve,reject,archive,assertDocumentIntegrity:checkDocument};
