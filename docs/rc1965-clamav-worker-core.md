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
5. Invoke the RC1956 scanner using a second private immutable copy; any malware/error/timeout blocks.
6. Read the Blob **again** and compare its ETag, SHA-256 and byte length before generating a signed, short-lived candidate proof.
7. Remove both staged files; cleanup failure invalidates positive evidence. Never echo paths, keys, customer filenames or low-level scanner errors.

**No trust escalation:** Every result carries authorizedForRelease:false, dispatchAuthorized:false and deployAuthorized:false. The receipt itself also has authorizedForRelease:false. The current production API still requires the original genuine Defender clean tag; it is NOT wired to this helper.

## Remaining gates before a working TESTSERVICE scanner

- [ ] Prove zero additional total Azure cost, including existing subscription consumption and all side resources; otherwise STOP until the owner explicitly authorizes a budget.
- [ ] Provide pinned/up-to-date and independently verified ClamAV container image and signatures; synthetic mocked scanner success in tests is NOT a real AV pass.
- [ ] Use Managed Identity and fixed TESTSERVICE quarantine; no upload-supplied URL, SAS, key or arbitrary path.
- [ ] Implement capped SDK download with conditional ETag/blob version, trusted metadata and independently computed hash.
- [ ] Implement a durable Azure-backed atomic claim, bounded retry/poison queue and identity-bound one-time attestation. Injected adapters in the prototype do NOT implement any of these trusted services.
- [ ] Prove EICAR, clean, malware-positive, encrypted/macro/ZIP-bomb, invalid signatures, changed blob and failure cases with actual ClamAV.
- [ ] Authenticated TESTSERVICE upload -> genuine server-verified clean -> positions -> editor E2E; then full security, CI and separate explicit deployment approvals.

No cloud job has been deployed. Existing ABD_SCAN_PENDING remains a fail-closed blocker, without any fake clean tag or fallback.
