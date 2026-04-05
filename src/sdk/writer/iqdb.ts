import {BN, BorshAccountsCoder, type Idl} from "@coral-xyz/anchor";
import {
    Connection,
    PublicKey,
    SystemProgram,
    type Signer,
    type TransactionInstruction,
} from "@solana/web3.js";
import {type SignerInput} from "../utils/wallet";

import {
    createInstructionBuilder,
    createTableInstruction,
    reallocAccountInstruction,
    walletConnectionCodeInInstruction,
    dbInstructionCodeInInstruction,
    dbCodeInInstruction,
    GateType,
    getConnectionInstructionTablePda,
    getConnectionTablePda,
    getConnectionTableRefPda,
    getDbRootPda,
    getInstructionTablePda,
    PROGRAM_ID,
    getTargetConnectionTableRefPda,
    getTablePda,
    getUserPda,
    requestConnectionInstruction,
    updateUserMetadataInstruction,
} from "../../contract";
import {resolveAssociatedTokenAccount} from "../utils/ata";
import {
    decodeConnectionMeta,
    evaluateConnectionAccess,
    ensureDbRootExists,
    ensureTableExists,
    fetchTableMeta,
} from "../utils/global_fetch";
import {deriveDmSeed, toSeedBytes} from "../utils/seed";
import {DEFAULT_WRITE_FEE_RECEIVER} from "../constants";
import {prepareCodeIn} from "./code_in";
import {sendTx} from "./writer_utils";

const IDL = require("../../../idl/code_in.json") as Idl;
const ACCOUNT_CODER = new BorshAccountsCoder(IDL);

// ~20 tables worth of extra space per realloc
const REALLOC_EXTRA = 2048;
// trigger realloc when free bytes drop below this
const REALLOC_THRESHOLD = 128;

const vecVecSerializedSize = (vv: Uint8Array[]) =>
    4 + vv.reduce((s, v) => s + 4 + v.length, 0);

function buildReallocIxIfNeeded(
    builder: ReturnType<typeof createInstructionBuilder>,
    payer: PublicKey,
    target: PublicKey,
    accountData: Buffer,
): TransactionInstruction | null {
    const decoded = ACCOUNT_CODER.decode("DbRoot", accountData) as {
        table_seeds: Uint8Array[];
        global_table_seeds: Uint8Array[];
        id: Uint8Array;
    };

    const usedBytes = 8 + 32
        + vecVecSerializedSize(decoded.table_seeds)
        + vecVecSerializedSize(decoded.global_table_seeds)
        + 4 + decoded.id.length;

    if (accountData.length - usedBytes >= REALLOC_THRESHOLD) return null;

    return reallocAccountInstruction(
        builder,
        {payer, target, system_program: SystemProgram.programId},
        {new_size: new BN(accountData.length + REALLOC_EXTRA)},
    );
}

export async function createTable(
    connection: Connection,
    signer: Signer,
    dbRootId: Uint8Array | string,
    tableSeed: Uint8Array | string,
    tableName: Uint8Array | string,
    columnNames: Array<Uint8Array | string>,
    idCol: Uint8Array | string,
    extKeys: Array<Uint8Array | string>,
    gate?: { mint: PublicKey; amount?: number; gateType?: GateType },
    writers?: PublicKey[],
) {
    const programId = PROGRAM_ID;
    const builder = createInstructionBuilder(IDL, programId);
    const dbRootSeed = toSeedBytes(dbRootId);
    const tableSeedBytes = toSeedBytes(tableSeed);
    const dbRoot = getDbRootPda(dbRootSeed, programId);
    const table = getTablePda(dbRoot, tableSeedBytes, programId);
    const instructionTable = getInstructionTablePda(dbRoot, tableSeedBytes, programId);

    const dbRootInfo = await connection.getAccountInfo(dbRoot);
    if (!dbRootInfo) throw new Error("db_root not found");

    const toBytes = (v: string | Uint8Array) =>
        typeof v === "string" ? Buffer.from(v, "utf8") : v;

    const ixs: TransactionInstruction[] = [];

    const reallocIx = buildReallocIxIfNeeded(builder, signer.publicKey, dbRoot, dbRootInfo.data);
    if (reallocIx) ixs.push(reallocIx);

    ixs.push(createTableInstruction(
        builder,
        {
            db_root: dbRoot,
            receiver: new PublicKey(DEFAULT_WRITE_FEE_RECEIVER),
            signer: signer.publicKey,
            table,
            instruction_table: instructionTable,
            system_program: SystemProgram.programId,
        },
        {
            db_root_id: dbRootSeed,
            table_seed: tableSeedBytes,
            table_name: toBytes(tableName),
            column_names: columnNames.map(toBytes),
            id_col: toBytes(idCol),
            ext_keys: extKeys.map(toBytes),
            gate_mint_opt: gate ? gate.mint : null,
            writers_opt: writers ?? null,
        },
    ));

    return sendTx(connection, signer, ixs);
}

