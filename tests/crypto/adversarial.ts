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

async function main() {
    console.log("=== Adversarial crypto tests ===\n");

    // ── Wrong key / wrong password ──────────────────────────────────────────

    console.log("1. Wrong key decryption (DH)");
    await assert("wrong private key fails to decrypt", async () => {
        const signA = async (_: Uint8Array) => globalThis.crypto.getRandomValues(new Uint8Array(64));
        const signB = async (_: Uint8Array) => globalThis.crypto.getRandomValues(new Uint8Array(64));
        const signC = async (_: Uint8Array) => globalThis.crypto.getRandomValues(new Uint8Array(64));

        const kpA = await crypto.deriveX25519Keypair(signA);
        const kpB = await crypto.deriveX25519Keypair(signB);
        const kpC = await crypto.deriveX25519Keypair(signC); // attacker

        const ct = await crypto.dhEncrypt(crypto.bytesToHex(kpB.pubKey), enc.encode("secret"));

        // Attacker C tries to decrypt message meant for B
        let threw = false;
        try {
            await crypto.dhDecrypt(kpC.privKey, ct.senderPub, ct.iv, ct.ciphertext);
        } catch {
            threw = true;
        }
        if (!threw) throw new Error("Decryption should fail with wrong key");
    });

    console.log("\n2. Wrong password decryption");
    await assert("wrong password fails to decrypt", async () => {
        const ct = await crypto.passwordEncrypt("correct-password", enc.encode("secret"));
        let threw = false;
        try {
            await crypto.passwordDecrypt("wrong-password", ct.salt, ct.iv, ct.ciphertext);
        } catch {
            threw = true;
        }
        if (!threw) throw new Error("Decryption should fail with wrong password");
    });

    // ── Tampered ciphertext ─────────────────────────────────────────────────

    console.log("\n3. Ciphertext tampering (GCM auth tag validation)");
    await assert("flipping one byte in ciphertext fails", async () => {
        const ct = await crypto.passwordEncrypt("password", enc.encode("test data"));
        // Flip one byte in the middle of ciphertext
        const bytes = crypto.hexToBytes(ct.ciphertext);
        bytes[Math.floor(bytes.length / 2)] ^= 0xff;
        const tampered = crypto.bytesToHex(bytes);
        let threw = false;
        try {
            await crypto.passwordDecrypt("password", ct.salt, ct.iv, tampered);
        } catch {
            threw = true;
        }
        if (!threw) throw new Error("Tampered ciphertext should fail AES-GCM auth");
    });

    await assert("flipping one byte in IV fails", async () => {
        const ct = await crypto.passwordEncrypt("password", enc.encode("test data"));
        const ivBytes = crypto.hexToBytes(ct.iv);
        ivBytes[0] ^= 0x01;
        const tamperedIv = crypto.bytesToHex(ivBytes);
        let threw = false;
        try {
            await crypto.passwordDecrypt("password", ct.salt, tamperedIv, ct.ciphertext);
        } catch {
            threw = true;
        }
        if (!threw) throw new Error("Tampered IV should fail AES-GCM auth");
    });

    await assert("flipping one byte in salt fails", async () => {
        const ct = await crypto.passwordEncrypt("password", enc.encode("test data"));
        const saltBytes = crypto.hexToBytes(ct.salt);
        saltBytes[0] ^= 0x01;
        const tamperedSalt = crypto.bytesToHex(saltBytes);
        let threw = false;
        try {
            await crypto.passwordDecrypt("password", tamperedSalt, ct.iv, ct.ciphertext);
        } catch {
            threw = true;
        }
        if (!threw) throw new Error("Tampered salt should fail decryption");
    });

    // ── Uniqueness / randomness ─────────────────────────────────────────────

    console.log("\n4. Randomness / uniqueness");
    await assert("same plaintext + same password → different ciphertext each time", async () => {
        const msg = enc.encode("identical message");
        const a = await crypto.passwordEncrypt("same-pw", msg);
        const b = await crypto.passwordEncrypt("same-pw", msg);
        if (a.salt === b.salt) throw new Error("Salts should be unique");
        if (a.iv === b.iv) throw new Error("IVs should be unique");
        if (a.ciphertext === b.ciphertext) throw new Error("Ciphertexts should differ");
    });

    await assert("same plaintext + DH → different ciphertext each time (ephemeral keys)", async () => {
        const sign = async (_: Uint8Array) => globalThis.crypto.getRandomValues(new Uint8Array(64));
        const kp = await crypto.deriveX25519Keypair(sign);
        const pubHex = crypto.bytesToHex(kp.pubKey);
        const msg = enc.encode("identical message");
        const a = await crypto.dhEncrypt(pubHex, msg);
        const b = await crypto.dhEncrypt(pubHex, msg);
        if (a.senderPub === b.senderPub) throw new Error("Ephemeral keys should be unique");
        if (a.ciphertext === b.ciphertext) throw new Error("Ciphertexts should differ");
    });

    // ── Deterministic key derivation ────────────────────────────────────────

    console.log("\n5. Deterministic key derivation");
    await assert("same wallet signature → same X25519 keypair", async () => {
        const fixedSig = globalThis.crypto.getRandomValues(new Uint8Array(64));
        const signFixed = async (_: Uint8Array) => fixedSig;
        const kp1 = await crypto.deriveX25519Keypair(signFixed);
        const kp2 = await crypto.deriveX25519Keypair(signFixed);
        if (crypto.bytesToHex(kp1.pubKey) !== crypto.bytesToHex(kp2.pubKey))
            throw new Error("Same sig should produce same pubkey");
        if (crypto.bytesToHex(kp1.privKey) !== crypto.bytesToHex(kp2.privKey))
            throw new Error("Same sig should produce same privkey");
    });

    await assert("different wallet signature → different X25519 keypair", async () => {
        const sign1 = async (_: Uint8Array) => globalThis.crypto.getRandomValues(new Uint8Array(64));
        const sign2 = async (_: Uint8Array) => globalThis.crypto.getRandomValues(new Uint8Array(64));
        const kp1 = await crypto.deriveX25519Keypair(sign1);
        const kp2 = await crypto.deriveX25519Keypair(sign2);
        if (crypto.bytesToHex(kp1.pubKey) === crypto.bytesToHex(kp2.pubKey))
            throw new Error("Different sigs should produce different pubkeys");
    });

    // ── Edge cases ──────────────────────────────────────────────────────────

    console.log("\n6. Edge cases");
    await assert("empty plaintext roundtrips (password)", async () => {
        const ct = await crypto.passwordEncrypt("pw", new Uint8Array(0));
        const pt = await crypto.passwordDecrypt("pw", ct.salt, ct.iv, ct.ciphertext);
        if (pt.length !== 0) throw new Error("Expected empty plaintext");
    });

    await assert("empty plaintext roundtrips (DH)", async () => {
        const sign = async (_: Uint8Array) => globalThis.crypto.getRandomValues(new Uint8Array(64));
        const kp = await crypto.deriveX25519Keypair(sign);
        const ct = await crypto.dhEncrypt(crypto.bytesToHex(kp.pubKey), new Uint8Array(0));
        const pt = await crypto.dhDecrypt(kp.privKey, ct.senderPub, ct.iv, ct.ciphertext);
        if (pt.length !== 0) throw new Error("Expected empty plaintext");
    });

    await assert("large plaintext (1MB) roundtrips", async () => {
        const big = new Uint8Array(1024 * 1024);
        for (let off = 0; off < big.length; off += 65536) {
            globalThis.crypto.getRandomValues(big.subarray(off, off + 65536));
        }
        const ct = await crypto.passwordEncrypt("pw", big);
        const pt = await crypto.passwordDecrypt("pw", ct.salt, ct.iv, ct.ciphertext);
        if (pt.length !== big.length) throw new Error("Length mismatch");
        for (let i = 0; i < big.length; i++) {
            if (pt[i] !== big[i]) throw new Error(`Byte mismatch at ${i}`);
        }
    });

    await assert("single byte plaintext roundtrips", async () => {
        const ct = await crypto.passwordEncrypt("pw", new Uint8Array([0x42]));
        const pt = await crypto.passwordDecrypt("pw", ct.salt, ct.iv, ct.ciphertext);
        if (pt.length !== 1 || pt[0] !== 0x42) throw new Error("Single byte roundtrip failed");
    });

    // ── Encoding edge cases ─────────────────────────────────────────────────

    console.log("\n7. Encoding edge cases");
    await assert("hex roundtrip with all byte values", async () => {
        const all = new Uint8Array(256);
        for (let i = 0; i < 256; i++) all[i] = i;
        const hex = crypto.bytesToHex(all);
        const back = crypto.hexToBytes(hex);
        for (let i = 0; i < 256; i++) {
            if (back[i] !== i) throw new Error(`Byte ${i} roundtrip failed`);
        }
    });

    await assert("empty hex string", async () => {
        const bytes = crypto.hexToBytes("");
        if (bytes.length !== 0) throw new Error("Expected empty array");
        const hex = crypto.bytesToHex(new Uint8Array(0));
        if (hex !== "") throw new Error("Expected empty string");
    });

    // ── Cross-contamination ─────────────────────────────────────────────────

    console.log("\n8. Cross-mode isolation");
    await assert("password ciphertext can't be decrypted with DH", async () => {
        const sign = async (_: Uint8Array) => globalThis.crypto.getRandomValues(new Uint8Array(64));
        const kp = await crypto.deriveX25519Keypair(sign);
        const pwCt = await crypto.passwordEncrypt("password", enc.encode("test"));
        let threw = false;
        try {
            await crypto.dhDecrypt(kp.privKey, crypto.bytesToHex(kp.pubKey), pwCt.iv, pwCt.ciphertext);
        } catch {
            threw = true;
        }
        if (!threw) throw new Error("Cross-mode decryption should fail");
    });

    // ── Input validation ─────────────────────────────────────────────────────

    console.log("\n9. Recipient key validation");
    await expectThrow("dhEncrypt rejects short hex", () =>
        crypto.dhEncrypt("abcd", enc.encode("test")),
    );
    await expectThrow("dhEncrypt rejects non-hex chars", () =>
        crypto.dhEncrypt("zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz", enc.encode("test")),
    );
    await expectThrow("dhEncrypt rejects zero key", () =>
        crypto.dhEncrypt("0".repeat(64), enc.encode("test")),
    );
    await assert("dhEncrypt accepts valid 64-char hex key", async () => {
        const sign = async (_: Uint8Array) => globalThis.crypto.getRandomValues(new Uint8Array(64));
        const kp = await crypto.deriveX25519Keypair(sign);
        await crypto.dhEncrypt(crypto.bytesToHex(kp.pubKey), enc.encode("test"));
    });
    await expectThrow("dhDecrypt rejects garbage senderPub", async () => {
        const sign = async (_: Uint8Array) => globalThis.crypto.getRandomValues(new Uint8Array(64));
        const kp = await crypto.deriveX25519Keypair(sign);
        await crypto.dhDecrypt(kp.privKey, "tooshort", "aa".repeat(12), "aa".repeat(32));
    });

    // ── Summary ─────────────────────────────────────────────────────────────

    console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
    if (failed > 0) process.exit(1);
}

main().catch((e) => {
    console.error("FATAL:", e);
    process.exit(1);
});
