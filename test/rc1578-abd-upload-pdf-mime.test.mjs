import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function extractFileToPdf(file){
  const html=fs.readFileSync(file,'utf8');
  const start=html.indexOf('function fileToPdf(file){');
  assert.ok(start>=0,file+': fileToPdf fehlt');
  const end=html.indexOf('\n',start);
  return html.slice(start,end);
}

function runFileToPdf(file,upload){
  class FileReader{readAsDataURL(f){this.result='data:'+(f.type||'application/octet-stream')+';base64,JVBERi0=';this.onload()}}
  const context={FileReader,URL:{createObjectURL(){return 'blob:x'},revokeObjectURL(){}},Image:class{},document:{},TextEncoder,Blob,dataUrlBytes(){return new Uint8Array()},simpleJpegPdf(){return new Blob([])}};
  vm.runInNewContext(extractFileToPdf(file)+';this.fileToPdf=fileToPdf;',context);
  return context.fileToPdf(upload);
}

for(const file of ['index.html','TESTVERSION.html']){
  test(`RC1578 ${file}: ABD-PDF ohne Browser-MIME-Typ wird angenommen (REF 9Z7L82)`,async()=>{
    const pdf=await runFileToPdf(file,{name:'ABD_9Z7L82.pdf',type:'',size:1234});
    assert.equal(pdf.type,'application/pdf');
    assert.equal(pdf.name,'ABD_9Z7L82.pdf');
    assert.equal(pdf.size,1234);
  });

  test(`RC1578 ${file}: PDF mit abweichendem MIME-Typ wird angenommen`,async()=>{
    for(const type of ['application/x-pdf','APPLICATION/PDF','application/octet-stream']){
      const pdf=await runFileToPdf(file,{name:'ABD.PDF',type,size:10});
      assert.equal(pdf.type,'application/pdf',type);
    }
  });

  test(`RC1578 ${file}: andere Dateien ohne Bild-/PDF-Typ bleiben abgelehnt`,async()=>{
    await assert.rejects(runFileToPdf(file,{name:'ABD.docx',type:'',size:10}),/Nur PDF- oder Bilddateien/);
    await assert.rejects(runFileToPdf(file,{name:'ABD.docx',type:'application/octet-stream',size:10}),/Nur PDF- oder Bilddateien/);
  });
}
