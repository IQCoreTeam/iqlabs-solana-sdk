import { Keypair, PublicKey, Transaction, VersionedTransaction, type Signer } from "@solana/web3.js";
export interface WalletSigner {
    publicKey: PublicKey;
    signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>;
    signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]>;
}
export type SignerInput = Signer | Keypair | WalletSigner;
export declare function toWalletSigner(signer: SignerInput): WalletSigner;
