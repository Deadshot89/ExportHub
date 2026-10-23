'use strict';

// RC1630 "Selbst korrigieren": rules for text/translation fixes that an admin submits on the website.
// The API only checks the shape of a request; the GitHub workflow re-checks every change against the
// i18n packs on main (applyTextChanges) before it opens a pull request. Nothing here writes live data.

const LANGUAGES = Object.freeze(['de', 'en', 'pl', 'es', 'fr', 'it']);
const MAX_CHANGES = 20;
const MAX_VALUE_LENGTH = 2000;
const MAX_REASON_LENGTH = 500;
const KEY_RE = /^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+){1,6}$/;
// German values of these keys are matched against fixed German text in the page; changing them would
// silently break the translation of that text, so only the other languages can be edited there.
const GERMAN_LOCKED_PREFIXES = Object.freeze(['legacyUi.', 'legacyPattern.']);

function text(v) { return String(v == null ? '' : v); }
function fail(code, message) { const e = new Error(message); e.code = code; e.status = 400; return e; }
function templateVars(value) {
  const out = new Set();
  text(value).replace(/\{\{\s*([\w.-]+)\s*\}\}|\{([\w.-]+)\}/g, (_, a, b) => { out.add(a || b); return ''; });
  return [...out].sort();
}
function germanLocked(key) { return GERMAN_LOCKED_PREFIXES.some((p) => key.startsWith(p)); }

// Shape check, used by the API before a job is stored. Returns the cleaned change list.
function normalizeTextChanges(changes, reason) {
  if (!Array.isArray(changes) || !changes.length) throw fail('SELF_CORRECT_NO_CHANGES', 'Keine Textänderung übergeben.');
  if (changes.length > MAX_CHANGES) throw fail('SELF_CORRECT_TOO_MANY', 'Höchstens ' + MAX_CHANGES + ' Textänderungen pro Vorgang.');
  const why = text(reason).trim();
  if (why.length < 3) throw fail('SELF_CORRECT_REASON_REQUIRED', 'Bitte kurz angeben, warum der Text geändert wird.');
  if (why.length > MAX_REASON_LENGTH) throw fail('SELF_CORRECT_REASON_TOO_LONG', 'Die Begründung ist zu lang (max. ' + MAX_REASON_LENGTH + ' Zeichen).');
  const seen = new Set();
  const out = changes.map((c) => {
    const lang = text(c && c.lang).trim().toLowerCase(), key = text(c && c.key).trim(), value = text(c && c.value);
    if (!LANGUAGES.includes(lang)) throw fail('SELF_CORRECT_LANGUAGE_INVALID', 'Unbekannte Sprache: ' + lang);
    if (!KEY_RE.test(key) || key.length > 160) throw fail('SELF_CORRECT_KEY_INVALID', 'Ungültiger Textschlüssel: ' + key.slice(0, 160));
    if (!value.trim()) throw fail('SELF_CORRECT_VALUE_EMPTY', 'Text darf nicht leer sein: ' + key + ' (' + lang + ')');
    if (value.length > MAX_VALUE_LENGTH) throw fail('SELF_CORRECT_VALUE_TOO_LONG', 'Text ist zu lang: ' + key + ' (' + lang + ')');
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw fail('SELF_CORRECT_VALUE_INVALID', 'Text enthält Steuerzeichen: ' + key + ' (' + lang + ')');
    if (lang === 'de' && germanLocked(key)) throw fail('SELF_CORRECT_GERMAN_LOCKED', 'Der deutsche Text von ' + key + ' steht fest in der Seite und kann hier nicht geändert werden. Nutze dafür „Fehler beschreiben“.');
    const id = lang + '|' + key;
    if (seen.has(id)) throw fail('SELF_CORRECT_DUPLICATE', 'Doppelte Änderung: ' + key + ' (' + lang + ')');
    seen.add(id);
    return { lang, key, value };
  });
  return { changes: out, reason: why };
}

// Applies changes to the packs from main. packs: {de:{...},en:{...}}; sourceTexts: page/runtime source
// in which a German value may appear verbatim (index.html, assets/*.js). Returns the changed packs
// or throws with a message that is shown to the admin.
function applyTextChanges(packs, changes, sourceTexts) {
  const next = {};
  LANGUAGES.forEach((lang) => { next[lang] = Object.assign({}, packs[lang] || {}); });
  const sources = Array.isArray(sourceTexts) ? sourceTexts : [];
  const applied = [];
  changes.forEach((c) => {
    const pack = next[c.lang];
    if (!Object.prototype.hasOwnProperty.call(pack, c.key)) throw fail('SELF_CORRECT_KEY_UNKNOWN', 'Textschlüssel ' + c.key + ' gibt es in ' + c.lang + ' nicht. Es können nur vorhandene Texte geändert werden.');
    const before = text(pack[c.key]);
    if (before === c.value) return;
    if (templateVars(before).join(',') !== templateVars(c.value).join(',')) throw fail('SELF_CORRECT_TEMPLATE_VARS', 'Platzhalter wie {name} müssen erhalten bleiben: ' + c.key + ' (' + c.lang + ')');
    // Texts also end up in HTML attributes; new < > " ' ` could break out of them. Typographic „“ ‚‘ ’ are fine.
    const markup = [...new Set(c.value.match(/[<>"'`]/g) || [])].filter((ch) => !before.includes(ch));
    if (markup.length) throw fail('SELF_CORRECT_MARKUP', 'Die Zeichen ' + markup.join(' ') + ' sind in Texten nicht erlaubt (bitte „ “ oder ’ verwenden): ' + c.key + ' (' + c.lang + ')');
    if (c.lang === 'de' && germanLocked(c.key)) throw fail('SELF_CORRECT_GERMAN_LOCKED', 'Der deutsche Text von ' + c.key + ' steht fest in der Seite und kann hier nicht geändert werden.');
    if (c.lang === 'de' && before.trim().length >= 2 && sources.some((s) => s.includes(before.trim()))) {
      throw fail('SELF_CORRECT_GERMAN_IN_SOURCE', 'Der deutsche Text „' + before.trim().slice(0, 80) + '“ (' + c.key + ') steht fest im Seitenquelltext. Eine Änderung hier würde die Übersetzung brechen. Bitte nur die Übersetzungen ändern oder „Fehler beschreiben“ nutzen.');
    }
    pack[c.key] = c.value;
    applied.push({ lang: c.lang, key: c.key, before, after: c.value });
  });
  if (!applied.length) throw fail('SELF_CORRECT_NOTHING_CHANGED', 'Alle Texte sind bereits so gespeichert. Es gibt nichts hochzuladen.');
  return { packs: next, applied };
}

// Keeps key order, the 2-space formatting and the (missing) final newline of assets/i18n/*.json.
function serializePack(pack, originalRaw) { return JSON.stringify(pack, null, 2) + (text(originalRaw).endsWith('\n') ? '\n' : ''); }

module.exports = {
  LANGUAGES,
  MAX_CHANGES,
  GERMAN_LOCKED_PREFIXES,
  templateVars,
  normalizeTextChanges,
  applyTextChanges,
  serializePack
};
