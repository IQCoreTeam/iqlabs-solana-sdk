import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {Keypair, PublicKey} from "@solana/web3.js";
import {keccak_256} from "@noble/hashes/sha3";

import {
  chooseRpcUrlForFreshness,
  detectConnectionSettings,
} from "../../src/sdk/utils/connection_helper";
import { ReplayServiceClient } from "../../src/sdk/reader/replayservice";
import {
  deriveDmSeed,
  deriveSeedBytes,
  sortPubkeys,
  toSeedBytes,
} from "../../src/sdk/utils/seed";
import {
  CONNECTION_BLOCKER_NONE,
  CONNECTION_STATUS_APPROVED,
  CONNECTION_STATUS_BLOCKED,
  CONNECTION_STATUS_PENDING,
} from "../../src/contract";
import {evaluateConnectionAccess} from "../../src/sdk/utils/global_fetch";

const ENV_KEYS = [
  "IQLABS_RPC_ENDPOINT",
  "SOLANA_RPC_ENDPOINT",
  "SOLANA_RPC",
  "RPC_ENDPOINT",
  "RPC_URL",
  "HELIUS_RPC_URL",
  "ZEROBLOCK_RPC_URL",
  "FRESH_RPC_URL",
  "RECENT_RPC_URL",
];

const backupEnv = (): Map<string, string | undefined> => {
  const backup = new Map<string, string | undefined>();
  for (const key of ENV_KEYS) {
    backup.set(key, process.env[key]);
  }
  return backup;
};

const restoreEnv = (snapshot: Map<string, string | undefined>) => {
  for (const key of ENV_KEYS) {
    const value = snapshot.get(key);
    if (typeof value === "string") {
      process.env[key] = value;
    } else {
      delete process.env[key];
    }
  }
};

async function testConnectionHelper() {
  const snapshot = backupEnv();
  try {
    process.env.IQLABS_RPC_ENDPOINT = "https://rpc.primary";
    process.env.HELIUS_RPC_URL = "https://rpc.helius";
    process.env.ZEROBLOCK_RPC_URL = "https://rpc.zeroblock";
    process.env.FRESH_RPC_URL = "https://rpc.fresh";
    process.env.RECENT_RPC_URL = "https://rpc.recent";

    const settings = detectConnectionSettings();
    assert.equal(settings.rpcUrl, "https://rpc.primary");
    assert.equal(settings.heliusRpcUrl, "https://rpc.helius");
    assert.equal(settings.zeroBlockRpcUrl, "https://rpc.zeroblock");

    assert.equal(chooseRpcUrlForFreshness("fresh"), "https://rpc.fresh");
    assert.equal(chooseRpcUrlForFreshness("recent"), "https://rpc.recent");
    assert.equal(chooseRpcUrlForFreshness("archive"), "https://rpc.primary");
  } finally {
    restoreEnv(snapshot);
  }
}

type FetchCall = {
  url: string;
  init?: RequestInit;
};

const createJsonResponse = (data: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    ...init,
  });

async function testReplayServiceClient() {
  const baseUrl = "https://example.com/api";
  const jobId = randomUUID();
  const calls: FetchCall[] = [];
  const binaryData = new Uint8Array([1, 2, 3, 4]);

  const mockFetch: typeof fetch = async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    calls.push({ url, init });

    if (url === `${baseUrl}/replay`) {
      return createJsonResponse({
        jobId,
        status: "queued",
        retryAfter: 1,
        estimatedWaitMs: 10,
      });
    }
    if (url === `${baseUrl}/replay/${jobId}`) {
      return createJsonResponse({
        jobId,
        status: "done",
        hasArtifact: true,
        downloadUrl: `${baseUrl}/replay/${jobId}/download`,
      });
    }
    if (url === `${baseUrl}/replay/${jobId}/logs`) {
      return createJsonResponse({ entries: 3 });
    }
    if (url === `${baseUrl}/replay/${jobId}/download`) {
      return new Response(binaryData, {
        status: 200,
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": 'attachment; filename="dump.bin"',
        },
      });
    }
    throw new Error(`Unhandled fetch url: ${url}`);
  };

  const client = new ReplayServiceClient({
    replayBaseUrl: baseUrl,
    fetcher: mockFetch,
    headers: { "X-Test": "sdk" },
  });

  const enqueue = await client.enqueueReplay({ sessionPubkey: "session" });
  assert.equal(enqueue.jobId, jobId);
  assert.equal(enqueue.status, "queued");

  const status = await client.getReplayStatus(jobId);
  assert.equal(status.hasArtifact, true);
  assert.equal(status.downloadUrl, `${baseUrl}/replay/${jobId}/download`);

  const logs = await client.getReplayLogs(jobId);
  assert.equal((logs as { entries: number }).entries, 3);

  const download = await client.downloadReplay(jobId);
  assert.deepEqual(Array.from(download.data), Array.from(binaryData));
  assert.equal(download.contentType, "application/octet-stream");
  assert.equal(download.filename, "dump.bin");

  assert.equal(calls.length, 4);
  const postCall = calls[0];
  assert.equal(postCall.url, `${baseUrl}/replay`);
  assert.equal(postCall.init?.method ?? "POST", "POST");
  const payload = postCall.init?.body
    ? JSON.parse(String(postCall.init.body))
    : null;
  assert.equal(payload.sessionPubkey, "session");
}

