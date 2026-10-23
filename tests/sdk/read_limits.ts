import assert from "node:assert/strict";
import {Connection, Keypair, PublicKey, Transaction} from "@solana/web3.js";
import {
    createInstructionBuilder, postChunkInstruction, sendCodeInstruction,
    userInventoryCodeInInstruction, getUserInventoryPda, PROGRAM_ID,
} from "../../src/contract";
import {readUserInventoryCodeInFromTx} from "../../src/sdk/reader/reading_flow";
import {setRpcUrl} from "../../src/sdk/utils/connection_helper";

const builder = createInstructionBuilder(require("../../idl/code_in.json"), PROGRAM_ID);
const user = Keypair.fromSeed(new Uint8Array(32).fill(1)).publicKey;
const session = Keypair.fromSeed(new Uint8Array(32).fill(2)).publicKey;
const original = {
    fetch: globalThis.fetch,
    account: Connection.prototype.getAccountInfo,
    signatures: Connection.prototype.getSignaturesForAddress,
    transaction: Connection.prototype.getTransaction,
};
const speed = {maxRps: 0, maxConcurrency: 1};
let calls: {account: number; signatures: number[]; transaction: string[]; bulk: number[]};
let passed = 0;
function transaction(instruction: any): any {
    const tx = new Transaction({feePayer: user, recentBlockhash: PublicKey.default.toBase58()}).add(instruction);
    return {blockTime: Math.floor(Date.now() / 1000), transaction: {message: tx.compileMessage()}, meta: {err: null}};
}
function envelope(path: string, count = 1, data = "hello") {
    return transaction(userInventoryCodeInInstruction(builder, {
        user, user_inventory: getUserInventoryPda(user), receiver: user,
    }, {on_chain_path: path, metadata: JSON.stringify({total_chunks: count, data}), session: null}));
}
function link(code: string, before: string) {
    return transaction(sendCodeInstruction(builder, {user, code_account: session}, {
        code, before_tx: before, method: 0, decode_break: 0,
    }));
}
function chunk(index: number, text: string) {
    return transaction(postChunkInstruction(builder, {user, session}, {
        index, chunk: text, method: 0, decode_break: 0,
    }));
}
function raw(tx: any) {
    return {...tx, transaction: {message: {
        header: tx.transaction.message.header,
        accountKeys: tx.transaction.message.accountKeys.map((key: PublicKey) => key.toBase58()),
        instructions: tx.transaction.message.instructions,
    }}};
}
function setup(chunks = ["a", "b"], header = chunks.length) {
    calls = {account: 0, signatures: [], transaction: [], bulk: []};
    setRpcUrl("http://local.test.invalid");
    Connection.prototype.getAccountInfo = (async () => {
        calls.account++;
        const data = Buffer.alloc(14);
        data.writeUInt32LE(header, 9); data[13] = 1;
        return {data};
    }) as any;
    Connection.prototype.getSignaturesForAddress = (async (_key: PublicKey, options: any) => {
        calls.signatures.push(options.limit);
        return chunks.map((_, index) => ({signature: String(index)}));
    }) as any;
    Connection.prototype.getTransaction = (async (signature: string) => {
        calls.transaction.push(signature);
        return chunk(Number(signature), chunks[Number(signature)]);
    }) as any;
    globalThis.fetch = async (_input, options) => {
        calls.bulk.push(JSON.parse(options!.body as string).params[1].limit);
        throw new Error("Unexpected external fetch");
    };
}
async function check(name: string, run: () => Promise<void>) {
    await run(); passed++; console.log(`pass: ${name}`);
}
async function main() {
    await check("inline UTF-8 byte limit and invalid limits need no RPC", async () => {
        setup();
        await assert.rejects(() => readUserInventoryCodeInFromTx(envelope("", 1, "éé"), speed, undefined, {maxBytes: 3}), /maxBytes/);
        await assert.rejects(() => readUserInventoryCodeInFromTx(envelope(""), speed, undefined, {maxChunks: 0}), /Invalid inscription/);
        assert.deepEqual(calls, {account: 0, signatures: [], transaction: [], bulk: []});
    });
    await check("declared oversized chunks fail before any RPC", async () => {
        setup();
        await assert.rejects(() => readUserInventoryCodeInFromTx(envelope(session.toBase58(), 81), speed, undefined, {maxChunks: 80}), /maxChunks/);
        assert.equal(calls.account, 0);
    });
    for (const limit of ["maxChunks", "maxHistoryTransactions"] as const) {
        await check(`linked walk stops before the next RPC at ${limit}`, async () => {
            setup();
            const tail = "a".repeat(88), middle = "b".repeat(88), head = "c".repeat(88);
            const chain = new Map([[tail, link("c", middle)], [middle, link("b", head)], [head, link("a", "Genesis")]]);
            Connection.prototype.getTransaction = (async (signature: string) => {calls.transaction.push(signature); return chain.get(signature);}) as any;
            await assert.rejects(() => readUserInventoryCodeInFromTx(envelope(tail, 1), speed, undefined, {[limit]: 2}), new RegExp(limit));
            assert.deepEqual(calls.transaction, [tail, middle]);
        });
    }
    await check("linked bytes stop before fetching another chunk", async () => {
        setup();
        Connection.prototype.getTransaction = (async (signature: string) => {calls.transaction.push(signature); return link("éé", "b".repeat(88));}) as any;
        await assert.rejects(() => readUserInventoryCodeInFromTx(envelope("a".repeat(88)), speed, undefined, {maxBytes: 3}), /maxBytes/);
        assert.equal(calls.transaction.length, 1);
    });
    await check("normal linked data and unlimited defaults retain output", async () => {
        for (const limits of [undefined, {maxBytes: 2, maxChunks: 2, maxHistoryTransactions: 2}]) {
            setup();
            Connection.prototype.getTransaction = (async (signature: string) => {calls.transaction.push(signature); return signature[0] === "a" ? link("b", "b".repeat(88)) : link("a", "Genesis");}) as any;
            assert.equal((await readUserInventoryCodeInFromTx(envelope("a".repeat(88), 1), speed, undefined, limits)).data, "ab");
            assert.equal(calls.transaction.length, 2);
        }
    });
    await check("session header count rejects before history lookup", async () => {
        setup(["a"], 81);
        await assert.rejects(() => readUserInventoryCodeInFromTx(envelope(session.toBase58()), speed, undefined, {maxChunks: 80}), /maxChunks/);
        assert.equal(calls.account, 1); assert.deepEqual(calls.signatures, []);
    });
    await check("session pagination cannot exceed history allowance or start hydration", async () => {
        setup(["a", "b"]);
        await assert.rejects(() => readUserInventoryCodeInFromTx(envelope(session.toBase58()), speed, undefined, {maxHistoryTransactions: 2}), /maxHistoryTransactions/);
        assert.deepEqual(calls.signatures, [2]); assert.deepEqual(calls.transaction, []);
    });
    await check("over-returning RPC cannot bypass requested history count", async () => {
        setup(["a", "b", "c"]);
        await assert.rejects(() => readUserInventoryCodeInFromTx(envelope(session.toBase58()), speed, undefined, {maxHistoryTransactions: 2}), /maxHistoryTransactions/);
        assert.deepEqual(calls.signatures, [2]); assert.deepEqual(calls.transaction, []);
    });
    await check("misleading session header cannot bypass actual chunk count", async () => {
        setup(["a", "b", "c", "d"], 1);
        await assert.rejects(() => readUserInventoryCodeInFromTx(envelope(session.toBase58(), 1), speed, undefined, {maxChunks: 2}), /maxChunks/);
        assert.deepEqual(calls.transaction, ["0", "1", "2"]);
    });
    await check("session byte failure stops subsequent sequential hydration", async () => {
        setup(["éé", "b", "c"]);
        await assert.rejects(() => readUserInventoryCodeInFromTx(envelope(session.toBase58()), speed, undefined, {maxBytes: 3}), /maxBytes/);
        assert.deepEqual(calls.transaction, ["0"]);
    });
    await check("parallel workers do not start another RPC after byte failure", async () => {
        setup(["éé", "b", "c", "d"]);
        await assert.rejects(() => readUserInventoryCodeInFromTx(envelope(session.toBase58()), {maxRps: 0, maxConcurrency: 2}, undefined, {maxBytes: 3}), /maxBytes/);
        await new Promise(resolve => setImmediate(resolve));
        assert.deepEqual(calls.transaction, ["0", "1"]);
    });
    await check("normal session and default session preserve reconstruction", async () => {
        for (const limits of [undefined, {maxBytes: 2, maxChunks: 2, maxHistoryTransactions: 3}]) {
            setup();
            assert.equal((await readUserInventoryCodeInFromTx(envelope(session.toBase58()), speed, undefined, limits)).data, "ab");
            assert.deepEqual(calls.transaction, ["0", "1"]);
        }
    });
    await check("bulk pagination stops without fallback when history allowance ends", async () => {
        setup(); setRpcUrl("https://qa.helius-rpc.com");
        globalThis.fetch = async (_url, options) => {
            calls.bulk.push(JSON.parse(options!.body as string).params[1].limit);
            return Response.json({result: {data: [raw(chunk(0,"a")), raw(chunk(1,"b"))], paginationToken: "next"}});
        };
        await assert.rejects(() => readUserInventoryCodeInFromTx(envelope(session.toBase58()), speed, undefined, {maxHistoryTransactions: 2}), /maxHistoryTransactions/);
        assert.deepEqual(calls.bulk, [2]); assert.deepEqual(calls.signatures, []);
    });
    await check("bulk byte failures are not swallowed into fallback", async () => {
        setup(["éé"]); setRpcUrl("https://qa.helius-rpc.com");
        globalThis.fetch = async () => {calls.bulk.push(1); return Response.json({result: {data: [raw(chunk(0,"éé"))]}});};
        await assert.rejects(() => readUserInventoryCodeInFromTx(envelope(session.toBase58()), speed, undefined, {maxBytes: 3}), /maxBytes/);
        assert.deepEqual(calls.signatures, []); assert.deepEqual(calls.transaction, []);
    });
    await check("normal bulk session is reconstructed without sequential RPC", async () => {
        setup(); setRpcUrl("https://qa.helius-rpc.com");
        globalThis.fetch = async (_url, options) => {calls.bulk.push(JSON.parse(options!.body as string).params[1].limit); return Response.json({result: {data: [raw(chunk(1,"b")), raw(chunk(0,"a"))]}});};
        assert.equal((await readUserInventoryCodeInFromTx(envelope(session.toBase58()), speed, undefined, {maxBytes: 2, maxChunks: 2, maxHistoryTransactions: 3})).data, "ab");
        assert.deepEqual(calls.bulk, [3]); assert.deepEqual(calls.signatures, []);
    });
    await check("bulk fallback cannot reset consumed history allowance", async () => {
        setup(["a"], 1); setRpcUrl("https://qa.helius-rpc.com");
        const unrelated = raw(link("ignored", "Genesis"));
        globalThis.fetch = async (_url, options) => {
            calls.bulk.push(JSON.parse(options!.body as string).params[1].limit);
            return Response.json({result: {data: [unrelated]}});
        };
        await assert.rejects(() => readUserInventoryCodeInFromTx(envelope(session.toBase58()), speed, undefined, {maxHistoryTransactions: 2}), /maxHistoryTransactions/);
        assert.deepEqual(calls.bulk, [2]);
        assert.deepEqual(calls.signatures, [1]);
        assert.deepEqual(calls.transaction, []);
    });
    console.log(`bounded reader: ${passed} cases passed`);
}
main().finally(() => {
    globalThis.fetch = original.fetch;
    Connection.prototype.getAccountInfo = original.account;
    Connection.prototype.getSignaturesForAddress = original.signatures;
    Connection.prototype.getTransaction = original.transaction;
}).catch(error => {console.error(error); process.exitCode = 1;});
