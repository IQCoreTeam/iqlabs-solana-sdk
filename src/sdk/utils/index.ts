export {deriveDmSeed, toSeedBytes} from "./seed";
export type {WalletSigner, SignerInput} from "./wallet";

export function shortenSig(sig: string): string {
    if (sig.length <= 11) return sig;
    return sig.slice(0, 4) + "..." + sig.slice(-4);
}

