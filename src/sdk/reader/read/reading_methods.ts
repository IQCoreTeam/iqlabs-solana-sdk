// reading_methods.ts scope notes (comments only)
// - Shared low-level read helpers used by reading_flow.ts.
// - Keep logic here; reading_flow.ts just describes the path.
//
// ReadOption
// - isReplay: boolean (true = replay, false = rpc)
// - endpoint: string (rpc endpoint override)
//
// 1) readSessionResult(sessionPubkey, readOption)
//    Input:
//      - sessionPubkey: string (base58)
//      - readOption: ReadOption
//    Output:
//      - { result }
//    Steps:
//      - fetch/validate session account (discriminator/owner/size)
//      - collect session chunk txs (listSessionChunks)
//      - decode post_chunk args: seq, index, chunk, method, decode_break
//      - sort by index, reconstruct result
//      - return result
//    Notes:
//      - method/decode_break rules follow transaction.provider.ts
//
// 2) readLinkedListResult(tailTx, readOption)
//    Input:
//      - tailTx: string (tx signature)
//      - readOption: ReadOption
//    Output:
//      - { result }
//    Steps:
//      - ensure tailTx is a send_code tail (validate here if needed)
//      - walk send_code chain: decode { code, before_tx }
//      - accumulate chunks until "Genesis"
//      - reverse and reconstruct result
//      - return result
//    Notes:
//      - linked-list does not use replay
//      - RPC choice: <=24h -> zeroblock, else -> helius

export {};
