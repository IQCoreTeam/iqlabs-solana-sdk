import assert from "node:assert/strict";
import {Connection, Keypair, PublicKey, Transaction} from "@solana/web3.js";
import {createInstructionBuilder, postChunkInstruction, PROGRAM_ID} from "../../src/contract";
import {readSessionResult} from "../../src/sdk/reader/reading_methods";
import {setRpcUrl} from "../../src/sdk/utils/connection_helper";

const builder = createInstructionBuilder(require("../../idl/code_in.json"), PROGRAM_ID);
const user = Keypair.fromSeed(new Uint8Array(32).fill(1)).publicKey;
const session = Keypair.fromSeed(new Uint8Array(32).fill(2)).publicKey;
const chunks = ["안녕하세요 ", "아이큐랩스 🦭", " 함께 만들어요."];
const originalFetch = globalThis.fetch;
const originalSignatures = Connection.prototype.getSignaturesForAddress;
const originalTransaction = Connection.prototype.getTransaction;
let passed = 0;

function fixture(index: number, failed = false) {
  const tx = new Transaction({feePayer:user, recentBlockhash:PublicKey.default.toBase58()});
  tx.add(postChunkInstruction(builder, {user, session}, {index, chunk:chunks[index] ?? "추가", method:0, decode_break:0}));
  return {transaction:{message:tx.compileMessage()}, meta:{err:failed ? {InstructionError:[0,"InvalidArgument"]} : null}};
}

async function main() {
  setRpcUrl("https://qa.helius-rpc.com");
  for (const bulk of [true, false]) {
    for (const scenario of ["complete","missing-middle","missing-tail","failed-chunk","unexpected-index"]) {
      const indexes = scenario === "missing-middle" ? [0,2] : scenario === "missing-tail" ? [0,1] : scenario === "unexpected-index" ? [0,1,3] : [2,0,1];
      const transactions = indexes.map(index => fixture(index, scenario === "failed-chunk" && index === 1));
      globalThis.fetch = async () => new Response(JSON.stringify(bulk ? {result:{data:transactions.map(t => ({...t,transaction:{message:{accountKeys:t.transaction.message.accountKeys.map(k=>k.toBase58()),instructions:t.transaction.message.instructions}}}))}} : {error:{code:-32601,message:"Fixture: bulk unavailable"}}), {headers:{"content-type":"application/json"}});
      Connection.prototype.getSignaturesForAddress = async () => transactions.map((_,i)=>({signature:String(i)})) as any;
      Connection.prototype.getTransaction = (async (signature: string) => transactions[Number(signature)]) as any;
      const read = () => readSessionResult(session.toBase58(), {}, {maxRps:0,maxConcurrency:1}, undefined, 3);
      if (scenario === "complete") assert.equal((await read()).result, chunks.join(""));
      else await assert.rejects(read, /incomplete session/);
      passed++;
    }
  }
  console.log(`session completeness: ${passed} cases passed (bulk + sequential, Korean text)`);
}
main().finally(() => {
  globalThis.fetch = originalFetch;
  Connection.prototype.getSignaturesForAddress = originalSignatures;
  Connection.prototype.getTransaction = originalTransaction;
}).catch(e => {console.error(e);process.exitCode=1;});
