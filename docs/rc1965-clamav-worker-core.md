# RC1965 – offline testable ClamAV worker core (P0 #1329)

**Status:** code/test preparation only. The existing ABD_SCAN_PENDING protection is NOT fixed. No Azure provisioning, new charges, Defender activation, PR merge or production change.

## Verified context and cloud choice

TESTSERVICE is configured for storage account exporthubtestde89. The owner observed the Defender activation offer and rejected the monthly fee. There is no always-on company server. A scale-to-zero **Azure Container Apps Consumption Event Job** is the technically preferred cloud candidate, but compute free grants are subscription-shared, while Queue, Registry, Storage, logging and networking may incur charges.

Official references:
- https://learn.microsoft.com/en-us/azure/container-apps/jobs
- https://learn.microsoft.com/en-us/azure/container-apps/billing
- https://docs.clamav.net/manual/Installing/Docker.html

## What the code actually does

tools/rc1965-clamav/isolated-scan-core.cjs combines the still-inert HMAC queue candidate (RC1964), local immutable-snapshot ClamAV prototype (RC1956), and candidate proof (RC1963).

1. Reject any unsigned, expired, changed or non-TESTSERVICE queue candidate before accessing data.
2. Require a trusted, **atomic one-time job claim** adapter; duplicate or unavailable jobs fail closed.
3. Read a fixed-scope Blob snapshot through a trusted injected adapter only (no Azure SDK or customer data access in this code).
4. Compare ETag, byte length and SHA-256 against signed original; stage private 0700 directory and 0600 file.
5. Read trusted ClamAV signature metadata **before** scanning, then invoke the RC1956 scanner using a second private immutable copy; any malware/error/timeout blocks.
6. Read the Blob **again** and compare its ETag, SHA-256 and byte length; re-read signature metadata **after** scanning and reject any change. Only the unchanged **pre-scan** value may enter a signed, short-lived candidate proof. A deployed adapter must also attest that the inspected metadata belongs to the engine's actually loaded signatures, not just a newer file on disk.
7. Remove both staged files; cleanup failure invalidates positive evidence. Never echo paths, keys, customer filenames or low-level scanner errors.

**No trust escalation:** Every result carries authorizedForRelease:false, dispatchAuthorized:false and deployAuthorized:false. The receipt itself also has authorizedForRelease:false. The current production API still requires the original genuine Defender clean tag; it is NOT wired to this helper.

**RC1967 bounded Azure read:** The inert RC1966 `createBoundedReadSnapshot` adapter now has a fixed 35-second maximum per snapshot, with one AbortSignal shared across the conditional properties request, byte-range download, and response stream. A stalled response stream is explicitly destroyed; timeout errors remain sanitized and fail closed. The future trusted Azure worker still needs an independent hard execution deadline and Azure SDK authentication/authorization controls. This does not attest scan success or allow analysis.

## Remaining gates before a working TESTSERVICE scanner

- [ ] Prove zero additional total Azure cost, including existing subscription consumption and all side resources; otherwise STOP until the owner explicitly authorizes a budget.
- [ ] Provide pinned/up-to-date and independently verified ClamAV container image and signatures; synthetic mocked scanner success in tests is NOT a real AV pass.
- [ ] Use Managed Identity and fixed TESTSERVICE quarantine; no upload-supplied URL, SAS, key or arbitrary path.
- [ ] Implement capped SDK download with conditional ETag/blob version, trusted metadata and independently computed hash.
- [ ] Implement a durable Azure-backed atomic claim, bounded retry/poison queue and identity-bound one-time attestation. Injected adapters in the prototype do NOT implement any of these trusted services.
- [ ] Prove EICAR, clean, malware-positive, encrypted/macro/ZIP-bomb, invalid signatures, changed blob and failure cases with actual ClamAV.
- [ ] Authenticated TESTSERVICE upload -> genuine server-verified clean -> positions -> editor E2E; then full security, CI and separate explicit deployment approvals.

No cloud job has been deployed. Existing ABD_SCAN_PENDING remains a fail-closed blocker, without any fake clean tag or fallback.

## RC1966 – Bounded Azure Blob reader (still offline)

`tools/rc1966-clamav/bounded-blob-snapshot.cjs` is a **dependency-injected,
unconnected** Azure-SDK-compatible reader that a future isolated worker can
use. It does not authenticate, create an Azure client, open a network connection
or interact with the running ExportHUB API on its own.

- Exact blob identity is derived from the existing ABD quarantine scheme:
  `rc1294/testservice/<scopeHash>/<uploadSha256>-<uploadNonce>.<kind>`.
  The worker context must supply the **SHA-256 of this complete blob name**
  as `blobKeyHash`; if it differs, the read adapter refuses the job.
- A future trusted worker must supply the TESTSERVICE-only authorized
  `ContainerClient` via managed identity. A request or browser **cannot**
  select an arbitrary storage account, container, blob path or URL.
- Before the download the adapter checks the Blob's ETag, `BlockBlob` type
  and exact length; the SDK's Blob `download(0, length, ...)` call is
  conditional on `ifMatch`, sets `maxRetryRequests:0` and limits the range.
  A bounded stream additionally rejects too many bytes, missing data,
  changed ETag or content-length inconsistencies.
- SHA-256 of actual bytes must match the signed original. Every error is
  reduced to `RC1966_BLOB_UNVERIFIED`, without revealing Azure internals.
- The RC1965 worker already reads twice and rechecks ETag/hash. This adapter
  is intentionally **not connected** to the RC1965 runner or `api/abd-analysis`
  until a fully restricted, independently audited Azure worker exists.

**Operational limits:** The future queue issuance must derive `blobKeyHash`
from the server-owned blob name, enforce the correct account/container and
bind the job to a durable atomic claim. The current HMAC candidate proof
does not attest Azure resource ownership, provider identity or antivirus
signature status. An Azure ETag is a conditional-read guard, **not** an
immutable version ID or standalone release permit.

No real Azure reads or charges were performed by this patch. The local
synthetic adapter checks passed; the complete repository CI must be
independently successful before any merge. **Do not rerun cancelled CI
automatically or weaken gates.**

Azure API references:
- https://learn.microsoft.com/en-us/javascript/api/@azure/storage-blob/blobclient
- https://learn.microsoft.com/en-us/javascript/api/@azure/storage-blob/blobdownloadoptions
- https://learn.microsoft.com/en-us/javascript/api/@azure/storage-blob/blobrequestconditions

## RC1968 – Hard deadline even when SDK ignores cancellation

A specific failure mode remained in RC1967: the AbortController timeout
only signalled the SDK, but a noncooperative or stalled
`getProperties()`, `download()` or async stream iterator could ignore the
signal and leave the awaited Promise unresolved indefinitely.

RC1968 now races the complete read against a separate bounded rejection.
The active stream is destroyed when the deadline fires. A download response
that resolves **after** the deadline is still adopted and its stream
destroyed before its data can be accepted. All errors return only
`RC1966_BLOB_UNVERIFIED` and never authorize parsing.

Three isolated synthetic tests cover an SDK ignoring the abort signal,
a late download response and an iterator that never returns. This is still
not a live Azure test or a guarantee that a noncooperative underlying SDK
task frees every resource instantly: a separately enforced container/job
execution timeout remains mandatory.

No Azure client, queue, Container Apps job or paid resource was created.
The existing ABD API and its scan gate remain untouched; no deployment
is authorized by this change.
