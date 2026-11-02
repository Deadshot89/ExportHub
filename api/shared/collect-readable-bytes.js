'use strict';

// P0 #1159: Azure team-state blobs can exceed 60 MB. Reusing the Buffer
// already produced by the REST transport avoids two more full-blob copies:
// Buffer.from(buffer) and Buffer.concat([buffer]).
async function collectReadableBytes(readable) {
  const chunks=[];
  let total=0;
  for await (const chunk of readable) {
    const buffer=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);
    chunks.push(buffer);
    total+=buffer.length;
  }
  if(chunks.length===0)return Buffer.alloc(0);
  if(chunks.length===1)return chunks[0];
  return Buffer.concat(chunks,total);
}

module.exports={collectReadableBytes};
