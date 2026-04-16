import { Keypair, PublicKey, Transaction, VersionedTransaction, type Signer } from "@solana/web3.js";
export interface WalletSigner {
    publicKey: PublicKey;
    signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>;
    signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]>;
}
export type SignerInput = Signer | Keypair | WalletSigner;
export declare function toWalletSigner(signer: SignerInput): WalletSigner;
/**
 * Build a {@link WalletSigner} from a bytes-based signer. Use this for
 * Solana Wallet Standard wallets (Privy v3, kit-era signers, MPC services,
 * backend signers) — anything that signs serialized transaction bytes and
 * returns signed bytes, rather than exposing a wallet-adapter object.
 */
export declare function createBytesSigner(opts: {
    address: string;
    signTransaction: (bytes: Uint8Array) => Promise<Uint8Array>;
    signAllTransactions?: (bytes: Uint8Array[]) => Promise<Uint8Array[]>;
}): WalletSigner;
