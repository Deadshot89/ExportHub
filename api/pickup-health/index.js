// pickup-health function — einfacher Healthcheck
module.exports = async function (context, req) {
  context.res = { status: 200, body: { ok: true, service: 'pickup', version: 'RC628' } };
};
