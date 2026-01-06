import {PublicKey} from "@solana/web3.js";
import {getSessionPda, getUserPda} from "../../contract";
import {getConnection} from "../utils/connection_helper";
import {readerContext} from "./reader_context";

export async function fetchAccountTransactions( // this use for bringing the db pda list, session chunk list, friend list , we dont check data here bacause it increases rpc call
    account: string | PublicKey,
    options: { before?: string; limit?: number } = {},
) {
    const {before, limit} = options;
    if (typeof limit === "number" && limit <= 0) {
        return [];
    }

    const pubkey = typeof account === "string" ? new PublicKey(account) : account;
    return getConnection().getSignaturesForAddress(pubkey, {before, limit});
}

export async function getSessionPdaList(userPubkey: string): Promise<string[]> {
    const connection = getConnection();
    const user = new PublicKey(userPubkey);
    const userState = getUserPda(readerContext.pinocchioProfile, user);
    const info = await connection.getAccountInfo(userState);
    if (!info) {
        throw new Error("user_state not found");
    }
    const decoded = readerContext.accountCoder.decode("UserState", info.data) as {
        total_session_files: { toString(): string };
    };
    const totalSessionFiles = BigInt(decoded.total_session_files.toString());
    const sessions: string[] = [];

    for (let seq = BigInt(0); seq < totalSessionFiles; seq += BigInt(1)) {
        const session = getSessionPda(readerContext.pinocchioProfile, user, seq);
        sessions.push(session.toBase58());
    }

    return sessions;
}
