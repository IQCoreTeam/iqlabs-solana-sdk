import type {Connection} from "@solana/web3.js";

import * as core from "./core";
import {createReader, createWriter} from "./core/client";
import type {RpcClient} from "./ports/RpcClient";
import type {Signer} from "./ports/Signer";
import {
    chooseRpcUrlForFreshness,
    detectConnectionSettings,
    getConnection,
    getReaderConnection,
    getRpcProvider,
    getRpcUrl,
    setRpcProvider,
    setRpcUrl,
    type RpcProvider,
} from "./adapters/rpc/connection_helper";
import {Web3RpcClient} from "./adapters/rpc/web3RpcClient";
import {toWalletSigner} from "./adapters/signer/keypairSigner";

export type CreateClientOptions = {
    connection?: Connection;
    rpc?: RpcClient;
    signer?: Signer;
    provider?: RpcProvider;
    useHeliusEnhanced?: boolean;
    getRpcForFreshness?: (label: "fresh" | "recent" | "archive") => RpcClient;
};

export const createClient = (options: CreateClientOptions = {}) => {
    const rpc =
        options.rpc ??
        new Web3RpcClient({
            connection: options.connection ?? getConnection(),
            provider: options.provider,
            useHeliusEnhanced: options.useHeliusEnhanced,
        });

    const reader = createReader({
        rpc,
        getRpcForFreshness: options.getRpcForFreshness,
    });

    const writer = options.signer
        ? createWriter(rpc, options.signer)
        : undefined;

    return {
        rpc,
        reader,
        writer,
        signer: options.signer,
    };
};

export {
    core,
    createReader,
    createWriter,
    Web3RpcClient,
    toWalletSigner,
    setRpcUrl,
    setRpcProvider,
    getRpcUrl,
    getRpcProvider,
    chooseRpcUrlForFreshness,
    detectConnectionSettings,
    getConnection,
    getReaderConnection,
};

export * from "./core";
export * from "./ports/RpcClient";
export * from "./ports/Signer";
export * from "./ports/Logger";
export type {SignerInput, WalletSigner} from "./adapters/signer/keypairSigner";
