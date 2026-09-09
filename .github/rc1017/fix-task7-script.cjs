'use strict';
const fs=require('fs');
const path='.github/rc1017/apply-task7.cjs';
let src=fs.readFileSync(path,'utf8');
const before="if(!sub)return false,varRuntime=false;var runtime=rc1017SubShipmentQrRuntime[q(subShipmentId)];if(!runtime||!q(runtime.token)){runtime=await rc1017ActivateSubShipmentQr(subShipmentId,button);if(!runtime)return false;varRuntime=true}";
const after="if(!sub)return false;var runtime=rc1017SubShipmentQrRuntime[q(subShipmentId)];if(!runtime||!q(runtime.token)){runtime=await rc1017ActivateSubShipmentQr(subShipmentId,button);if(!runtime)return false}";
if(src.includes(before)){
  src=src.replace(before,after);
  fs.writeFileSync(path,src);
  console.log('RC1017 task7 script syntax cleaned');
}else if(src.includes(after)){
  console.log('RC1017 task7 script already clean');
}else{
  throw new Error('RC1017 task7 syntax target not found');
}
