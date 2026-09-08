import fs from 'node:fs';

const catalogPath='assets/sop/rc1007-sop-catalog.js';
let catalog=fs.readFileSync(catalogPath,'utf8');
if(!catalog.includes('function systemDiagramSrc(')){
  catalog=catalog.replace("function externalText(code){return `Der folgende Arbeitsschritt findet außerhalb von ExportHUB statt. Weitere Durchführung siehe ${code}.`;}\n",`function externalText(code){return \`Der folgende Arbeitsschritt findet außerhalb von ExportHUB statt. Weitere Durchführung siehe \${code}.\`;}\nfunction systemDiagramSrc(nodes,input){\n  const clean=value=>String(value==null?'':value).replace(/[&<>\"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','\\\"':'&quot;',\"'\":'&#39;'}[ch]||ch));\n  const list=Array.isArray(nodes)?nodes.slice(0,5):[];\n  const width=Math.max(720,list.length*180+40),height=220;\n  const items=list.map((label,index)=>{\n    const x=25+index*180;\n    const arrow=index<list.length-1?\`<line x1=\"\${x+140}\" y1=\"118\" x2=\"\${x+172}\" y2=\"118\" stroke=\"#64748b\" stroke-width=\"3\"/><path d=\"M \${x+164} 109 L \${x+174} 118 L \${x+164} 127\" fill=\"none\" stroke=\"#64748b\" stroke-width=\"3\"/>\`:'';\n    return \`<g><rect x=\"\${x}\" y=\"76\" width=\"140\" height=\"84\" rx=\"14\" fill=\"#f8fafc\" stroke=\"#94a3b8\"/><circle cx=\"\${x+22}\" cy=\"98\" r=\"14\" fill=\"#1d4ed8\"/><text x=\"\${x+22}\" y=\"103\" text-anchor=\"middle\" font-family=\"Arial,sans-serif\" font-size=\"13\" font-weight=\"700\" fill=\"white\">\${index+1}</text><text x=\"\${x+70}\" y=\"129\" text-anchor=\"middle\" font-family=\"Arial,sans-serif\" font-size=\"12\" font-weight=\"700\" fill=\"#0f172a\">\${clean(label)}</text></g>\${arrow}\`;\n  }).join('');\n  const svg=\`<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"\${width}\" height=\"\${height}\" viewBox=\"0 0 \${width} \${height}\"><rect width=\"100%\" height=\"100%\" fill=\"white\"/><rect x=\"18\" y=\"18\" width=\"\${width-36}\" height=\"42\" rx=\"10\" fill=\"#e2e8f0\"/><text x=\"38\" y=\"45\" font-family=\"Arial,sans-serif\" font-size=\"18\" font-weight=\"700\" fill=\"#0f172a\">ExportHUB · \${clean(input.number)} · \${clean(input.title)}</text>\${items}<text x=\"25\" y=\"198\" font-family=\"Arial,sans-serif\" font-size=\"11\" fill=\"#475569\">Systemgrafik aus den freigegebenen ExportHUB-Arbeitsschritten – keine Darstellung externer Software.</text></svg>\`;\n  return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);\n}\n`);
  catalog=catalog.replace(/function buildVisuals\(input,sections\)\{[^\n]+\}/,`function buildVisuals(input,sections){const nodes=list(input.flow).length?list(input.flow):sections.steps.slice(0,5).map(step=>shortLabel(step.text||step));return [{type:'process',stepId:'process-flow',caption:\`Prozessübersicht – \${input.number}: \${input.title}\`,required:true},{type:'screenshot',stepId:'step-1',caption:\`ExportHUB-Systembild – \${input.title}\`,required:true,nodes:nodes.slice(0,5),src:systemDiagramSrc(nodes,input)}];}`);
  fs.writeFileSync(catalogPath,catalog);
}

const uiPath='assets/sop/rc1007-sop-ui.js';
let ui=fs.readFileSync(uiPath,'utf8');
ui=ui.replace("/^SOP-(QM|SYS|LOG|WH|ORG)-\\d{3}$/.test(value)","/^SOP-EH-\\d{3}$/.test(value)");
ui=ui.replace('ISO 9001 · gelenkte Dokumente','ExportHUB · gelenkte System-SOPs');
ui=ui.replace('Aktuelle Arbeitsanweisungen, Prozessverantwortung, Versionen und Nachweise zentral verwalten.','Ausschließlich ExportHUB-Systemprozesse mit Versionen, Prüfschritten, Systemgrafiken und eindeutigen Verweisen auf externe SOPs.');
fs.writeFileSync(uiPath,ui);

const cssPath='assets/sop/rc1007-sop.css';
let css=fs.readFileSync(cssPath,'utf8');
if(!css.includes('.rc1008-system-image-note')){
  css+='\n.rc1007-sop-visual img[src^="data:image/svg+xml"]{width:100%;background:#fff;box-shadow:0 2px 10px rgba(15,23,42,.06)}\n';
  fs.writeFileSync(cssPath,css);
}
