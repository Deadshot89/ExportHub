const fs=require('fs');
const src=fs.readFileSync('index.html','utf8');
const terms=[
 'function fileUrl',
 'function abdDocUrl',
 'function activeDocs',
 'window.rc524DownloadFile',
 'function openCompletedAbd',
 'rc542DownloadShipmentZip',
 'ExportHUBIndex224Pod',
 'function fileName(f)',
 'function fileList',
 'function latestAbdPdf'
];
for(const term of terms){
  console.log('\n===== TERM '+term+' =====');
  let pos=0,count=0;
  while((pos=src.indexOf(term,pos))>=0&&count<8){
    const start=Math.max(0,pos-1400),end=Math.min(src.length,pos+3200);
    console.log('\n--- '+pos+' ---\n'+src.slice(start,end).replace(/\s+/g,' '));
    pos+=term.length;count++;
  }
  if(!count)console.log('NICHT GEFUNDEN');
}
