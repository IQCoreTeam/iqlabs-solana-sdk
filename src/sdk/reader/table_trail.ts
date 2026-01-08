import {BorshCoder, EventParser, type Idl} from "@coral-xyz/anchor";
import {PublicKey, type VersionedTransactionResponse} from "@solana/web3.js";

import {getConnection} from "../utils/connection_helper";
import {readerContext} from "./reader_context";

const {idl, anchorProfile, pinocchioProfile} = readerContext;
const EVENT_CODER = new BorshCoder(idl as Idl);

export const parseTableTrailEventsFromLogs = (
    logs: string[],
    mode: "anchor" | "pinocchio",
) => {
    if (!logs || logs.length === 0) {
        return [];
    }
    const programId =
        mode === "anchor"
            ? anchorProfile.programId
            : pinocchioProfile.programId;
    const parser = new EventParser(programId, EVENT_CODER);
    const events: Array<{
        table: PublicKey;
        signer: PublicKey;
        data: Uint8Array<any>;
        path: Uint8Array<any>;
    }> = [];

    for (const event of parser.parseLogs(logs)) {
        if (event.name !== "TableTrailEmitted") {
            continue;
        }
        const eventData = event.data as {
            table: PublicKey;
            signer: PublicKey;
            data: Uint8Array<any>;
            target?: Uint8Array<any>;
            path?: Uint8Array<any>;
        };
        events.push({
            table: eventData.table,
            signer: eventData.signer,
            data: eventData.data,
            path: eventData.path ?? eventData.target ?? new Uint8Array(),
        });
    }

    return events;
};

export const parseTableTrailEventsFromTx = (
    tx: VersionedTransactionResponse | null,
    mode: "anchor" | "pinocchio",
) => parseTableTrailEventsFromLogs(tx?.meta?.logMessages ?? [], mode);

export async function readTableTrailEvents(
    txSignature: string,
    mode: "anchor" | "pinocchio",
) {
    const connection = getConnection();
    const tx = await connection.getTransaction(txSignature, {
        maxSupportedTransactionVersion: 0,
    });
    if (!tx) {
        throw new Error("transaction not found");
    }
    return parseTableTrailEventsFromLogs(tx.meta?.logMessages ?? [], mode);
}
