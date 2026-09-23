import assert from "node:assert/strict";
import {test} from "node:test";
import {BorshAccountsCoder, BorshInstructionCoder, utils} from "@coral-xyz/anchor";
import {Connection, Keypair, PublicKey, Transaction} from "@solana/web3.js";
import {createInstructionBuilder, getSessionPda, getUserPda, postChunkInstruction, PROGRAM_ID} from "../../src/contract";
import {uploadSession} from "../../src/sdk/writer/uploading_methods";
import {toWalletSigner} from "../../src/sdk/utils/wallet";

const idl = require("../../idl/code_in.json");
const builder = createInstructionBuilder(idl, PROGRAM_ID);
const accountCoder = new BorshAccountsCoder(idl);
const instructionCoder = new BorshInstructionCoder(idl);
const chunks = ["first", "second", "third"];

async function fixture(history: {index: number; chunk: string; method?: number}[], status = 0) {
    const signer = Keypair.generate();
    const previous = getSessionPda(signer.publicKey, 1n);
    const info = {owner: PROGRAM_ID, executable: false, lamports: 1, rentEpoch: 0,
        data: await accountCoder.encode("SessionAccount", {bump: 1, total_chunks: status ? 3 : 0, status})};
    const connection = new Connection("http://127.0.0.1:1");
    connection.getAccountInfo = async key => key.equals(previous) ? info : null;
    connection.getLatestBlockhash = async () => ({blockhash: PublicKey.default.toBase58(), lastValidBlockHeight: 100});
    connection.confirmTransaction = async () => ({context: {slot: 1}, value: {err: null}});
    connection.getSignatureStatuses = async signatures => ({context: {slot: 1}, value: signatures.map(() => ({
        slot: 1, confirmations: 1, confirmationStatus: "confirmed" as const, err: null,
    }))});
    connection.getSignaturesForAddress = async () => history.map((_, i) => ({signature: String(i), slot: 10 - i, err: null, memo: null, blockTime: 0}));
    connection.getTransaction = (async (signature: string) => {
        const i = Number(signature);
        // Deliberately let an older transaction finish last.
        await new Promise(resolve => setTimeout(resolve, i * 5));
        const item = history[i];
        const tx = new Transaction({feePayer: signer.publicKey, recentBlockhash: PublicKey.default.toBase58()});
        tx.add(postChunkInstruction(builder, {user: signer.publicKey, session: previous}, {
            index: item.index, chunk: item.chunk, method: item.method ?? 0, decode_break: 0,
        }));
        return {transaction: {message: tx.compileMessage()}, meta: {err: null}};
    }) as any;
    const sent: {name: string; data: any}[] = [];
    connection.sendRawTransaction = async raw => {
        const tx = Transaction.from(Buffer.from(raw));
        sent.push(...tx.instructions.map(ix => instructionCoder.decode(ix.data)!));
        return utils.bytes.bs58.encode(tx.signature!);
    };
    return {connection, signer, previous, sent,
        upload: (seq = 2n) => uploadSession(connection, signer, builder, PROGRAM_ID, signer.publicKey,
            getUserPda(signer.publicKey), seq, chunks, 0, {speed: "extreme"})};
}

test("counter points past an unfinished session: resume only its missing chunks", async () => {
    const f = await fixture([{index: 0, chunk: "first"}]);
    const result = await f.upload();
    assert.equal(result.seq, 1n);
    assert.ok(result.session.equals(f.previous));
    assert.deepEqual(f.sent.map(ix => ix.name), ["post_chunk", "post_chunk"]);
    assert.deepEqual(f.sent.map(ix => ix.data.index), [1, 2]);
});

test("an already uploaded but unfinished session submits no chunks", async () => {
    const f = await fixture(chunks.map((chunk, index) => ({index, chunk})));
    assert.equal((await f.upload()).seq, 1n);
    assert.equal(f.sent.length, 0);
});

test("wallet signers retain the resumed session and sequence", async () => {
    const f = await fixture([{index: 0, chunk: "first"}]);
    const wallet = toWalletSigner(f.signer);
    const result = await uploadSession(f.connection, wallet, builder, PROGRAM_ID,
        f.signer.publicKey, getUserPda(f.signer.publicKey), 2n, chunks, 0, {speed: "extreme"});
    assert.equal(result.seq, 1n);
    assert.ok(result.session.equals(f.previous));
    assert.deepEqual(f.sent.map(ix => ix.data.index), [1, 2]);
});

test("different bytes, encoding, or extra indexes start a new session", async () => {
    for (const history of [[{index: 0, chunk: "other"}], [{index: 0, chunk: "first", method: 1}], [{index: 3, chunk: "extra"}]]) {
        const f = await fixture(history);
        assert.equal((await f.upload()).seq, 2n);
        assert.equal(f.sent[0].name, "create_session");
        assert.deepEqual(f.sent.filter(ix => ix.name === "post_chunk").map(ix => ix.data.chunk), chunks);
    }
});

test("a finalized previous session is never reused", async () => {
    const f = await fixture([{index: 0, chunk: "first"}], 1);
    assert.equal((await f.upload()).seq, 2n);
    assert.equal(f.sent[0].name, "create_session");
});

test("conflicting historical chunks are never reused, regardless of response order", async () => {
    for (const history of [
        [{index: 0, chunk: "first"}, {index: 0, chunk: "stale"}],
        [{index: 0, chunk: "stale"}, {index: 0, chunk: "first"}],
    ]) {
        const f = await fixture(history);
        assert.equal((await f.upload()).seq, 2n);
        assert.equal(f.sent[0].name, "create_session");
    }
});

test("unavailable history fails before any writes", async () => {
    const f = await fixture([{index: 0, chunk: "first"}]);
    f.connection.getTransaction = (async () => null) as any;
    await assert.rejects(f.upload(), /cannot verify resume history/);
    assert.equal(f.sent.length, 0);
});

test("explicit reuse cannot overwrite different content or a finalized session", async () => {
    for (const status of [0, 1]) {
        const f = await fixture([{index: 0, chunk: "other"}], status);
        await assert.rejects(f.upload(1n), status ? /not an unfinished/ : /content differs/);
        assert.equal(f.sent.length, 0);
    }
});
