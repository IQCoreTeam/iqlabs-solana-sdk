// Reference sources
//
// /Users/sumin/WebstormProjects/iqlabs-core-api/new_backend/core/reader/reader.py
// /Users/sumin/WebstormProjects/solchat-web/lib/onchainDB/web/reader.ts
// /Users/sumin/IdeaProjects/iq6900_testbackend/src/provider/transaction.provider.ts

// After reviewing the three sources above,
// /Users/sumin/WebstormProjects/iqlabs-sdk/aboutmerge.md
// then check the latest contract here.
// Top priority reference (marked with ///):
///Users/sumin/RustroverProjects/IQLabsContract/iqlabs/programs/iqlabs/src/Users/sumin/RustroverProjects/IQLabsContract/iqlabs/programs/iqlabs/src
// Read the latest contract and decide how to shape the functions.


// Note: if you can reuse a function that fetches IQ-related transactions by PDA,
// keep that in mind. Before using this, read all files under reader and reflect
// the plan.

// -----------------------------------------------------------------------------
// reading_flow.ts scope notes (comments only)
// - No Reader object; branch directly by transaction/PDA.
// - Top-level branching (read) moves to read/index.ts.
// - Mode decision (decideReadMode) moves to read/reader_profile.ts.
// - reading_flow.ts only documents the "path" of reading.
//
// Candidate functions for reading_flow.ts (rough draft)
//
// 1) readSession(sessionPubkey, opts)
//    - Role: read the session PDA and reconstruct chunks.
//    - Used by: read(...) / readDbEntry(...).
//    - Note: session chunk list is collected in list/items_collector.ts.
//
// 2) readDbAccount(dbPda)
//    - Role: read db_account to extract on_chain_path/metadata.
//    - Note: tx list/listing is handled in list/items_collector.ts.
//    - Used by: readDbEntry.
//
// 3) readDbEntry(dbPda, opts)
//    - Role: read based on resolveOnChainPath result.
//    - Used by: DB-related API in read/index.ts.
//
// 4) resolveOnChainPath(onChainPath) /// rename to decideSessionOrLinkedList
//    - Role: split on_chain_path into "session" / "tailTx".
//    - Rule: if PDA exists -> session, if tail tx exists -> linked list, else error.
//    - Used by: readDbEntry internals.
//
// 5) readLinkedListFromTail(tailTx, opts)
//    - Role: traverse linked list from tail tx and reconstruct data.
//    - Used by: readDbEntry internals.
//
// 6) readUserState(userPubkey, opts)
//    - Role: parse user_state + total_session_files.
//    - Note: session/connection lists are handled in list/items_collector.ts.
//    - Used by: user API in read/index.ts.
//
// 7) readProfileMetadataInscription(txid)
//    - Role: read metadata inscription tx and reconstruct profile.
//    - Used by: readUserState internals.
//
// 8) readConnection(partyA, partyB, opts)
//    - Role: derive connection seed -> parse connection account.
//    - Note: prefer account-transaction utility.
//
// Reference priority:
// - Rustrover contract marked with /// (highest priority)
// - new_backend/core/reader
// - solchat reader, iq6900 testbackend
// -----------------------------------------------------------------------------
