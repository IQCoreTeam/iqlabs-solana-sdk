import { PublicKey, type MessageAccountKeys, type MessageCompiledInstruction, type VersionedTransactionResponse } from "@solana/web3.js";
declare const instructionCoder: import("@coral-xyz/anchor").BorshInstructionCoder;
export declare const decodeReaderInstruction: (ix: MessageCompiledInstruction, accountKeys: MessageAccountKeys) => ReturnType<typeof instructionCoder.decode> | null;
export declare const decodeUserInventoryCodeIn: (tx: VersionedTransactionResponse, mode?: string) => {
    onChainPath: string;
    metadata: string;
};
export declare const extractCodeInPayload: (tx: VersionedTransactionResponse, mode?: string) => {
    onChainPath: string;
    metadata: string;
    inlineData: string | null;
};
export declare function fetchAccountTransactions(// this use for bringing the db pda list, session chunk list, friend list , we dont check data here bacause it increases rpc call
account: string | PublicKey, options?: {
    before?: string;
    limit?: number;
}): Promise<import("@solana/web3.js").ConfirmedSignatureInfo[]>;
export declare function getSessionPdaList(userPubkey: string, mode?: string): Promise<string[]>;
export declare function fetchUserConnections(userPubkey: PublicKey | string, options?: {
    limit?: number;
    before?: string;
    speed?: "light" | "medium" | "heavy" | "extreme";
    mode?: string;
}): Promise<Array<{
    dbRootId: string;
    connectionPda: string;
    partyA: string;
    partyB: string;
    status: "pending" | "approved" | "blocked";
    requester: "a" | "b";
    blocker: "a" | "b" | "none";
    timestamp?: number;
}>>;
export {};
