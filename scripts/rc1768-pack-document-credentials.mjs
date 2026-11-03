// RC1768: The RC1112 release is built from dist-rc1048, not from root
// index.html / TESTVERSION.html. Keep the RC1702 cookie-free PDF fix in
// the actually deployed HTML across production, TESTSERVICE and demo.
const RC886_MARKER = '/* exporthub-rc886-testservice-api-hotfix */';
const OLD = "nextInit.credentials = 'same-origin';";
const FIXED = "nextInit.credentials = init && init.credentials === 'omit' ? 'omit' : 'same-origin';";

export function patchRc1768PackDocumentCredentials(html, file) {
  if (typeof html !== 'string' || !html.includes(RC886_MARKER)) {
    throw new Error(file + ': RC1768 RC886 API wrapper missing from release output');
  }
  const count = html.split(OLD).length - 1;
  const fixedCount = html.split(FIXED).length - 1;
  if (fixedCount === 1 && count === 0) return html; // safe repeat build
  if (count !== 1 || fixedCount !== 0) {
    throw new Error(file + ': RC1768 expected exactly one legacy RC886 credentials override');
  }
  const marker = html.indexOf(RC886_MARKER);
  const override = html.indexOf(OLD);
  if (override <= marker || override - marker > 10000) {
    throw new Error(file + ': RC1768 credentials override is outside RC886 wrapper');
  }
  return html.replace(OLD, FIXED);
}
