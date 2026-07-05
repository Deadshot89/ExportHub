const { BlobServiceClient } = require("@azure/storage-blob");

const CONTAINER = process.env.EXPORTHUB_CONTAINER || "exporthub-teamdata";
const STATE_BLOB = process.env.EXPORTHUB_STATE_BLOB || "exporthub-state.json";

function response(status, body) {
  return {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(body)
  };
}

function getConnectionString() {
  const conn =
    process.env.EXPORTHUB_STORAGE_CONNECTION_STRING ||
    process.env.AzureWebJobsStorage;

  if (!conn) {
    throw new Error("Storage connection string missing.");
  }

  return conn;
}

async function getBlobClient() {
  const service = BlobServiceClient.fromConnectionString(getConnectionString());
  const container = service.getContainerClient(CONTAINER);
  await container.createIfNotExists();
  return container.getBlockBlobClient(STATE_BLOB);
}

async function readState() {
  const blob = await getBlobClient();
  const exists = await blob.exists();

  if (!exists) return null;

  const buffer = await blob.downloadToBuffer();
  const text = buffer.toString("utf8").trim();

  if (!text) return null;

  return JSON.parse(text);
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") return JSON.parse(req.body);
  return req.body;
}

module.exports = async function (context, req) {
  try {
    if (req.method === "GET") {
      const current = await readState();

      if (!current) {
        context.res = response(200, {
          empty: true,
          state: null,
          users: [],
          revision: 0,
          savedAt: null
        });
        return;
      }

      context.res = response(200, current);
      return;
    }

    const payload = parseBody(req);

    if (!payload.state || typeof payload.state !== "object") {
      context.res = response(400, {
        ok: false,
        error: "payload.state missing"
      });
      return;
    }

    const current = await readState();
    const revision = Number(current && current.revision ? current.revision : 0) + 1;

    const toSave = {
      build: "ExportHUB Teamdaten",
      revision,
      savedAt: new Date().toISOString(),
      savedBy: payload.user || "unknown",
      state: payload.state,
      users: Array.isArray(payload.users) ? payload.users : []
    };

    const blob = await getBlobClient();
    const json = JSON.stringify(toSave);

    await blob.upload(json, Buffer.byteLength(json), {
      blobHTTPHeaders: {
        blobContentType: "application/json; charset=utf-8"
      }
    });

    context.res = response(200, {
      ok: true,
      revision,
      savedAt: toSave.savedAt
    });
  } catch (err) {
    context.log.error(err);

    context.res = response(500, {
      ok: false,
      error: err.message || String(err)
    });
  }
};
