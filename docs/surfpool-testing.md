# Test IQ writes locally with Surfpool

Surfpool runs a local Solana execution environment. Point the real SDK at it,
sign with a disposable test wallet, and use a local airdrop. This is useful for
repeated upload, account-setup, error and resume tests without spending real SOL.
It does not emulate a commercial RPC provider's quotas or prove a production deployment works.

The same local instance can test an application's funding/refund flow and gateway
readback. The companion IQ6900 local test uploads synthetic text and an original
WAV through `writer.writeRow`; the gateway route test reconstructs that WAV and
checks byte ranges. Those tests live with their respective application patches,
not in this SDK. The fresh-wallet application run passed with 37 receipts and a
zero remaining burner balance. Its deliberate interruption requires this SDK
resume patch; published 0.3.6 alone does not contain it.

## Start a prepared local environment

The commands below were checked with Surfpool 1.6.0. Check `surfpool start --help`
for your installed version. Linux, macOS and Ubuntu/WSL can run this workflow.

For a fully offline run, use a working copy of a saved Surfpool database that
already contains the IQ program and its dependencies:

```sh
surfpool start --offline \
  --host 127.0.0.1 --port 19109 --ws-port 19110 \
  --no-deploy --no-tui --no-studio --airdrop-amount 0 \
  --slot-time 400 --db ./iq-local-test.sqlite
```

An empty offline database cannot fetch missing accounts or programs. For a fresh
project, deploy your contract build through its own local deployment runbook, or
load a reviewed account snapshot with `--snapshot ./iq-accounts.json`. A snapshot
must include its actual account data, not null entries that require upstream reads.
Do not distribute a whole development database without checking what it contains.

For a separate **devnet-backed** local fork, replace `--offline` with
`--network devnet`, using a separate database and the corresponding deployed
program configuration. That can make upstream reads and consume RPC quota even
though writes execute locally. We did not exercise that mode in this verification.

Keep signature and blockhash validation enabled. `--no-deploy` disables automatic
runbooks; it does not redirect an SDK connection or make a production wallet safe.
Use an explicit loopback endpoint for every connection, including SDK internal reads.

## Run the tests

From this SDK checkout after installing dependencies:

```sh
npm run build
npm run test:contract
npm run test:sdk

IQ_LOCAL_RPC=http://127.0.0.1:19109 \
IQ_TEST_REPORT=/tmp/iq-resume-results.json \
  npx --no-install tsx tests/local/session_resume.ts
```

The last test is opt-in. It rejects other RPC destinations and the mainnet
genesis hash, generates its own key in memory, and requests 5 simulated SOL.
No wallet key is written to its report. The test uses synthetic text, including
a 40 KB JSON row in a new local database; no external content is needed.

To exercise the legacy transaction path as well, repeat the last command with
`IQ_TX_PROFILE=legacy` and a different report filename. The default run detects
the enabled transaction profile from the local instance.

It exercises the public `codeIn` and `writeRow` paths, not a replacement uploader:

1. Interrupt after the first confirmed chunk, retry, and check that the session
   counter does not advance again and only missing chunks are sent.
2. Interrupt immediately before finalization; retry should submit one transaction.
3. Change the already uploaded content; the retry should allocate a new session.
4. Repeat interruption/resume through `writeRow`, as inscription apps use it.
5. Read every completed value back through `readCodeIn` and compare exact bytes.
6. Require a successful receipt for every submitted transaction.

Unit tests separately cover normal/expired confirmations with execution errors,
encoding mismatches, finalized sessions, conflicting chunk history and unavailable
history. These tests use mocked local connections and require no running chain.

## Resume behavior and limits

The tested contract increments `total_session_files` during `create_session`.
The resume patch checks the latest unfinished session at the previous sequence
and reuses it only when all recorded chunks match the requested bytes and encoding.
Conflicting historical chunks cannot be safely reused. The returned session and
sequence are also used for finalization; changing only the uploader is insufficient.

Keep uploads serialized per signing wallet. This test does not establish safety
for concurrent uploads or writes still in flight from a separate process. An
unavailable transaction history causes a read error before additional writes;
it is not treated as proof that the session is empty.

## Evidence and interpretation

The September 22 synthetic run passed four scenarios with **51 successful receipts**.
The unpatched 0.3.6 source failed the same public-API test: retry after the first
chunk sent 11 transactions where 10 were expected. After the patch, that retry
sent 10; finalization-only retry sent one. The 40 KB `writeRow` retry sent 12,
including its finalization. Exact readback passed in all four completed scenarios.

The same four scenarios also passed with `IQ_TX_PROFILE=legacy`: **87 successful
receipts**, with 48 writes for the interrupted 40 KB row retry versus 12 in the v1
run. This is a synthetic functional comparison, not a general fee or speed claim.

The local fixture used 100 ms slots for iteration. Do not quote these runtimes as
mainnet performance. The program came from saved local state; source inspection
agreed with the observed counter behavior, but no live mainnet check was performed.

Save the source revision, runtime versions, fixture identity, receipts and readback
results. Keep secrets, generated wallets and databases out of commits. Back up a
stopped database, or use SQLite's backup mechanism if it is running.

The current IQ gateway production startup accepts named-network genesis hashes
and rejects this Surfpool genesis hash. SDK tests need no gateway. Gateway route
integration can use an isolated local harness; do not bypass the production
startup check and then claim a complete production boot was verified.

Official references: [Surfpool source](https://github.com/solana-foundation/surfpool),
[CLI documentation](https://docs.surfpool.run/toolchain/cli).
