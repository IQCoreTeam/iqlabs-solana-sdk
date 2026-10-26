# SDK refresh: local execution evidence

Checked 2026-10-25 on Surfpool 1.6.1, offline loopback, normal 400 ms slots, signature and blockhash verification enabled. Disposable wallets and simulated funds only. No public-chain writes.

The combined local SDK candidate d4e4b2f71e45bb317dd0e87110237682373d66f6 contains refreshed #25, #26 and #27 on target ee6edf81d8f873fee47449d7d1bc38482fd6b8ff. Each separate PR candidate and the combined SDK passed build, SDK tests and contract smoke. The combined regression suite covers 51 cases plus both smoke suites.

## Signed execution

- 51 versioned and 87 legacy successful receipts: interrupt/resume after first chunk, finalization-only retry without repeated chunks, changed-content new session and interrupted 40 KB writeRow. Every completed value read back exactly.
- 7 additional successful receipts for fresh connection setup/request/approval. Both wallets discover the correct table once, first pending and then approved.
- 8 bounded exact readbacks and 24 expected byte/chunk/history limit rejections against those actual local inscription receipts.

The adjacent JSON files contain the 145 successful transaction receipts and result summaries. They contain generated test public addresses and signatures; no private keys. The upload tests are reproducible with tests/local/session_resume.ts from #25 and docs/surfpool-testing.md. The extra reader/discovery runner remains in the local QA evidence folder.

The existing 10-case session_writer regression separately covers writer filtering together with read limits in bulk and sequential readers. No live commercial bulk RPC was used.

## Scope

This was a fresh process and fresh test wallets using a separate copy of saved IQ program/state, not a fresh download or rebuild of today's deployed contract. The cached program-data SHA-256 is 90f9cdd27842bbb0522595e1bada646d62642cce0fe6a696a601ad57bb1ad34c (749901 bytes). Deployed-bytecode equivalence, physical wallets, provider quotas and production acceptance are unverified. This PR does not release an npm package.
