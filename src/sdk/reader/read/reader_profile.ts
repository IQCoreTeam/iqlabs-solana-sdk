// Mode controller
// /Users/sumin/WebstormProjects/iqlabs-core-api/new_backend/core/reader/bringslot.py

// Use this to decide which RPC to use; users should register RPCs via env.
// Once set, use those endpoints for all reads.
// Support separate fast RPC and history RPC.

// Also read the target transaction slot to decide which path to use.

// In short: before reading, return the slot + info needed to choose the path.

// Planning notes (comments only)
// - decideReadMode(sessionPubkey, hints): onchain/replay split
//   - apply reader profile settings + freshness hints
