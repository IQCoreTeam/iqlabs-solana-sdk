import iqlabs from "../../src/index";

const { crypto } = iqlabs;
const enc = new TextEncoder();
const dec = new TextDecoder();

let passed = 0;
let failed = 0;

async function assert(name: string, fn: () => Promise<void>) {
    try {
        await fn();
        console.log(`  ✓ ${name}`);
        passed++;
    } catch (e: any) {
        console.log(`  ✗ ${name}: ${e.message}`);
        failed++;
    }
}

async function expectThrow(name: string, fn: () => Promise<any>) {
    try {
        await fn();
        console.log(`  ✗ ${name}: expected to throw but didn't`);
        failed++;
    } catch {
        console.log(`  ✓ ${name}`);
        passed++;
    }
}

async function makeKeypair() {
    const sign = async (_: Uint8Array) => globalThis.crypto.getRandomValues(new Uint8Array(64));
    return crypto.deriveX25519Keypair(sign);
}

async function main() {
    console.log("=== Multi-recipient encryption tests ===\n");

    // ── Basic roundtrip ─────────────────────────────────────────────────────

    console.log("1. Basic roundtrip");
    await assert("single recipient roundtrip", async () => {
        const kp = await makeKeypair();
        const pubHex = crypto.bytesToHex(kp.pubKey);
        const msg = enc.encode("hello single recipient");
        const ct = await crypto.multiEncrypt([pubHex], msg);
        if (ct.recipients.length !== 1) throw new Error("Expected 1 recipient entry");
        const pt = await crypto.multiDecrypt(kp.privKey, pubHex, ct);
        if (dec.decode(pt) !== "hello single recipient") throw new Error("Decryption mismatch");
    });

    await assert("three recipients all decrypt same message", async () => {
        const kpA = await makeKeypair();
        const kpB = await makeKeypair();
        const kpC = await makeKeypair();
        const pubA = crypto.bytesToHex(kpA.pubKey);
        const pubB = crypto.bytesToHex(kpB.pubKey);
        const pubC = crypto.bytesToHex(kpC.pubKey);

        const msg = enc.encode("group message");
        const ct = await crypto.multiEncrypt([pubA, pubB, pubC], msg);
        if (ct.recipients.length !== 3) throw new Error("Expected 3 recipient entries");

        const ptA = dec.decode(await crypto.multiDecrypt(kpA.privKey, pubA, ct));
        const ptB = dec.decode(await crypto.multiDecrypt(kpB.privKey, pubB, ct));
        const ptC = dec.decode(await crypto.multiDecrypt(kpC.privKey, pubC, ct));

        if (ptA !== "group message") throw new Error("A decryption mismatch");
        if (ptB !== "group message") throw new Error("B decryption mismatch");
        if (ptC !== "group message") throw new Error("C decryption mismatch");
    });

    // ── Security ────────────────────────────────────────────────────────────

    console.log("\n2. Security");
    await assert("non-recipient cannot decrypt", async () => {
        const kpA = await makeKeypair();
        const kpB = await makeKeypair();
        const kpAttacker = await makeKeypair();
        const pubA = crypto.bytesToHex(kpA.pubKey);
        const pubB = crypto.bytesToHex(kpB.pubKey);
        const attackerPub = crypto.bytesToHex(kpAttacker.pubKey);

        const ct = await crypto.multiEncrypt([pubA, pubB], enc.encode("secret"));

        // Attacker not in recipient list → no matching entry
        let threw = false;
        try {
            await crypto.multiDecrypt(kpAttacker.privKey, attackerPub, ct);
        } catch {
            threw = true;
        }
        if (!threw) throw new Error("Non-recipient should not be able to decrypt");
    });

    await assert("recipient A cannot use B's entry", async () => {
        const kpA = await makeKeypair();
        const kpB = await makeKeypair();
        const pubA = crypto.bytesToHex(kpA.pubKey);
        const pubB = crypto.bytesToHex(kpB.pubKey);

        const ct = await crypto.multiEncrypt([pubA, pubB], enc.encode("secret"));

        // A tries to decrypt with B's pubkey lookup
        let threw = false;
        try {
            await crypto.multiDecrypt(kpA.privKey, pubB, ct);
        } catch {
            threw = true;
        }
        if (!threw) throw new Error("Should fail with wrong privkey for entry");
    });

    await assert("each recipient gets unique ephemeral key", async () => {
        const kpA = await makeKeypair();
        const kpB = await makeKeypair();
        const pubA = crypto.bytesToHex(kpA.pubKey);
        const pubB = crypto.bytesToHex(kpB.pubKey);

        const ct = await crypto.multiEncrypt([pubA, pubB], enc.encode("test"));
        if (ct.recipients[0].ephemeralPub === ct.recipients[1].ephemeralPub)
            throw new Error("Ephemeral keys should be unique per recipient");
        if (ct.recipients[0].wrappedKey === ct.recipients[1].wrappedKey)
            throw new Error("Wrapped keys should differ");
    });

    await assert("tampered wrappedKey fails", async () => {
        const kp = await makeKeypair();
        const pubHex = crypto.bytesToHex(kp.pubKey);
        const ct = await crypto.multiEncrypt([pubHex], enc.encode("test"));

        // Flip a byte in the wrapped key
        const wkBytes = crypto.hexToBytes(ct.recipients[0].wrappedKey);
        wkBytes[0] ^= 0xff;
        ct.recipients[0].wrappedKey = crypto.bytesToHex(wkBytes);

        let threw = false;
        try {
            await crypto.multiDecrypt(kp.privKey, pubHex, ct);
        } catch {
            threw = true;
        }
        if (!threw) throw new Error("Tampered wrapped key should fail");
    });

    await assert("tampered ciphertext fails", async () => {
        const kp = await makeKeypair();
        const pubHex = crypto.bytesToHex(kp.pubKey);
        const ct = await crypto.multiEncrypt([pubHex], enc.encode("test"));

        const ctBytes = crypto.hexToBytes(ct.ciphertext);
        ctBytes[0] ^= 0xff;
        ct.ciphertext = crypto.bytesToHex(ctBytes);

        let threw = false;
        try {
            await crypto.multiDecrypt(kp.privKey, pubHex, ct);
        } catch {
            threw = true;
        }
        if (!threw) throw new Error("Tampered ciphertext should fail");
    });

    // ── Edge cases ──────────────────────────────────────────────────────────

    console.log("\n3. Edge cases");
    await expectThrow("rejects empty recipient list", () =>
        crypto.multiEncrypt([], enc.encode("test")),
    );

    await assert("deduplicates recipients", async () => {
        const kp = await makeKeypair();
        const pubHex = crypto.bytesToHex(kp.pubKey);
        const ct = await crypto.multiEncrypt([pubHex, pubHex, pubHex], enc.encode("dedup test"));
        if (ct.recipients.length !== 1) throw new Error(`Expected 1 entry, got ${ct.recipients.length}`);
        const pt = dec.decode(await crypto.multiDecrypt(kp.privKey, pubHex, ct));
        if (pt !== "dedup test") throw new Error("Decryption mismatch after dedup");
    });

    await assert("empty plaintext roundtrips", async () => {
        const kp = await makeKeypair();
        const pubHex = crypto.bytesToHex(kp.pubKey);
        const ct = await crypto.multiEncrypt([pubHex], new Uint8Array(0));
        const pt = await crypto.multiDecrypt(kp.privKey, pubHex, ct);
        if (pt.length !== 0) throw new Error("Expected empty plaintext");
    });

    await expectThrow("rejects invalid recipient key", () =>
        crypto.multiEncrypt(["not-valid-hex"], enc.encode("test")),
    );

    await expectThrow("rejects zero key", () =>
        crypto.multiEncrypt(["0".repeat(64)], enc.encode("test")),
    );

    // ── Scale ───────────────────────────────────────────────────────────────

    console.log("\n4. Scale");
    await assert("10 recipients all decrypt correctly", async () => {
        const keypairs = await Promise.all(Array.from({ length: 10 }, () => makeKeypair()));
        const pubHexes = keypairs.map((kp) => crypto.bytesToHex(kp.pubKey));

        const ct = await crypto.multiEncrypt(pubHexes, enc.encode("broadcast"));
        if (ct.recipients.length !== 10) throw new Error(`Expected 10, got ${ct.recipients.length}`);

        for (let i = 0; i < 10; i++) {
            const pt = dec.decode(await crypto.multiDecrypt(keypairs[i].privKey, pubHexes[i], ct));
            if (pt !== "broadcast") throw new Error(`Recipient ${i} failed`);
        }
    });

    // ── Summary ─────────────────────────────────────────────────────────────

    console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
    if (failed > 0) process.exit(1);
}

main().catch((e) => {
    console.error("FATAL:", e);
    process.exit(1);
});
