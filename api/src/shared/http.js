export function json(body, status = 200, headers = {}) {
  return { status, jsonBody: body, headers: { 'Cache-Control': 'no-store', ...headers } };
}
export async function readJson(request) {
  try { return await request.json(); } catch { return {}; }
}
export function fromResult(result) {
  if (Buffer.isBuffer(result.body)) return { status: result.status, body: result.body, headers: result.headers };
  return json(result.body, result.status, result.headers);
}
