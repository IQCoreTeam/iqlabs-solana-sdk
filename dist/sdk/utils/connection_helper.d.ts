import { Connection, type Commitment } from "@solana/web3.js";
export type RpcProvider = "helius" | "standard";
export declare function setRpcUrl(url: string): void;
export declare function setRpcProvider(provider: RpcProvider): void;
export declare function detectConnectionSettings(): {
    rpcUrl: string;
    heliusRpcUrl?: string;
    zeroBlockRpcUrl?: string;
    freshRpcUrl?: string;
    recentRpcUrl?: string;
};
export declare function getRpcUrl(): string;
export declare function getRpcProvider(): RpcProvider;
export declare function chooseRpcUrlForFreshness(label: "fresh" | "recent" | "archive"): string;
export declare function getConnection(commitment?: Commitment): Connection;
export declare function getReaderConnection(labelOrUrl?: "fresh" | "recent" | "archive" | string, commitment?: Commitment): Connection;
