export const DEFAULT_LINKED_LIST_THRESHOLD = 10;
export const CHUNK_SIZE = 850;
export const DIRECT_METADATA_MAX_BYTES = 700;

// v1 transaction profile (SIMD-0296 raises the tx cap from 1,232 to 4,096
// bytes). Chunks stay ~500 bytes under the cap to leave room for signature,
// account keys, compute-budget instructions, and the JSON envelope.
export const CHUNK_SIZE_V1 = 3600;
export const DIRECT_METADATA_MAX_BYTES_V1 = 3400;

// Post-upgrade account sizes from user_initialize (IQLabsContract#3):
// code_account   8 + 1 + 1 + 1 + (4 + 4096) + (4 + 100)
// user_inventory 8 + 1 + (4 + 100) + (4 + 4096)
// Accounts smaller than this were created pre-upgrade and must be grown
// with realloc_account before a v1-sized write.
export const CODE_ACCOUNT_SPACE = 4215;
export const USER_INVENTORY_SPACE = 4213;

/** Feature gate for v1 transactions; owned by the Feature program with an activation slot once live. */
export const TX_V1_FEATURE_GATE = "txv1aq4pp281K9um3tnPgkfX8UqtFT6wcVW3hNezGLL";
export const FEATURE_PROGRAM_ID = "Feature111111111111111111111111111111111111";
export const DEFAULT_WRITE_FEE_RECEIVER =
    "EWNSTD8tikwqHMcRNuuNbZrnYJUiJdKq9UXLXSEU4wZ1";
export const DEFAULT_IQ_MINT =
    "3uXACfojUrya7VH51jVC1DCHq3uzK4A7g469Q954LABS";

/** Minimum length of a base58 Solana transaction signature (~88 chars). */
export const SIG_MIN_LEN = 80;
