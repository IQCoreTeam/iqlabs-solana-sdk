import {Connection, type Commitment} from "@solana/web3.js";

const env = (key: string) => {
    const value = process.env[key];
    if (!value) {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
};

export function detectConnectionSettings(): {
    rpcUrl: string;
    heliusRpcUrl?: string;
    zeroBlockRpcUrl?: string;
    freshRpcUrl?: string;
    recentRpcUrl?: string;
} {
    return {
        rpcUrl:
            env("IQLABS_RPC_ENDPOINT") ??
            env("SOLANA_RPC_ENDPOINT") ??
            env("SOLANA_RPC") ??
            env("RPC_ENDPOINT") ??
            env("RPC_URL"),
        heliusRpcUrl: env("HELIUS_RPC_URL"),
        zeroBlockRpcUrl: env("ZEROBLOCK_RPC_URL"),
        freshRpcUrl: env("FRESH_RPC_URL"),
        recentRpcUrl: env("RECENT_RPC_URL"),
    };
}

export function getRpcUrl(): string {
    return detectConnectionSettings().rpcUrl;
}

export function chooseRpcUrlForFreshness(
    label: "fresh" | "recent" | "archive",
): string {
    const settings = detectConnectionSettings();
    if (label === "fresh") {
        return settings.freshRpcUrl ?? settings.zeroBlockRpcUrl ?? settings.rpcUrl;
    }
    if (label === "recent") {
        return settings.recentRpcUrl ?? settings.heliusRpcUrl ?? settings.rpcUrl;
    }
    return settings.rpcUrl;
}

export function getConnection(
    commitment: Commitment = "confirmed",
): Connection {
    return new Connection(getRpcUrl(), commitment);
}

export function getReaderConnection(
    labelOrUrl?: "fresh" | "recent" | "archive" | string,
    commitment: Commitment = "confirmed",
): Connection {
    if (!labelOrUrl) {
        return getConnection(commitment);
    }
    if (
        labelOrUrl === "fresh" ||
        labelOrUrl === "recent" ||
        labelOrUrl === "archive"
    ) {
        return new Connection(chooseRpcUrlForFreshness(labelOrUrl), commitment);
    }
    return new Connection(labelOrUrl, commitment);
}
