import {Connection, type Commitment} from "@solana/web3.js";

export type RpcProvider = "helius" | "standard";

// Runtime config that can be set by the consuming app
let runtimeRpcUrl: string | undefined;
let runtimeRpcProvider: RpcProvider | undefined;

export function setRpcUrl(url: string) {
    runtimeRpcUrl = url;
    // console.log(`[SDK] setRpcUrl(${url})`);
}

export function setRpcProvider(provider: RpcProvider) {
    runtimeRpcProvider = provider;
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
        rpcProvider: process.env.NEXT_PUBLIC_IQLABS_RPC_PROVIDER,
    };
}

const normalizeProvider = (value?: string): RpcProvider | undefined => {
    if (!value) {
        return undefined;
    }
    const trimmed = value.trim().toLowerCase();
    if (trimmed === "helius") {
        return "helius";
    }
    if (trimmed === "standard" || trimmed === "rpc") {
        return "standard";
    }
    return undefined;
};

const inferProviderFromUrl = (url: string): RpcProvider =>
    url.toLowerCase().includes("helius") ? "helius" : "standard";

export function detectConnectionSettings(): {
    rpcUrl: string;
    heliusRpcUrl?: string;
    zeroBlockRpcUrl?: string;
    freshRpcUrl?: string;
    recentRpcUrl?: string;
} {
    const nextPublic = getNextPublicEnvVars();
    const rpcUrl =
        runtimeRpcUrl ??
        env("IQLABS_RPC_ENDPOINT") ??
        env("SOLANA_RPC_ENDPOINT") ??
        env("HELIUS_RPC_URL") ??
        nextPublic.rpcEndpoint ??
        nextPublic.heliusRpc ??
        env("SOLANA_RPC") ??
        env("RPC_ENDPOINT") ??
        env("RPC_URL") ??
        "https://api.devnet.solana.com";

    // console.log(`[SDK] detectConnectionSettings: runtimeRpcUrl=${runtimeRpcUrl}, nextPublic.rpcEndpoint=${nextPublic.rpcEndpoint}, final=${rpcUrl}`);

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

export function getRpcProvider(): RpcProvider {
    const nextPublic = getNextPublicEnvVars();
    const envProvider =
        normalizeProvider(env("IQLABS_RPC_PROVIDER")) ??
        normalizeProvider(env("RPC_PROVIDER")) ??
        normalizeProvider(nextPublic.rpcProvider);
    return runtimeRpcProvider ?? envProvider ?? inferProviderFromUrl(getRpcUrl());
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
