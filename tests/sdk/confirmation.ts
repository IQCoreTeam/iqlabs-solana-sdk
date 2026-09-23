import assert from "node:assert/strict";
import {test} from "node:test";
import {Connection, Keypair, PublicKey, SystemProgram} from "@solana/web3.js";
import {confirmLanded} from "../../src/sdk/writer/v1_tx";
import {sendTxWithRetries} from "../../src/sdk/writer/writer_utils";

const failure = {InstructionError: [0, "InvalidArgument"]};
const signature = "local-test-signature";
const blockhash = PublicKey.default.toBase58();

test("confirmation rejects execution errors in both confirmation paths", async () => {
    for (const expired of [false, true]) {
        const connection = new Connection("http://127.0.0.1:1");
        connection.confirmTransaction = async () => {
            if (expired) throw Object.assign(new Error("expired"), {name: "TransactionExpiredBlockheightExceededError"});
            return {context: {slot: 1}, value: {err: failure}} as any;
        };
        connection.getSignatureStatuses = async () => ({context: {slot: 1}, value: [{
            slot: 1, confirmations: 1, confirmationStatus: "confirmed", err: failure,
        }]}) as any;
        await assert.rejects(confirmLanded(connection, signature, blockhash, 2), /InvalidArgument/);
    }
});

test("successful confirmations and false expiry still succeed", async () => {
    for (const expired of [false, true]) {
        const connection = new Connection("http://127.0.0.1:1");
        connection.confirmTransaction = async () => {
            if (expired) throw Object.assign(new Error("expired"), {name: "TransactionExpiredBlockheightExceededError"});
            return {context: {slot: 1}, value: {err: null}};
        };
        connection.getSignatureStatuses = async () => ({context: {slot: 1}, value: [{
            slot: 1, confirmations: null, confirmationStatus: "finalized", err: null,
        }]});
        await confirmLanded(connection, signature, blockhash, 2);
    }
});

test("an execution failure is not resent with a fresh signature", async () => {
    const connection = new Connection("http://127.0.0.1:1");
    let sends = 0;
    connection.getAccountInfo = async () => null; // Legacy feature gate, with no network access.
    connection.getLatestBlockhash = async () => ({blockhash, lastValidBlockHeight: 2});
    connection.sendRawTransaction = async () => { sends++; return signature; };
    connection.confirmTransaction = async () => ({context: {slot: 1}, value: {err: failure}}) as any;
    const signer = Keypair.generate();
    await assert.rejects(sendTxWithRetries(connection, signer, SystemProgram.transfer({
        fromPubkey: signer.publicKey, toPubkey: PublicKey.default, lamports: 1,
    }), false, 2, 0), /InvalidArgument/);
    assert.equal(sends, 1);
});

test("transport errors propagate rather than becoming success", async () => {
    const connection = new Connection("http://127.0.0.1:1");
    const error = new Error("fixture transport failure");
    connection.confirmTransaction = async () => { throw error; };
    await assert.rejects(confirmLanded(connection, signature, blockhash, 2), e => e === error);
});