export async function validateRowJson(
    connection: Connection,
    programId: PublicKey,
    dbRootId: Uint8Array | string,
    tableSeed: Uint8Array | string,
    rowJson: string,
    idCol?: string,
) {
    let parsed: unknown;
    try {
        parsed = JSON.parse(rowJson);
    } catch {
        throw new Error("row_json is invalid");
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("row_json must be an object");
    }

    const meta = await fetchTableMeta(connection, programId, dbRootId, tableSeed);
    const requiredId = idCol ?? meta.idCol;
    const allowedKeys = new Set([...meta.columns, meta.idCol]);
    const row = parsed as Record<string, unknown>;

    for (const key of Object.keys(row)) {
        if (!allowedKeys.has(key)) {
            throw new Error(`unknown key: ${key}`);
        }
    }

    if (!Object.prototype.hasOwnProperty.call(row, requiredId)) {
        throw new Error(`missing id_col: ${requiredId}`);
    }

    return meta;
}

export async function resolveSignerAta(
    connection: Connection,
    signer: SignerInput,
    gateMint: PublicKey,
) {
    if (gateMint.equals(PublicKey.default)) {
        return null;
    }

    return resolveAssociatedTokenAccount(
        connection,
        signer.publicKey,
        gateMint,
        true,
    );
}

const METAPLEX_PROGRAM_ID = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

function getMetadataPda(mint: PublicKey): PublicKey {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("metadata"), METAPLEX_PROGRAM_ID.toBuffer(), mint.toBuffer()],
        METAPLEX_PROGRAM_ID,
    )[0];
}

async function resolveGateAccounts(
    connection: Connection,
    signer: SignerInput,
    gate: { mint: PublicKey; gateType: number },
) {
    const signerAta = await resolveSignerAta(connection, signer, gate.mint);
    if (!signerAta) return { signerAta: undefined, metadataAccount: undefined };

    // For collection gates, we need the metadata PDA of the NFT mint (not the collection key).
    // The client must resolve which NFT they hold; for now the ATA mint is used.
    // Collection gate metadata resolution requires reading the ATA to get the actual NFT mint.
    let metadataAccount: PublicKey | undefined;
    if (gate.gateType === GateType.Collection) {
        const ataInfo = await connection.getAccountInfo(signerAta);
        if (ataInfo && ataInfo.data.length >= 64) {
            // SPL token account layout: mint is at offset 0, 32 bytes
            const nftMint = new PublicKey(ataInfo.data.subarray(0, 32));
            metadataAccount = getMetadataPda(nftMint);
        }
    }

    return { signerAta, metadataAccount };
}

export async function writeRow(
    connection: Connection,
    signer: SignerInput,
    dbRootId: Uint8Array | string,
    tableSeed: Uint8Array | string,
    rowJson: string,
    skipConfirmation = false,
    remainingAccounts?: PublicKey[],
) {
    const programId = PROGRAM_ID;
    const dbRootSeed = toSeedBytes(dbRootId);
    const tableSeedBytes = toSeedBytes(tableSeed);
    const dbRoot = getDbRootPda(dbRootSeed, programId);

    await ensureDbRootExists(connection, programId, dbRootSeed);
    const {tablePda} = await ensureTableExists(
        connection,
        programId,
        dbRootSeed,
        tableSeedBytes,
    );
    const meta = await validateRowJson(
        connection,
        programId,
        dbRootSeed,
        tableSeedBytes,
        rowJson,
    );
    if (
        meta.writers.length > 0 &&
        !meta.writers.some((writer) => writer.equals(signer.publicKey))
    ) {
        throw new Error("signer not in writers");
    }

    const hasGate = meta.gate && !meta.gate.mint.equals(SystemProgram.programId);
    const { signerAta, metadataAccount } = hasGate
        ? await resolveGateAccounts(connection, signer, meta.gate)
        : { signerAta: undefined, metadataAccount: undefined };
    const {
        builder,
        user,
        userInventory,
        onChainPath,
        metadata,
        sessionAccount,
        sessionFinalize,
        feeReceiver,
        iqAta,
    } = await prepareCodeIn({connection, signer}, [rowJson]);
    const ix = dbCodeInInstruction(
        builder,
        {
            user,
            signer: signer.publicKey,
            user_inventory: userInventory,
            db_root: dbRoot,
            table: tablePda,
            signer_ata: signerAta,
            metadata_account: metadataAccount,
            system_program: SystemProgram.programId,
            receiver: feeReceiver,
            session: sessionAccount,
            iq_ata: iqAta ?? undefined,
        },
        {
            db_root_id: dbRootSeed,
            table_seed: tableSeedBytes,
            on_chain_path: onChainPath,
            metadata,
            session: sessionFinalize,
        },
        remainingAccounts,
    );
    return sendTx(connection, signer, ix, skipConfirmation);
}

