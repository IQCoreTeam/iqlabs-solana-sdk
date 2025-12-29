// Mode controller
// /Users/sumin/WebstormProjects/iqlabs-core-api/new_backend/core/reader/bringslot.py

// Use this to decide which RPC to use; users should register RPCs via env.
// Once set, use those endpoints for all reads.
// Support separate fast RPC and history RPC.

// Also read the target transaction slot to decide which path to use.

// In short: before reading, return the slot + info needed to choose the path.

// Planning notes (comments only)
//
// ReadOption
// - isReplay: boolean (true = replay, false = rpc)
// - endpoint?: string (rpc endpoint override)
//
// decideSessionOrLinkedList(onChainPath)
// - Inputs:
//   - onChainPath: string (base58, session PDA or tx signature)
// - Output:
//   - "session" | "linked_list"
// - Steps:
//   - if onChainPath length >= SIG_MIN_LEN, treat as tx signature candidate
//   - otherwise treat as session PDA candidate
//   - if session candidate and getAccountInfo(onChainPath) exists -> session
//   - otherwise check tx exists -> linked_list
//   - if neither, error (invalid on_chain_path)
// - Notes:
//   - length check is a fast filter; final decision uses getAccountInfo
//
// decideReadMode(txSignature)
// - Inputs:
//   - txSignature: string (the db_code_in tx signature)
// - Output:
//   - ReadOption { isReplay: boolean, endpoint?: string }
// - Steps:
//   - fetch tx blocktime/slot for freshness
//   - apply profile overrides (preferred endpoints, replay toggle)
//   - decode db_code_in args to get on_chain_path
//   - kind = decideSessionOrLinkedList(on_chain_path)
//   - if linked_list:
//     - isReplay: false
//     - endpoint: <=24h -> zeroblock, else -> helius
//   - if session:
//     - <=24h: zeroblock (rpc)
//     - <=7d: helius (rpc)
//     - >7d: replay (isReplay: true)
