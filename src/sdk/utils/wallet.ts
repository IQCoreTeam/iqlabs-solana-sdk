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

/**
 * Build a {@link WalletSigner} from a bytes-based signer. Use this for
 * Solana Wallet Standard wallets (Privy v3, kit-era signers, MPC services,
 * backend signers) — anything that signs serialized transaction bytes and
 * returns signed bytes, rather than exposing a wallet-adapter object.
 */
export function createBytesSigner(opts: {
    address: string;
    signTransaction: (bytes: Uint8Array) => Promise<Uint8Array>;
    signAllTransactions?: (bytes: Uint8Array[]) => Promise<Uint8Array[]>;
}): WalletSigner {
    const publicKey = new PublicKey(opts.address);

    const serialize = (tx: Transaction | VersionedTransaction): Uint8Array =>
        tx instanceof VersionedTransaction
            ? tx.serialize()
            : new Uint8Array(tx.serialize({requireAllSignatures: false, verifySignatures: false}));

    const deserialize = <T extends Transaction | VersionedTransaction>(bytes: Uint8Array, template: T): T =>
        (template instanceof VersionedTransaction
            ? VersionedTransaction.deserialize(bytes)
            : Transaction.from(bytes)) as T;

    const signOne = async <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> => {
        const signed = await opts.signTransaction(serialize(tx));
        return deserialize(signed, tx);
    };

    return {
        publicKey,
        signTransaction: signOne,
        signAllTransactions: async <T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> => {
            if (opts.signAllTransactions) {
                const signed = await opts.signAllTransactions(txs.map(serialize));
                return signed.map((bytes, i) => deserialize(bytes, txs[i]));
            }
            const out: T[] = [];
            for (const tx of txs) out.push(await signOne(tx));
            return out;
        },
    };
}
