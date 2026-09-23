// Opt-in signed integration test. Uses only synthetic text and a disposable
// in-memory wallet. Requires a local Surfpool with the IQ program installed.
import assert from "node:assert/strict";
import {writeFileSync} from "node:fs";
import {Connection, Keypair} from "@solana/web3.js";
import {codeIn} from "../../src/sdk/writer/code_in";
import {readCodeIn} from "../../src/sdk/reader/read_code_in";
import {readUserState} from "../../src/sdk/reader/reading_flow";
import {setRpcUrl} from "../../src/sdk/utils/connection_helper";
import {createTable, writeRow} from "../../src/sdk/writer/iqdb";
import {createInstructionBuilder, getDbRootPda, initializeDbRootInstruction, PROGRAM_ID} from "../../src/contract";
import {sendTx} from "../../src/sdk/writer/writer_utils";
import {resolveTxProfile} from "../../src/sdk/utils/tx_profile";

async function main() {
    const rpc = process.env.IQ_LOCAL_RPC;
    assert.equal(rpc, "http://127.0.0.1:19109", "Explicitly set IQ_LOCAL_RPC to the dedicated loopback Surfpool");
    for (const name of ["SOLANA_RPC_ENDPOINT", "FRESH_RPC_URL", "RECENT_RPC_URL", "HELIUS_RPC_URL", "ZEROBLOCK_RPC_URL"]) process.env[name] = rpc;
    process.env.HELIUS_API_KEY = "";
    process.env.HELIUS_API_KEYS = "";
    setRpcUrl(rpc);
    const connection = new Connection(rpc, "confirmed");
    const genesis = await connection.getGenesisHash();
    assert.notEqual(genesis, "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d", "Mainnet genesis is prohibited");
    const signer = Keypair.generate();
    await connection.requestAirdrop(signer.publicKey, 5e9);
    const sent: string[] = [];
    const send = Connection.prototype.sendRawTransaction;
    Connection.prototype.sendRawTransaction = async function(raw, options) {
        assert.equal(this.rpcEndpoint, rpc, "Nonlocal write blocked");
        const signature = await send.call(this, raw, options);
        sent.push(signature);
        return signature;
    };
    const chunks = Array.from({length: 10}, (_, i) => `IQ local fixture ${i}: ` + "한글🦭".repeat(30) + "\n");
    const results: {scenario: string; writes: number; signature: string}[] = [];
    try {
        await codeIn({connection, signer}, "synthetic initialization", "init.txt");
        let before = (await readUserState(signer.publicKey.toBase58())).totalSessionFiles;
        await assert.rejects(codeIn({connection, signer}, chunks, "resume.txt", 0, "text/plain", percent => {
            if (percent > 0) throw new Error("injected interruption");
        }, "extreme"), /injected interruption/);
        assert.equal((await readUserState(signer.publicKey.toBase58())).totalSessionFiles, before + 1n);
        let start = sent.length;
        let signature = await codeIn({connection, signer}, chunks, "resume.txt", 0, "text/plain", undefined, "extreme");
        assert.equal(sent.length - start, 10, "nine missing chunks plus one finalization");
        assert.equal((await readUserState(signer.publicKey.toBase58())).totalSessionFiles, before + 1n);
        assert.equal((await readCodeIn(signature, "extreme")).data, chunks.join(""));
        results.push({scenario: "resume-after-first-chunk", writes: sent.length - start, signature});

        before = (await readUserState(signer.publicKey.toBase58())).totalSessionFiles;
        await assert.rejects(codeIn({connection, signer}, chunks, "finalize.txt", 0, "text/plain", percent => {
            if (percent === 100) throw new Error("injected interruption before finalization");
        }, "extreme"), /injected interruption/);
        start = sent.length;
        signature = await codeIn({connection, signer}, chunks, "finalize.txt", 0, "text/plain", undefined, "extreme");
        assert.equal(sent.length - start, 1, "already uploaded chunks must not be sent again");
        assert.equal((await readUserState(signer.publicKey.toBase58())).totalSessionFiles, before + 1n);
        assert.equal((await readCodeIn(signature, "extreme")).data, chunks.join(""));
        results.push({scenario: "resume-finalization-only", writes: sent.length - start, signature});

        await assert.rejects(codeIn({connection, signer}, chunks, "abandoned.txt", 0, "text/plain", percent => {
            if (percent > 0) throw new Error("injected interruption");
        }, "extreme"), /injected interruption/);
        before = (await readUserState(signer.publicKey.toBase58())).totalSessionFiles;
        const different = chunks.map(chunk => "different: " + chunk);
        start = sent.length;
        signature = await codeIn({connection, signer}, different, "different.txt", 0, "text/plain", undefined, "extreme");
        assert.equal(sent.length - start, 11, "different content gets a new session and every chunk");
        assert.equal((await readUserState(signer.publicKey.toBase58())).totalSessionFiles, before + 1n);
        assert.equal((await readCodeIn(signature, "extreme")).data, different.join(""));
        results.push({scenario: "different-content-new-session", writes: sent.length - start, signature});

        // IQ6900 uses writeRow, which shares prepareCodeIn with codeIn.
        // Exercise that public entry point with its own synthetic database.
        const dbRootId = signer.publicKey.toBuffer();
        const builder = createInstructionBuilder(require("../../idl/code_in.json"), PROGRAM_ID);
        await sendTx(connection, signer, initializeDbRootInstruction(builder, {
            db_root: getDbRootPda(dbRootId), signer: signer.publicKey,
        }, {db_root_id: dbRootId}));
        await createTable(connection, signer, dbRootId, "resume", "Local resume test", ["id", "text"], "id", []);
        const row = JSON.stringify({id: "synthetic", text: "x".repeat(40000)});
        const profile = await resolveTxProfile(connection, signer);
        const expectedChunks = Math.ceil(Buffer.byteLength(row) / profile.chunkSize);
        assert.ok(expectedChunks >= profile.linkedListThreshold);
        before = (await readUserState(signer.publicKey.toBase58())).totalSessionFiles;
        await assert.rejects(writeRow(connection, signer, dbRootId, "resume", row, false, undefined, {
            speed: "extreme", onProgress: percent => {if (percent > 0) throw new Error("injected row interruption");},
        }), /injected row interruption/);
        start = sent.length;
        signature = await writeRow(connection, signer, dbRootId, "resume", row, false, undefined, {speed: "extreme"});
        assert.equal(sent.length - start, expectedChunks, "missing row chunks plus finalization");
        assert.equal((await readUserState(signer.publicKey.toBase58())).totalSessionFiles, before + 1n);
        assert.equal((await readCodeIn(signature, "extreme")).data, row);
        results.push({scenario: "writeRow-resume", writes: sent.length - start, signature});

        const receipts = [];
        for (const signature of sent) {
            const tx = await connection.getTransaction(signature, {commitment: "confirmed", maxSupportedTransactionVersion: 1});
            assert.ok(tx?.meta);
            assert.equal(tx.meta.err, null);
            receipts.push({signature, version: tx.version, err: tx.meta.err, fee: tx.meta.fee});
        }
        const report = {scope: "Local Surfpool; synthetic payloads; generated in-memory wallet; no mainnet", genesis,
            owner: signer.publicKey.toBase58(), results, receipts};
        if (process.env.IQ_TEST_REPORT) writeFileSync(process.env.IQ_TEST_REPORT, JSON.stringify(report, null, 2));
        console.log(JSON.stringify({results, successfulReceipts: receipts.length}, null, 2));
    } finally {
        Connection.prototype.sendRawTransaction = send;
    }
}
main().catch(error => {console.error(error); process.exitCode = 1;});
