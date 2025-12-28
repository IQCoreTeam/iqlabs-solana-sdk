// Planning notes (comments only)
// - readData(request): route by input type (session/DB/user/connection)
//   - should load reader profile settings
/// The items below live in read/reading_flow.ts; call into that.
//// Everything should now live under read/.
// - readSession(sessionPubkey): session read entry
// - readDbEntry(txSignature): DB path read entry
// - readUserState(userPubkey): user read entry
// - readConnection(partyA, partyB): connection read entry
// - No Reader object; export functions.

export {};
