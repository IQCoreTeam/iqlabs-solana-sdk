"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RpcClient = void 0;
const connection_helper_1 = require("./connection_helper");
const getRpcRequest = (connection) => {
    const maybe = connection;
    if (typeof maybe._rpcRequest !== "function") {
        throw new Error("RPC request helper is not available");
    }
    return maybe._rpcRequest.bind(connection);
};
class RpcClient {
    constructor(options = {}) {
        this.connection = options.connection ?? (0, connection_helper_1.getConnection)();
        this.provider = options.provider ?? (0, connection_helper_1.getRpcProvider)();
        this.useHeliusEnhanced =
            options.useHeliusEnhanced ?? this.provider === "helius";
    }
    getConnection() {
        return this.connection;
    }
    getProvider() {
        return this.provider;
    }
    heliusEnhancedEnabled() {
        return this.useHeliusEnhanced && this.provider === "helius";
    }
    async getSignaturesForAddress(pubkey, options) {
        return this.connection.getSignaturesForAddress(pubkey, options);
    }
    async getTransaction(signature, options) {
        return this.connection.getTransaction(signature, options);
    }
    async getTransactionsForAddress(pubkey, config = {}) {
        if (!this.heliusEnhancedEnabled()) {
            throw new Error("getTransactionsForAddress requires a Helius RPC");
        }
        const request = getRpcRequest(this.connection);
        const params = [pubkey.toBase58(), config];
        const response = await request("getTransactionsForAddress", params);
        if (response.error) {
            throw new Error(response.error.message ?? "RPC error");
        }
        return response.result ?? [];
    }
    async tryFetchTransactionsForAddressAll(pubkey, config = {}) {
        if (!this.heliusEnhancedEnabled()) {
            return null;
        }
        try {
            const limit = config.limit ?? 1000;
            const maxSupportedTransactionVersion = config.maxSupportedTransactionVersion ?? 0;
            let before = config.before;
            const out = [];
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
                const lastSig = page[page.length - 1]?.transaction?.signatures?.[0];
                if (!lastSig || lastSig === before) {
                    break;
                }
                before = lastSig;
            }
            return out;
        }
        catch {
            return null;
        }
    }
}
exports.RpcClient = RpcClient;
//# sourceMappingURL=rpc_client.js.map