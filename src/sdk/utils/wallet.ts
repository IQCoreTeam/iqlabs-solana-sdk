import {Keypair, PublicKey, Transaction, VersionedTransaction, type Signer} from "@solana/web3.js";

export interface WalletSigner {
    publicKey: PublicKey;
    signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>;
    signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]>;
}

export type SignerInput = Signer | Keypair | WalletSigner;

function isWalletSigner(signer: SignerInput): signer is WalletSigner {
    return typeof (signer as WalletSigner).signTransaction === "function";
}

export function toWalletSigner(signer: SignerInput): WalletSigner {
    if (isWalletSigner(signer)) {
        return signer;
    }
    const keypair = signer as Keypair;
    return {
        publicKey: keypair.publicKey,
        signTransaction: async <T extends Transaction | VersionedTransaction>(tx: T) => {
            if (tx instanceof Transaction) {
                tx.partialSign(keypair);
            } else {
                tx.sign([keypair]);
            }
            return tx;
        },
        signAllTransactions: async <T extends Transaction | VersionedTransaction>(txs: T[]) => {
            for (const tx of txs) {
                if (tx instanceof Transaction) {
                    tx.partialSign(keypair);
                } else {
                    tx.sign([keypair]);
                }
            }
            return txs;
        },
    };
}
