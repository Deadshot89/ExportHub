module.exports = async function (context) {
  context.res = {
    status: 200,
    headers: {'content-type':'application/json; charset=utf-8','cache-control':'no-store'},
    body: {ok:true, product:'ExportHUB Professional', version:'0.1.0', phase:'migration-safe-foundation', writeAccess:false}
  };
};
