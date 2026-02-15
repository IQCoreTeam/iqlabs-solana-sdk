export const DEFAULT_LINKED_LIST_THRESHOLD = 10;
export const CHUNK_SIZE = 850;
export const DIRECT_METADATA_MAX_BYTES = 850;
export const DEFAULT_WRITE_FEE_RECEIVER =
    "EWNSTD8tikwqHMcRNuuNbZrnYJUiJdKq9UXLXSEU4wZ1";
export const DEFAULT_IQ_MINT =
    "3uXACfojUrya7VH51jVC1DCHq3uzK4A7g469Q954LABS";

// DB writes: metadata is type + offset only, never holds inline data.
// Hard cap enforced before building the tx to prevent overflow.
export const DB_METADATA_MAX_BYTES = 750;
export const MAX_FILENAME_LENGTH = 128;
