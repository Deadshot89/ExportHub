// RC1602 P0: patch the real html2canvas POD path during the three-environment build.
// Source index.html exceeds the GitHub file-edit connector's size limit; modify built
// HTML with exact anchors and fail the build if the renderer drifts.
const LIMIT="rowHtml=(rs.length?rs:[{}]).slice(0,12).map(function(r,i)";
const PDF_MARK="async function createPdf(mode,sh){";
const LOOP="for(var i=0;i<nodes.length;i++){var node=nodes[i],canvas=await timed(h2c(node,{scale:renderScale,backgroundColor:'#ffffff',useCORS:false,allowTaint:false,logging:false,scrollX:0,scrollY:0,windowWidth:Math.max(900,node.scrollWidth||900),windowHeight:Math.max(1250,node.scrollHeight||1250)}),45000,'PDF-Seite '+(i+1)+' konnte nicht innerhalb von 45 Sekunden erstellt werden.');images.push({bytes:bytesFromDataUrl(canvas.toDataURL('image/jpeg',jpegQuality)),width:canvas.width,height:canvas.height})}";
const FUNCTIONS=String.raw`// RC1602 P0: A4-paginate the actual signed POD browser renderer without shrinking ink.
function index352PodRasterPages(canvas,node,quality){
 var width=canvas.width,pageHeight=Math.floor(width*842/595);
 if(!width||!pageHeight||!canvas.height)throw new Error('POD-Seite ist leer oder unvollständig.');
 var outputs=[],y=0,doc=node.ownerDocument,rect=node.getBoundingClientRect(),scale=width/Math.max(1,rect.width);
 var footer=node.querySelector('.rc390-bottom,.rc352-bottom'),f=footer&&footer.getBoundingClientRect();
 var footerTop=f?Math.floor((f.top-rect.top)*scale):-1,footerBottom=f?Math.ceil((f.bottom-rect.top)*scale):-1;
 while(y<canvas.height){
  if(outputs.length>=32)throw new Error('POD zu lang: Mehr als 32 A4-Seiten. Bitte Positionen und Anhänge prüfen.');
  var end=Math.min(y+pageHeight,canvas.height);
  if(footerTop>y+120&&footerTop<end-8&&footerBottom>end&&footerBottom-footerTop<pageHeight-40)
   end=Math.max(y+120,footerTop-8);
  var cropHeight=end-y,part=doc.createElement('canvas');
  part.width=width;part.height=pageHeight;
  var ctx=part.getContext('2d',{alpha:false});
  if(!ctx)throw new Error('POD-PDF-Seitenrenderer konnte nicht initialisiert werden.');
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,width,pageHeight);
  ctx.drawImage(canvas,0,y,width,cropHeight,0,0,width,cropHeight);
  outputs.push({bytes:bytesFromDataUrl(part.toDataURL('image/jpeg',quality)),width:part.width,height:part.height});
  y=end;
 }
 return outputs
}
function index352PreparePodPage(node){
 node.style.setProperty('height','auto','important');
 node.style.setProperty('max-height','none','important');
 node.style.setProperty('min-height','297mm','important');
 node.style.setProperty('overflow','visible','important');
 node.style.setProperty('zoom','1','important');
 var footer=node.querySelector('.rc390-bottom,.rc352-bottom');
 if(footer&&footer.style){
  footer.style.setProperty('position','relative','important');
  footer.style.setProperty('top','auto','important');
  footer.style.setProperty('bottom','auto','important');
  footer.style.setProperty('transform','none','important');
  footer.style.setProperty('margin-top','12px','important');
 }
 node.querySelectorAll('.rc390-table,.rc390-docchips,.rc1305-document-grid').forEach(function(el){
  el.style.setProperty('max-height','none','important');
  el.style.setProperty('overflow','visible','important');
 });
}
function index352AssertRealPodSignature(root){
 var images=Array.from(root.querySelectorAll('.index352-proof-signature,.rc1305-signature-image'));
 if(!images.some(function(img){return img.complete&&img.naturalWidth>0&&img.naturalHeight>0}))
  throw new Error('POD enthält keine lesbare Original-Fahrerunterschrift. Keine fehlerhafte PDF erzeugt.');
}
`;
const NEW_LOOP="for(var i=0;i<nodes.length;i++){var node=nodes[i];if(outputMode==='pod')index352PreparePodPage(node);if(outputMode==='pod')index352AssertRealPodSignature(node);var renderHeight=Math.max(node.scrollHeight||0,Math.ceil(node.getBoundingClientRect().height));var canvas=await timed(h2c(node,{scale:renderScale,backgroundColor:'#ffffff',useCORS:false,allowTaint:false,logging:false,scrollX:0,scrollY:0,windowWidth:Math.max(900,node.scrollWidth||900),windowHeight:Math.max(1250,renderHeight),height:outputMode==='pod'?renderHeight:undefined}),45000,'PDF-Seite '+(i+1)+' konnte nicht innerhalb von 45 Sekunden erstellt werden.');if(outputMode==='pod')images.push.apply(images,index352PodRasterPages(canvas,node,jpegQuality));else images.push({bytes:bytesFromDataUrl(canvas.toDataURL('image/jpeg',jpegQuality)),width:canvas.width,height:canvas.height})}";
function once(html,oldValue,newValue){
 const i=html.indexOf(oldValue);
 if(i<0||html.indexOf(oldValue,i+oldValue.length)>=0)throw Error('RC1602 P0 renderer anchor missing/duplicated: '+oldValue.slice(0,65));
 return html.slice(0,i)+newValue+html.slice(i+oldValue.length);
}
export function patchRc1602PodBrowserHtml(html){
 if(typeof html!=='string')throw new TypeError('RC1602 expected HTML string');
 if(html.includes('function index352PodRasterPages(')){
   if(!html.includes('index352AssertRealPodSignature('))throw Error('RC1602 partial injection');
   return html;
 }
 html=once(html,LIMIT,"rowHtml=(rs.length?rs:[{}]).map(function(r,i)");
 html=once(html,PDF_MARK,FUNCTIONS+'\n'+PDF_MARK);
 html=once(html,LOOP,NEW_LOOP);
 return html;
}
