import {Connection, type Commitment} from "@solana/web3.js";

// Runtime config that can be set by the consuming app. Multiple urls act as a
// failover pool: calls start on the first and rotate on rate limits/outages.
let runtimeRpcUrls: string[] = [];
let rpcCursor = 0;

export function setRpcUrl(url: string | string[]) {
    const urls = (Array.isArray(url) ? url : [url])
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
    if (urls.length === 0) {
        throw new Error("setRpcUrl requires at least one non-empty url");
    }
    runtimeRpcUrls = urls;
    rpcCursor = 0;
}

/**
 * Fail over to the next url in the configured pool. Returns a Connection on
 * the new endpoint, or null when there is nothing to rotate to — either a
 * single url is configured, or the failing connection was caller-built (its
 * endpoint is not in the pool) and the SDK must not silently replace it.
 */
export function rotateRpcConnection(
    failedEndpoint: string,
    commitment: Commitment = "confirmed",
): Connection | null {
    if (runtimeRpcUrls.length < 2) {
        return null;
    }
    const failedIndex = runtimeRpcUrls.indexOf(failedEndpoint);
    if (failedIndex === -1) {
        return null;
    }
    rpcCursor = (failedIndex + 1) % runtimeRpcUrls.length;
    return new Connection(runtimeRpcUrls[rpcCursor], commitment);
}

const env = (key: string) => {
    const value = process.env[key];
    if (!value) {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
};

// Next.js requires static access for NEXT_PUBLIC_ vars, so check them explicitly
function getNextPublicEnvVars() {
    return {
        rpcEndpoint: process.env.NEXT_PUBLIC_SOLANA_RPC_ENDPOINT,
        heliusRpc: process.env.NEXT_PUBLIC_HELIUS_RPC_URL,
    };
}

export function detectConnectionSettings(): {
    rpcUrl: string;
    heliusRpcUrl?: string;
    zeroBlockRpcUrl?: string;
    freshRpcUrl?: string;
    recentRpcUrl?: string;
} {
    const nextPublic = getNextPublicEnvVars();
    const rpcUrl =
        runtimeRpcUrls[rpcCursor] ??
        env("IQLABS_RPC_ENDPOINT") ??
        env("SOLANA_RPC_ENDPOINT") ??
        nextPublic.rpcEndpoint ??
        env("SOLANA_RPC") ??
        env("RPC_ENDPOINT") ??
        env("RPC_URL") ??
        "https://api.mainnet-beta.solana.com";

    return {
        rpcUrl,
        heliusRpcUrl: env("HELIUS_RPC_URL") ?? nextPublic.heliusRpc,
        zeroBlockRpcUrl: env("ZEROBLOCK_RPC_URL"),
        freshRpcUrl: env("FRESH_RPC_URL"),
        recentRpcUrl: env("RECENT_RPC_URL"),
    };
}

export function getRpcUrl(): string {
    const url = detectConnectionSettings().rpcUrl;
    // console.log(`[SDK] getRpcUrl() = ${url}`);
    return url;
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