export async function writeConnectionRow(
    connection: Connection,
    signer: SignerInput,
    dbRootId: Uint8Array | string,
    connectionSeed: Uint8Array | string,
    rowJson: string,
) {
    const programId = PROGRAM_ID;
    const dbRootSeed = toSeedBytes(dbRootId);
    const connectionSeedBytes = toSeedBytes(connectionSeed);
    const connectionSeedBuffer = Buffer.from(connectionSeedBytes);
    const dbRoot = getDbRootPda(dbRootSeed, programId);
    const connectionTable = getConnectionTablePda(
        dbRoot,
        connectionSeedBytes,
        programId,
    );
    const tableRef = getConnectionTableRefPda(
        dbRoot,
        connectionSeedBytes,
        programId,
    );

    await ensureDbRootExists(connection, programId, dbRootSeed);
    const [connectionInfo, tableRefInfo] = await Promise.all([
        connection.getAccountInfo(connectionTable),
        connection.getAccountInfo(tableRef),
    ]);
    if (!connectionInfo || !tableRefInfo) {
        throw new Error("connection table not found");
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(rowJson);
    } catch {
        throw new Error("row_json is invalid");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("row_json must be an object");
    }
    const meta = decodeConnectionMeta(connectionInfo.data);
    const access = evaluateConnectionAccess(meta, signer.publicKey);
    if (!access.allowed) {
        throw new Error(access.message ?? "connection not writable");
    }
    // Connection payloads are application-defined (plain or encrypted).
    // The on-chain program stores the blob without key validation,
    // so the SDK should not enforce column-name checks here.

    const {
        builder,
        user,
        userInventory,
        onChainPath,
        metadata,
        sessionAccount,
        sessionFinalize,
        feeReceiver,
        iqAta,
    } = await prepareCodeIn({connection, signer}, [rowJson]);
    const ix = walletConnectionCodeInInstruction(
        builder,
        {
            user,
            signer: signer.publicKey,
            user_inventory: userInventory,
            db_root: dbRoot,
            connection_table: connectionTable,
            table_ref: tableRef,
            system_program: SystemProgram.programId,
            receiver: feeReceiver,
            session: sessionAccount,
            iq_ata: iqAta ?? undefined,
        },
        {
            db_root_id: dbRootSeed,
            connection_seed: connectionSeedBuffer,
            on_chain_path: onChainPath,
            metadata,
            session: sessionFinalize,
        },
    );

    return sendTx(connection, signer, ix);
}

export async function manageRowData(
    connection: Connection,
    signer: SignerInput,
    dbRootId: Uint8Array | string,
    seed: Uint8Array | string,
    rowJson: string,
    tableName?: string | Uint8Array,
    targetTx?: string | Uint8Array,
) {
    const programId = PROGRAM_ID;
    const dbRootSeed = toSeedBytes(dbRootId);
    const seedBytes = toSeedBytes(seed);
    const dbRoot = getDbRootPda(dbRootSeed, programId);
    const tablePda = getTablePda(dbRoot, seedBytes, programId);
    const connectionTable = getConnectionTablePda(dbRoot, seedBytes, programId);

    await ensureDbRootExists(connection, programId, dbRootSeed);
    const [tableInfo, connectionInfo] = await Promise.all([
        connection.getAccountInfo(tablePda),
        connection.getAccountInfo(connectionTable),
    ]);

    if (tableInfo) {
        // Inline on purpose: db_instruction_code_in is only used here right now.
        if (!tableName || !targetTx) {
            throw new Error("tableName and targetTx are required for table edits");
        }

        const {tablePda: table} =
            await ensureTableExists(connection, programId, dbRootSeed, seedBytes);

        const instructionTable = getInstructionTablePda(
            dbRoot,
            seedBytes,
            programId,
        );

        const instructionInfo = await connection.getAccountInfo(instructionTable);
        if (!instructionInfo) {
            throw new Error("instruction table not found");
        }

        const meta = await fetchTableMeta(connection, programId, dbRootSeed, seedBytes);
        if (
            meta.writers.length > 0 &&
            !meta.writers.some((writer) => writer.equals(signer.publicKey))
        ) {
            throw new Error("signer not in writers");
        }

        const hasGate = meta.gate && !meta.gate.mint.equals(SystemProgram.programId);
    const { signerAta, metadataAccount } = hasGate
        ? await resolveGateAccounts(connection, signer, meta.gate)
        : { signerAta: undefined, metadataAccount: undefined };
        const {
            builder,
            user,
            userInventory,
            onChainPath,
            metadata,
            sessionAccount,
            sessionFinalize,
            feeReceiver,
            iqAta,
        } = await prepareCodeIn({connection, signer}, [rowJson]);
        const ix = dbInstructionCodeInInstruction(
            builder,
            {
                user,
                signer: signer.publicKey,
                user_inventory: userInventory,
                db_root: dbRoot,
                table,
                instruction_table: instructionTable,
                signer_ata: signerAta,
                metadata_account: metadataAccount,
                system_program: SystemProgram.programId,
                receiver: feeReceiver,
                session: sessionAccount,
                iq_ata: iqAta ?? undefined,
            },
            {
                db_root_id: dbRootSeed,
                table_seed: seedBytes,
                table_name:
                    typeof tableName === "string"
                        ? Buffer.from(tableName, "utf8")
                        : tableName,
                target_tx:
                    typeof targetTx === "string"
                        ? Buffer.from(targetTx, "utf8")
                        : targetTx,
                on_chain_path: onChainPath,
                metadata,
                session: sessionFinalize,
            },
        );
        return sendTx(connection, signer, ix);
    }
    if (connectionInfo) {
        return writeConnectionRow(
            connection,
            signer,
            dbRootSeed,
            seedBytes,
            rowJson,
        );

    }

    throw new Error("table/connection not found");
}

