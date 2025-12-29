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
// Candidate functions for reading_flow.ts (draft)
// 0) readDBMetadata(txSignature)
//    Role:
//      - read db_code_in args only (no result reconstruction)
//    Input:
//      - txSignature: string (db_code_in tx signature)
//    Output:
//      - { onChainPath, metadata }
//
// 1) readInscription(txSignature) // this is the main read function for the file
//    Role:
//      - follow on_chain_path and return the fully reconstructed result
//    Input:
//      - txSignature: string (db_code_in tx signature)
//    Output:
//      - { result }
//    Steps:
//      - extract on_chain_path and metadata via readDBMetadata(txSignature)
//      - readOption = reader_profile.decideReadMode(txSignature)
//        (uses profile settings + tx blocktime/slot)
//      - if reader_profile.decideSessionOrLinkedList(on_chain_path) == "session":
//        - readSession(on_chain_path, readOption)
//      - else:
//        - readLinkedListFromTail(on_chain_path, readOption)
//      - return result
//
// 3) readSession(sessionPubkey, readOption)
//    Input:
//      - sessionPubkey: string (base58)
//      - readOption: ReadOption
//    Output:
//      - { result }
//    Steps:
//      - validate session account (discriminator/owner/size)
//      - if valid, call reading_methods.readSessionResult(sessionPubkey, readOption)
//      - return result
//    Notes:
//      - SessionAccount does not store chunks; read from tx ix args
//      - method: compression/encryption hint
//      - decode_break: split marker for compression/encryption
//
// 4) readLinkedListFromTail(tailTx, readOption)
//    Input:
//      - tailTx: string (tx signature)
//      - readOption: ReadOption
//    Output:
//      - { result }
//    Steps:
//      - fetch tail tx; validate it is a send_code tail
//      - if valid, call reading_methods.readLinkedListResult(tailTx, readOption)
//      - return result
//    Notes:
//      - linked-list does not use replay
//      - RPC choice: <=24h -> zeroblock, else -> helius
//
// 5) readUserState(userPubkey)
//    Input:
//      - userPubkey: string (base58)
//    Output:
//      - { owner, metadata, totalSessionFiles }
//    Steps:
//      - derive user_state PDA, fetch, decode UserState
//      - if metadata present, call readProfileMetadataInscription(txid)
//      - return user_state (profile data is read separately)
//    Notes:
//      - listUserSessions / readConnectionList live in list/items_collector.ts
//
// 6) readProfileMetadataInscription(txid)
//    Input:
//      - txid: string (tx signature)
//    Output:
//      - { profileData }
//    Steps:
//      - fetch tx; decode profile-related instruction
//      - reconstruct/decode metadata result
//      - return profile data
//
// 7) readConnection(partyA, partyB)
//    Input:
//      - partyA: string (base58)
//      - partyB: string (base58)
//    Output:
//      - { status }
//    Steps:
//      - derive connection seed (sorted rule)
//      - fetch/parse connection PDA
//      - return status
// Reference priority:
// - Rustrover contract marked with /// (highest priority)
// - new_backend/core/reader
// - solchat reader, iq6900 testbackend
// -----------------------------------------------------------------------------
