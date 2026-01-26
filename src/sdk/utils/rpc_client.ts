import {
    Connection,
    PublicKey,
    type Commitment,
    type VersionedTransactionResponse,
} from "@solana/web3.js";

import {getConnection, getRpcProvider, type RpcProvider} from "./connection_helper";

type TransactionsForAddressConfig = {
    before?: string;
    until?: string;
    limit?: number;
    commitment?: Commitment;
    maxSupportedTransactionVersion?: number;
};

type RpcRequest = (
    method: string,
    params: unknown[],
) => Promise<{ result?: unknown; error?: { message?: string } }>;

const getRpcRequest = (connection: Connection): RpcRequest => {
    const maybe = connection as Connection & { _rpcRequest?: RpcRequest };
    if (typeof maybe._rpcRequest !== "function") {
        throw new Error("RPC request helper is not available");
    }
    return maybe._rpcRequest.bind(connection);
};

export class RpcClient {
    private readonly connection: Connection;
    private readonly provider: RpcProvider;
    private readonly useHeliusEnhanced: boolean;

    constructor(options: {
        connection?: Connection;
        provider?: RpcProvider;
        useHeliusEnhanced?: boolean;
    } = {}) {
        this.connection = options.connection ?? getConnection();
        this.provider = options.provider ?? getRpcProvider();
        this.useHeliusEnhanced =
            options.useHeliusEnhanced ?? this.provider === "helius";
    }

    getConnection(): Connection {
        return this.connection;
    }

    getProvider(): RpcProvider {
        return this.provider;
    }

    heliusEnhancedEnabled(): boolean {
        return this.useHeliusEnhanced && this.provider === "helius";
    }

    async getSignaturesForAddress(
        pubkey: PublicKey,
        options?: Parameters<Connection["getSignaturesForAddress"]>[1],
    ) {
        return this.connection.getSignaturesForAddress(pubkey, options);
    }

    async getTransaction(
        signature: string,
        options?: Parameters<Connection["getTransaction"]>[1],
    ) {
        return this.connection.getTransaction(signature, options);
    }

    async getTransactionsForAddress(
        pubkey: PublicKey,
        config: TransactionsForAddressConfig = {},
    ): Promise<VersionedTransactionResponse[]> {
        if (!this.heliusEnhancedEnabled()) {
            throw new Error("getTransactionsForAddress requires a Helius RPC");
        }
        const request = getRpcRequest(this.connection);
        const params = [pubkey.toBase58(), config];
        const response = await request("getTransactionsForAddress", params);
        if (response.error) {
            throw new Error(response.error.message ?? "RPC error");
        }
        return (response.result as VersionedTransactionResponse[]) ?? [];
    }

    async tryFetchTransactionsForAddressAll(
        pubkey: PublicKey,
        config: TransactionsForAddressConfig = {},
    ): Promise<VersionedTransactionResponse[] | null> {
        if (!this.heliusEnhancedEnabled()) {
            return null;
        }
        try {
            const limit = config.limit ?? 1000;
            const maxSupportedTransactionVersion =
                config.maxSupportedTransactionVersion ?? 0;
            let before = config.before;
            const out: VersionedTransactionResponse[] = [];

            while (true) {
                const page = await this.getTransactionsForAddress(pubkey, {
                    ...config,
                    before,
                    limit,
                    maxSupportedTransactionVersion,
                });
                if (!page || page.length === 0) {
                    break;
                }
                out.push(...page);
                if (page.length < limit) {
                    break;
                }
                const lastSig =
                    page[page.length - 1]?.transaction?.signatures?.[0];
                if (!lastSig || lastSig === before) {
                    break;
                }
                before = lastSig;
            }
            return out;
        } catch {
            return null;
        }
    }
}