export async function updateUserMetadata(
    connection: Connection,
    signer: SignerInput,
    dbRootId: Uint8Array | string,
    meta: Uint8Array | string,
) {
    const programId = PROGRAM_ID;
    const builder = createInstructionBuilder(IDL, programId);
    const dbRootSeed = toSeedBytes(dbRootId);
    const dbRoot = getDbRootPda(dbRootSeed, programId);
    const user = getUserPda(signer.publicKey, programId);
    const metaBytes = typeof meta === "string" ? Buffer.from(meta, "utf8") : meta;

    const ix = updateUserMetadataInstruction(
        builder,
        {
            user,
            db_root: dbRoot,
            signer: signer.publicKey,
            system_program: SystemProgram.programId,
        },
        {
            db_root_id: dbRootSeed,
            meta: metaBytes,
        },
    );
    return sendTx(connection, signer, ix);
}

export async function requestConnection(
    connection: Connection,
    signer: SignerInput,
    dbRootId: Uint8Array | string,
    partyA: string,
    partyB: string,
    tableName: string | Uint8Array,
    columns: Array<string | Uint8Array>,
    idCol: string | Uint8Array,
    extKeys: Array<string | Uint8Array>,
) {
    // Validate requester
    const programId = PROGRAM_ID;
    const builder = createInstructionBuilder(IDL, programId);
    const requester = signer.publicKey;
    const requesterBase58 = requester.toBase58();
    if (requesterBase58 !== partyA && requesterBase58 !== partyB) {
        throw new Error("signer must be partyA or partyB");
    }

    // Derive PDAs + user accounts
    const receiverBase58 = requesterBase58 === partyA ? partyB : partyA;
    const receiver = new PublicKey(receiverBase58);
    const dbRootSeed = toSeedBytes(dbRootId);
    const dbRoot = getDbRootPda(dbRootSeed, programId);
    const connectionSeedBytes = deriveDmSeed(partyA, partyB);
    const connectionTable = getConnectionTablePda(
        dbRoot,
        connectionSeedBytes,
        programId,
    );
    const instructionTable = getConnectionInstructionTablePda(
        dbRoot,
        connectionSeedBytes,
        programId,
    );
    const tableRef = getConnectionTableRefPda(
        dbRoot,
        connectionSeedBytes,
        programId,
    );
    const targetTableRef = getTargetConnectionTableRefPda(
        dbRoot,
        connectionSeedBytes,
        programId,
    );
    const requesterUser = getUserPda(requester, programId);
    const receiverUser = getUserPda(receiver, programId);

    // Encode args (payload only carries dmTable)
    const toBytes = (value: string | Uint8Array) =>
        typeof value === "string" ? Buffer.from(value, "utf8") : value;
    const payloadBuf = Buffer.from(
        JSON.stringify({
            dmTable: connectionTable.toBase58(),
        }),
        "utf8",
    );

    // Build instruction
    const ix = requestConnectionInstruction(
        builder,
        {
            requester,
            db_root: dbRoot,
            connection_table: connectionTable,
            instruction_table: instructionTable,
            requester_user: requesterUser,
            receiver_user: receiverUser,
            table_ref: tableRef,
            target_table_ref: targetTableRef,
            system_program: SystemProgram.programId,
        },
        {
            db_root_id: dbRootSeed,
            connection_seed: connectionSeedBytes,
            receiver,
            table_name: toBytes(tableName),
            column_names: columns.map(toBytes),
            id_col: toBytes(idCol),
            ext_keys: extKeys.map(toBytes),
            user_payload: payloadBuf,
        },
    );

    // Send transaction
    return sendTx(connection, signer, ix);
}
