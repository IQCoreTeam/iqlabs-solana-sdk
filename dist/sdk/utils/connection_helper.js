"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setRpcUrl = setRpcUrl;
exports.setRpcProvider = setRpcProvider;
exports.detectConnectionSettings = detectConnectionSettings;
exports.getRpcUrl = getRpcUrl;
exports.getRpcProvider = getRpcProvider;
exports.chooseRpcUrlForFreshness = chooseRpcUrlForFreshness;
exports.getConnection = getConnection;
exports.getReaderConnection = getReaderConnection;
const web3_js_1 = require("@solana/web3.js");
// Runtime config that can be set by the consuming app
let runtimeRpcUrl;
let runtimeRpcProvider;
function setRpcUrl(url) {
    runtimeRpcUrl = url;
    // console.log(`[SDK] setRpcUrl(${url})`);
}
function setRpcProvider(provider) {
    runtimeRpcProvider = provider;
}
const env = (key) => {
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
const normalizeProvider = (value) => {
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
const inferProviderFromUrl = (url) => url.toLowerCase().includes("helius") ? "helius" : "standard";
function detectConnectionSettings() {
    const nextPublic = getNextPublicEnvVars();
    const rpcUrl = runtimeRpcUrl ??
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
function getRpcUrl() {
    const url = detectConnectionSettings().rpcUrl;
    // console.log(`[SDK] getRpcUrl() = ${url}`);
    return url;
}
function getRpcProvider() {
    const nextPublic = getNextPublicEnvVars();
    const envProvider = normalizeProvider(env("IQLABS_RPC_PROVIDER")) ??
        normalizeProvider(env("RPC_PROVIDER")) ??
        normalizeProvider(nextPublic.rpcProvider);
    return runtimeRpcProvider ?? envProvider ?? inferProviderFromUrl(getRpcUrl());
}
function chooseRpcUrlForFreshness(label) {
    const settings = detectConnectionSettings();
    if (label === "fresh") {
        return settings.freshRpcUrl ?? settings.zeroBlockRpcUrl ?? settings.rpcUrl;
    }
    if (label === "recent") {
        return settings.recentRpcUrl ?? settings.heliusRpcUrl ?? settings.rpcUrl;
    }
    return settings.rpcUrl;
}
function getConnection(commitment = "confirmed") {
    return new web3_js_1.Connection(getRpcUrl(), commitment);
}
function getReaderConnection(labelOrUrl, commitment = "confirmed") {
    if (!labelOrUrl) {
        return getConnection(commitment);
    }
    if (labelOrUrl === "fresh" ||
        labelOrUrl === "recent" ||
        labelOrUrl === "archive") {
        return new web3_js_1.Connection(chooseRpcUrlForFreshness(labelOrUrl), commitment);
    }
    return new web3_js_1.Connection(labelOrUrl, commitment);
}
//# sourceMappingURL=connection_helper.js.map