import { Connection, PublicKey, type Commitment, type VersionedTransactionResponse } from "@solana/web3.js";
import { type RpcProvider } from "./connection_helper";
type TransactionsForAddressConfig = {
    before?: string;
    until?: string;
    limit?: number;
    commitment?: Commitment;
    maxSupportedTransactionVersion?: number;
};
export declare class RpcClient {
    private readonly connection;
    private readonly provider;
    private readonly useHeliusEnhanced;
    constructor(options?: {
        connection?: Connection;
        provider?: RpcProvider;
        useHeliusEnhanced?: boolean;
    });
    getConnection(): Connection;
    getProvider(): RpcProvider;
    heliusEnhancedEnabled(): boolean;
    getSignaturesForAddress(pubkey: PublicKey, options?: Parameters<Connection["getSignaturesForAddress"]>[1]): Promise<import("@solana/web3.js").ConfirmedSignatureInfo[]>;
    getTransaction(signature: string, options?: Parameters<Connection["getTransaction"]>[1]): Promise<import("@solana/web3.js").TransactionResponse>;
    getTransactionsForAddress(pubkey: PublicKey, config?: TransactionsForAddressConfig): Promise<VersionedTransactionResponse[]>;
    tryFetchTransactionsForAddressAll(pubkey: PublicKey, config?: TransactionsForAddressConfig): Promise<VersionedTransactionResponse[] | null>;
}
export {};
