'use strict';

// SOP2 phase 1: pure authorization, four-eyes and bilingual content rules.
// Session validity, version metadata and timestamps are enforced by the API/service.
const {isAdmin} = require('./user-policy');

const STATUS = Object.freeze({DRAFT:'draft', REVIEW:'review', APPROVED:'approved', ARCHIVED:'archived'});
const TRANSITIONS = Object.freeze({
  [STATUS.DRAFT]: Object.freeze([STATUS.REVIEW]),
  [STATUS.REVIEW]: Object.freeze([STATUS.DRAFT, STATUS.APPROVED]),
  [STATUS.APPROVED]: Object.freeze([STATUS.ARCHIVED]),
  [STATUS.ARCHIVED]: Object.freeze([])
});
const REQUIRED = Object.freeze(['purpose', 'scope', 'responsibilities', 'checks', 'records']);
const LIST_PARTS = Object.freeze(['responsibilities', 'prerequisites', 'checks', 'deviations', 'records']);
const LOCALES = Object.freeze(['de', 'en']);
const DANGEROUS_MARKUP = /<\s*\/?\s*[a-z][^>]*>|\b(?:javascript|vbscript)\s*:|\bdata\s*:\s*text\/html\b/i;
const MAX_TEXT = 10000;

function normalized(value) {
  return typeof value === 'string' ? value.normalize('NFKC').trim().toLowerCase() : '';
}
function validIdentity(value) {
  return normalized(value).length > 0;
}
function identityKeys(value) {
  if (typeof value === 'string') return new Set(validIdentity(value) ? [normalized(value)] : []);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return new Set();
  return new Set(['user', 'login', 'username', 'name', 'id', 'userId']
    .map(key => normalized(value[key])).filter(Boolean));
}
function userKey(user) {
  if (typeof user === 'string') return normalized(user);
  if (!user || typeof user !== 'object' || Array.isArray(user)) return '';
  return ['user', 'login', 'username', 'name', 'id', 'userId']
    .map(key => normalized(user[key])).find(Boolean) || '';
}
function enabled(user) {
  return !!user && typeof user === 'object' && !Array.isArray(user) &&
    user.active !== false && user.disabled !== true && user.locked !== true && !!userKey(user);
}
function canRead(user) {
  // Only an authenticated session may supply the user; untrusted browser claims
  // must never be passed here by an API. All signed-in users can read SOPs.
  return enabled(user);
}
function canEdit(user) {
  if (!enabled(user)) return false;
  if (isAdmin(user)) return true;
  const rights = user.rights && user.rights.sop;
  if (!rights || typeof rights !== 'object' || Array.isArray(rights)) return false;
  const level = normalized(rights.level || rights.access);
  return rights.edit === true || rights.admin === true || rights.functionAdmin === true ||
    level === 'edit' || level === 'admin';
}
function canApprove(user, version) {
  if (!canEdit(user) || !version || typeof version !== 'object' || Array.isArray(version)) return false;
  const approver = identityKeys(user);
  const author = identityKeys(version.author);
  const lastEditor = identityKeys(version.lastEditor);
  // No bypass for legacy/partial records without both identities.
  if (!approver.size || !author.size || !lastEditor.size) return false;
  for (const key of approver) if (author.has(key) || lastEditor.has(key)) return false;
  return true;
}
function canTransition(from, to) {
  return typeof from === 'string' && typeof to === 'string' &&
    (TRANSITIONS[from] || []).includes(to);
}
function safeText(value) {
  return typeof value === 'string' && value.trim().length > 0 &&
    value.length <= MAX_TEXT && !DANGEROUS_MARKUP.test(value);
}
function validateContent(content) {
  const errors = [];
  if (!content || typeof content !== 'object' || Array.isArray(content)) {
    return {ok:false, errors:[{code:'CONTENT_INVALID'}]};
  }
  for (const lang of LOCALES) {
    const section = content[lang];
    const data = section && typeof section === 'object' && !Array.isArray(section) ? section : {};
    for (const part of REQUIRED) {
      const value = data[part];
      if (LIST_PARTS.includes(part) ? !Array.isArray(value) || !value.length : !safeText(value)) {
        errors.push({code:'EMPTY_PART',part,lang});
      }
    }
    for (const part of LIST_PARTS) {
      const value = data[part];
      if (value === undefined && !REQUIRED.includes(part)) continue;
      if (!Array.isArray(value)) {
        if (!REQUIRED.includes(part)) errors.push({code:'INVALID_PART',part,lang});
        continue;
      }
      for (let index=0;index<value.length;index++) {
        if (!safeText(value[index])) errors.push({code:'INVALID_TEXT',part,lang,index});
      }
    }
  }
  if (!Array.isArray(content.steps) || !content.steps.length || content.steps.length > 200) {
    errors.push({code:'STEPS_INVALID'});
  } else {
    const seen = new Set();
    for (let index=0; index<content.steps.length; index++) {
      const step = content.steps[index];
      if (!step || typeof step !== 'object' || Array.isArray(step)) {
        errors.push({code:'STEP_INVALID',index});
        continue;
      }
      if (typeof step.id !== 'string' || !/^[a-z0-9][a-z0-9_.-]{0,79}$/i.test(step.id) || seen.has(step.id)) {
        errors.push({code:'STEP_ID_INVALID',index});
      } else seen.add(step.id);
      for (const lang of LOCALES) {
        if (!safeText(step[lang])) errors.push({code:'STEP_LANG_MISSING',lang,index});
      }
      for (const part of ['screenshot','tourTarget']) {
        if (typeof step[part] === 'string' && DANGEROUS_MARKUP.test(step[part])) {
          errors.push({code:'UNSAFE_MARKUP',part,index});
        }
      }
    }
  }
  return {ok:errors.length===0,errors};
}

module.exports = {STATUS,userKey,canRead,canEdit,canApprove,canTransition,validateContent};
