// items_collector.ts scope notes (comments only)
// - Only functions that collect lists live here.
// - Lists needed by read/reading_flow.ts are provided here.
//
// Candidate functions for items_collector.ts (rough draft)
//
// 0) fetchAccountTransactions(pubkey): collect transactions by account
//    All list readers below should use this.
//
// 1) listUserSessions(userPubkey, totalSessionFiles)
//    - Role: build session PDA list by seq.
//    - Used by: follow-up after readUserState.
//
// 2) listSessionChunks(sessionPubkey, opts)
//    - Role: collect session chunk transactions.
//    - Used by: readSession reconstruction flow.
//
// 3) readRecentRows(params)
//    - Role: list recent tables/rows (includes readRowsByTable inside).
//    - Internals: call readRowsByTable to reconstruct rows.
//
// 4) readRowsByTable(params)
//    - Role: decode write_data + database_instruction to reconstruct rows.
//    - Note: filter by table_seed + merge by target_tx.
//
// 5) readRowsBySeed(partyA, partyB, opts)
//    - Role: take both pubkeys, derive seed, and return list.
//    - Note: unifies the old readRowsByDmSeed concept.
// 6) readConnectionList(partyA, partyB, opts)
//    - Role: read userPda and fetch only request_connection entries.
//    - Note: prefer the account-transaction utility.
//
// 7) listDbAccountTransactions(dbPda, opts)
//    - Role: collect db_account related transactions.
//    - Used by: readDbEntry linked list/inscription helpers.
// ----- rent data -----
//
// 8) listTableSeedsFromDbRoot(rootId, opts)
//    - Role: get table seed list from DbRoot (meta/table list).
//    - Note: split into its own section because this is meta/structure.
//
//
export {};
