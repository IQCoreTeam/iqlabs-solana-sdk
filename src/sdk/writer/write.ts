// Import initialization helpers from initialize.ts.

// Private functions below.
// post_chunk(seq, index, chunk, method, decode_break)
// send_code(code, before_tx, method, decode_break)
// db_code_in(on_chain_path, metadata, session?)

// Also expose one public high-level function here.
// write
    // Decide whether to inscribe via session PDA or linked list based on chunk count.
    // Use a public constant for the linked-list threshold (usually 10).

    // First, check if the db account is already initialized.
    // If >= N chunks, initialize the session account (from initialize.ts) and post_chunk.
    // This creates a new one each time, so there is no ensure.
    // seq should use user_state.total_session_files from the contract.
    // If < N, ensure the code account exists and call send_code.

    // Finish by calling db_code_in with fees per contract requirements.
    // onchain_path: "ghjjkhlhjhkhkj" pda or tail tx
    // metadata: { encrypted: 'AES16', upload: 'session', total_chunks: 200, 'image/png' }
    // (example only; metadata can be any JSON)
    // db_code_in likely follows this shape.

// write_data -> expose as writeDataToDb.
// write_connection_data -> expose as sendConnectionData.
// database_instruction -> expose as manageRow.
