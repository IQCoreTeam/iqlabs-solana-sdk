import assert from "node:assert/strict";
import {Connection, Keypair, PublicKey, Transaction} from "@solana/web3.js";
import {createInstructionBuilder, postChunkInstruction, userInventoryCodeInInstruction, getUserInventoryPda, PROGRAM_ID} from "../../src/contract";
import {readUserInventoryCodeInFromTx} from "../../src/sdk/reader/reading_flow";
import {readSessionResult} from "../../src/sdk/reader/reading_methods";
import {ReadBudget} from "../../src/sdk/reader/read_limits";
import {setRpcUrl} from "../../src/sdk/utils/connection_helper";

const builder = createInstructionBuilder(require("../../idl/code_in.json"), PROGRAM_ID);
const writer = Keypair.fromSeed(new Uint8Array(32).fill(1)).publicKey;
const intruder = Keypair.fromSeed(new Uint8Array(32).fill(3)).publicKey;
const session = Keypair.fromSeed(new Uint8Array(32).fill(2)).publicKey;
const original = {fetch: globalThis.fetch, account: Connection.prototype.getAccountInfo,
    signatures: Connection.prototype.getSignaturesForAddress, transaction: Connection.prototype.getTransaction};
const speed = {maxRps: 0, maxConcurrency: 1};
function tx(payer: PublicKey, instruction: any): any {
    const transaction = new Transaction({feePayer: payer, recentBlockhash: PublicKey.default.toBase58()}).add(instruction);
    return {blockTime: Math.floor(Date.now()/1000), transaction: {message: transaction.compileMessage()}, meta: {err: null}};
}
function chunk(payer: PublicKey, index: number, text: string) {
    return tx(payer, postChunkInstruction(builder, {user: payer, session}, {index, chunk: text, method: 0, decode_break: 0}));
}
const envelope = tx(writer, userInventoryCodeInInstruction(builder, {
    user: writer, user_inventory: getUserInventoryPda(writer), receiver: writer,
}, {on_chain_path: session.toBase58(), metadata: JSON.stringify({total_chunks: 2}), session: null}));
function raw(transaction: any) {
    const message = transaction.transaction.message;
    return {...transaction, transaction: {message: {header: message.header,
        accountKeys: message.accountKeys.map((key: PublicKey) => key.toBase58()), instructions: message.instructions}}};
}
let passed = 0;
async function main() {
    setRpcUrl("https://qa.helius-rpc.com");
    for (const bulk of [true, false]) {
        let transactions = [chunk(writer, 0, "hello "), chunk(intruder, 0, "INJECTED"), chunk(writer, 1, "world"), chunk(intruder, 1, "BAD")];
        globalThis.fetch = (async () => Response.json(bulk
            ? {result: {data: transactions.map(raw)}} : {error: {code: -32601, message: "bulk unavailable"}})) as typeof fetch;
        Connection.prototype.getSignaturesForAddress = (async () => transactions.map((_, i) => ({signature: String(i)}))) as any;
        Connection.prototype.getTransaction = (async (signature: string) => transactions[Number(signature)]) as any;
        Connection.prototype.getAccountInfo = (async () => {
            const data = Buffer.alloc(14); data.writeUInt32LE(2, 9); data[13] = 1;
            return {data};
        }) as any;
        assert.equal((await readUserInventoryCodeInFromTx(envelope, speed, undefined, {maxBytes: 11, maxChunks: 2, maxHistoryTransactions: 10})).data, "hello world"); passed++;
        await assert.rejects(() => readUserInventoryCodeInFromTx(envelope, speed, undefined, {maxBytes: 10, maxHistoryTransactions: 10}), /maxBytes/); passed++;
        await assert.rejects(() => readUserInventoryCodeInFromTx(envelope, speed, undefined, {maxHistoryTransactions: 1}), /maxHistoryTransactions/); passed++;
        // Direct optional writer argument retains Zo's API and filters both paths.
        assert.equal((await readSessionResult(session.toBase58(), {}, speed, undefined, writer.toBase58(), new ReadBudget())).result, "hello world"); passed++;
        transactions = [chunk(writer, 0, "hello "), chunk(intruder, 1, "world")];
        await assert.rejects(() => readUserInventoryCodeInFromTx(envelope, speed), /incomplete session/); passed++;
        console.log(`writer + limits: ${bulk ? "bulk" : "sequential"} passed`);
    }
    console.log(`session writer: ${passed} cases passed; no network or chain writes`);
}
main().finally(() => {
    globalThis.fetch = original.fetch;
    Connection.prototype.getAccountInfo = original.account;
    Connection.prototype.getSignaturesForAddress = original.signatures;
    Connection.prototype.getTransaction = original.transaction;
}).catch(error => {console.error(error); process.exitCode = 1;});
