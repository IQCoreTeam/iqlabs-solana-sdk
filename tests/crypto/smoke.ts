import iqlabs from "../../src/index";

const { crypto } = iqlabs;

async function testPasswordRoundtrip() {
    const msg = new TextEncoder().encode("hello from iqlabs-sdk crypto");
    const encrypted = await crypto.passwordEncrypt("test-password-123", msg);
    console.log("Password encrypt:", encrypted);

    const decrypted = await crypto.passwordDecrypt(
        "test-password-123",
        encrypted.salt,
        encrypted.iv,
        encrypted.ciphertext,
    );
    const text = new TextDecoder().decode(decrypted);
    console.log("Password decrypt:", text);
    if (text !== "hello from iqlabs-sdk crypto") throw new Error("Password roundtrip failed!");
    console.log("✓ Password roundtrip OK\n");
}

async function testDhRoundtrip() {
    // Simulate two wallets with mock signMessage
    const mockSignA = async (_msg: Uint8Array) => globalThis.crypto.getRandomValues(new Uint8Array(64));
    const mockSignB = async (_msg: Uint8Array) => globalThis.crypto.getRandomValues(new Uint8Array(64));

    const keypairA = await crypto.deriveX25519Keypair(mockSignA);
    const keypairB = await crypto.deriveX25519Keypair(mockSignB);
    console.log("DH pubA:", crypto.bytesToHex(keypairA.pubKey));
    console.log("DH pubB:", crypto.bytesToHex(keypairB.pubKey));

    // A encrypts to B
    const msg = new TextEncoder().encode("secret message A->B");
    const encrypted = await crypto.dhEncrypt(crypto.bytesToHex(keypairB.pubKey), msg);
    console.log("DH encrypt:", encrypted);

    // B decrypts
    const decrypted = await crypto.dhDecrypt(
        keypairB.privKey,
        encrypted.senderPub,
        encrypted.iv,
        encrypted.ciphertext,
    );
    const text = new TextDecoder().decode(decrypted);
    console.log("DH decrypt:", text);
    if (text !== "secret message A->B") throw new Error("DH roundtrip failed!");
    console.log("✓ DH roundtrip OK\n");
}

async function testEncodingHelpers() {
    const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    const hex = crypto.bytesToHex(bytes);
    if (hex !== "deadbeef") throw new Error("bytesToHex failed");
    const back = crypto.hexToBytes(hex);
    if (back.length !== 4 || back[0] !== 0xde) throw new Error("hexToBytes failed");
    console.log("✓ Encoding helpers OK\n");
}

async function main() {
    console.log("=== iqlabs-sdk crypto smoke tests ===\n");
    await testEncodingHelpers();
    await testPasswordRoundtrip();
    await testDhRoundtrip();
    console.log("=== All tests passed ===");
}

main().catch((e) => {
    console.error("FAIL:", e);
    process.exit(1);
});
