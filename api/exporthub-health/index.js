
'use strict';
module.exports=async function(context,req){
 const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
 if(req.method==='OPTIONS'){context.res={status:204,headers:Object.assign({},headers,{Allow:'GET, OPTIONS'}),body:''};return}
 if(req.method!=='GET'){context.res={status:405,headers:Object.assign({},headers,{Allow:'GET, OPTIONS'}),body:JSON.stringify({ok:false,code:'METHOD_NOT_ALLOWED'})};return}
 context.res={status:200,headers,body:JSON.stringify({ok:true,service:'ExportHUB API',health:'ok',version:'RC604',time:new Date().toISOString()})};
};
