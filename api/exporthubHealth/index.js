module.exports = async function (context, req) {
  context.res = {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify({
      ok: true,
      app: "ExportHUB API",
      route: "/api/exporthub/health",
      time: new Date().toISOString()
    })
  };
};
