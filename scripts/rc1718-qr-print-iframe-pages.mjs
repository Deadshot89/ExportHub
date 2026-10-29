// RC1718 P0: the real QR/REF quick-print path clones document pages into an
// isolated iframe and copies ONLY #exporthub-rc352-document-style.
// Inject print pagination at that source instead of styling the parent page.
const ORIGINAL = "function styleText(){if(docStyleCache)return docStyleCache;var s=document.getElementById('exporthub-rc352-document-style');if(!s)throw new Error('Der freigegebene Dokumentstil fehlt.');docStyleCache=s.textContent||'';return docStyleCache}";
const STYLE = [
  '@page{size:A4 portrait;margin:0}',
  '@media print{',
  'html,body{width:210mm!important;max-width:210mm!important;margin:0!important;padding:0!important;background:#fff!important}',
  '#index352OutputRoot{display:block!important;width:210mm!important;margin:0!important;padding:0!important;overflow:visible!important}',
  '#index352OutputRoot>.index352-output-page{box-sizing:border-box!important;width:210mm!important;min-width:210mm!important;max-width:210mm!important;margin:0!important;box-shadow:none!important;border-radius:0!important;break-after:page!important;page-break-after:always!important}',
  '#index352OutputRoot>.index352-output-page:last-child{break-after:auto!important;page-break-after:auto!important}',
  '#index352OutputRoot>.rc390-page.rc390-load{display:flex!important;flex-direction:column!important;height:auto!important;min-height:296mm!important;max-height:none!important;overflow:visible!important;break-inside:auto!important;page-break-inside:auto!important}',
  '#index352OutputRoot>.rc390-load .rc390-bottom{position:relative!important;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;transform:none!important;flex:0 0 auto!important;margin-top:auto!important}',
  '#index352OutputRoot>.rc390-load .rc390-table tr,#index352OutputRoot>.rc390-load .rc390-sign{break-inside:avoid!important;page-break-inside:avoid!important}',
  '}'
].join('');
const MARKER = 'RC1718_PRINT_IFRAME_CSS';
const STYLE_ASSIGNMENT = 'var '+MARKER+'='+JSON.stringify(STYLE)+';';
const REPLACEMENT = ORIGINAL.replace("docStyleCache=s.textContent||'';","docStyleCache=(s.textContent||'')+'\\n'+"+MARKER+";");
export function patchRc1718PrintIframeHtml(html,file='index.html'){
  if(typeof html!=='string')throw new TypeError(file+': RC1718 HTML expected');
  if(html.includes('var '+MARKER+'=')){
    if(!html.includes(REPLACEMENT))throw new Error(file+': RC1718 partial patch');
    return html;
  }
  const start=html.indexOf(ORIGINAL);
  if(start<0||html.indexOf(ORIGINAL,start+ORIGINAL.length)>=0)
    throw new Error(file+': RC1718 isolated styleText() anchor missing or duplicated');
  return html.slice(0,start)+STYLE_ASSIGNMENT+'\n'+REPLACEMENT+html.slice(start+ORIGINAL.length);
}