async function testReplayServiceMissingBase() {
  const client = new ReplayServiceClient({
    fetcher: async () => {
      throw new Error("fetch should not be called");
    },
  });
  await assert.rejects(
    () => client.enqueueReplay({ sessionPubkey: "session" }),
    /baseUrl/i,
  );
}

function bytesToHex(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("hex");
}

async function testSeedUtils() {
  const hex =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const bytes = deriveSeedBytes(hex);
  assert.equal(bytesToHex(bytes), hex);

  const text = "iq-labs";
  const hashed = deriveSeedBytes(text);
  const expected = keccak_256(Buffer.from(text, "utf8"));
  assert.equal(bytesToHex(hashed), bytesToHex(expected));

  const [a, b] = sortPubkeys("z-user", "a-user");
  assert.equal(a, "a-user");
  assert.equal(b, "z-user");

  const dmSeed = deriveDmSeed("user-2", "user-1");
  const manual = keccak_256(Buffer.from("user-1:user-2", "utf8"));
  assert.equal(bytesToHex(dmSeed), bytesToHex(manual));

  const sample = new Uint8Array([5, 6, 7]);
  assert.equal(toSeedBytes(sample), sample);
  const viaString = toSeedBytes("abc");
  assert.notEqual(viaString, sample);
}

async function testEvaluateConnectionAccess() {
  const partyA = Keypair.generate().publicKey;
  const partyB = Keypair.generate().publicKey;
  const gateMint = Keypair.generate().publicKey;

  const baseMeta = {
    columns: [],
    idCol: "id",
    extKeys: [],
    name: "dm",
    gateMint,
    partyA,
    partyB,
    status: CONNECTION_STATUS_PENDING,
    requester: 0,
    blocker: CONNECTION_BLOCKER_NONE,
  };

  const evaluate = (
    overrides: Partial<typeof baseMeta>,
    signer: PublicKey,
  ) => {
    const meta = {...baseMeta, ...overrides};
    return evaluateConnectionAccess(meta, signer);
  };

  const pendingRequester = evaluate({}, partyA);
  assert.deepEqual(pendingRequester, {
    allowed: false,
    status: "pending",
    message: "Ask the other party to open the connection.",
  });

  const pendingOther = evaluate({}, partyB);
  assert.deepEqual(pendingOther, {
    allowed: false,
    status: "pending",
    message: "Allow the connection in settings.",
  });

  const approved = evaluate(
    {status: CONNECTION_STATUS_APPROVED},
    partyA,
  );
  assert.deepEqual(approved, {allowed: true, status: "approved"});

  const blockedByA = evaluate(
    {status: CONNECTION_STATUS_BLOCKED, blocker: 0},
    partyA,
  );
  assert.deepEqual(blockedByA, {
    allowed: false,
    status: "blocked",
    message: "Allow the connection in settings.",
  });

  const blockedByOther = evaluate(
    {status: CONNECTION_STATUS_BLOCKED, blocker: 1},
    partyA,
  );
  assert.deepEqual(blockedByOther, {
    allowed: false,
    status: "blocked",
    message: "Ask the other party to unblock the connection.",
  });

  const outsider = evaluate({}, Keypair.generate().publicKey);
  assert.deepEqual(outsider, {
    allowed: false,
    status: "pending",
    message: "signer is not a connection participant",
  });
}

async function main() {
  await testConnectionHelper();
  await testReplayServiceClient();
  await testReplayServiceMissingBase();
  await testSeedUtils();
  await testEvaluateConnectionAccess();
  console.log("sdk smoke test ok");
}

main().catch((error) => {
  console.error("sdk smoke test failed", error);
  process.exitCode = 1;
});
