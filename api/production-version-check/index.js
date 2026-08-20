'use strict';
const PRODUCTION_ROOT='https://wonderful-forest-0f315e310.7.azurestaticapps.net/';
function versionFrom(html){
  const text=String(html||'');
  const m=text.match(/var\s+BUILD\s*=\s*Object\.freeze\(\{version:\s*['"](RC\d+)['"]/i)||text.match(/version:\s*['"](RC\d+)['"]/i);
  return m?String(m[1]).toUpperCase():'';
}
module.exports=async function(context,req){
  if(String(req.method||'GET').toUpperCase()==='OPTIONS'){
    context.res={status:204,headers:{'Access-Control-Allow-Methods':'GET,OPTIONS','Access-Control-Allow-Headers':'Content-Type','Cache-Control':'no-store'}};return;
  }
  try{
    const url=PRODUCTION_ROOT+'?exporthub-production-proxy='+Date.now();
    const response=await fetch(url,{method:'GET',headers:{Accept:'text/html','Cache-Control':'no-cache','Pragma':'no-cache','User-Agent':'ExportHUB-ReleaseCenter/RC817'}});
    if(!response.ok)throw new Error('Produktions-Root HTTP '+response.status);
    const html=await response.text();
    const version=versionFrom(html);
    if(!/^RC\d+$/i.test(version))throw new Error('BUILD-Version wurde auf der Produktions-Root nicht gefunden.');
    context.res={status:200,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, max-age=0','Pragma':'no-cache'},body:{ok:true,version,source:'production-root',checkedAt:new Date().toISOString()}};
  }catch(error){
    context.log.error('production-version-check',error);
    context.res={status:502,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'},body:{ok:false,error:'PRODUCTION_VERSION_CHECK_FAILED',message:String(error&&error.message||error)}};
  }
};
