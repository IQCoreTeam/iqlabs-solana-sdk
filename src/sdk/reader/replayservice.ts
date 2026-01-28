// Replay service integration (SDK side).
// - Replay is optional; SDK core stays RPC/on-chain by default.
// - This client targets backend /replay endpoints.
// - Provide replayBaseUrl to point at a specific backend origin.

import {DEFAULT_REPLAY_BASE_URL} from "../../contract";

export interface ReplayService {
    enqueueReplay(request: {
        sessionPubkey: string;
    }): Promise<{
        jobId: string;
        status: string;
        retryAfter?: number;
        estimatedWaitMs?: number;
    }>;
    getReplayStatus(jobId: string): Promise<{
        jobId: string;
        status: string;
        error?: string;
        chunkStats?: Record<string, unknown>;
        hasArtifact: boolean;
        downloadUrl?: string;
    }>;
    getReplayLogs(jobId: string): Promise<Record<string, unknown>>;
    downloadReplay(jobId: string): Promise<{
        data: Uint8Array<any>;
        contentType?: string;
        filename?: string;
    }>;
}

const resolveBrowserOrigin = (): string | null => {
    const globalWithLocation = globalThis as {
        location?: { origin?: string };
    };
    const origin = globalWithLocation.location?.origin;
    return origin && origin.length > 0 ? origin : null;
};

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");
const normalizeBaseUrl = (value?: string | null): string | null => {
    if (!value) {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};

const resolveReplayBaseUrl = (override?: string): string | null => {
    const explicit = normalizeBaseUrl(override);
    if (explicit) {
        return explicit;
    }
    const fallback = normalizeBaseUrl(DEFAULT_REPLAY_BASE_URL);
    if (fallback) {
        return fallback;
    }
    return resolveBrowserOrigin();
};

const pickFetcher = (fetcher?: typeof fetch) => {
    if (fetcher) {
        return fetcher;
    }
    const globalWithFetch = globalThis as {
        fetch?: typeof fetch;
    };
    if (typeof globalWithFetch.fetch === "function") {
        return globalWithFetch.fetch.bind(globalThis);
    }
    throw new Error("fetch is not available; provide replayservice fetcher");
};

const parseFilename = (contentDisposition: string | null): string | undefined => {
    if (!contentDisposition) {
        return undefined;
    }
    const match = /filename=\"?([^\";]+)\"?/i.exec(contentDisposition);
    return match?.[1];
};

export class ReplayServiceClient implements ReplayService {
    private readonly baseUrl: string | null;
    private readonly fetcher: typeof fetch;
    private readonly headers: Record<string, string>;

    constructor(
        config: {
            replayBaseUrl?: string;
            headers?: Record<string, string>;
            fetcher?: typeof fetch;
        } = {},
    ) {
        this.baseUrl = resolveReplayBaseUrl(config.replayBaseUrl);
        this.fetcher = pickFetcher(config.fetcher);
        this.headers = {...(config.headers ?? {})};
    }

    async enqueueReplay(request: { sessionPubkey: string }): Promise<{
        jobId: string;
        status: string;
        retryAfter?: number;
        estimatedWaitMs?: number;
    }> {
        const payload: Record<string, unknown> = {
            sessionPubkey: request.sessionPubkey,
        };
        return this.requestJson<{
            jobId: string;
            status: string;
            retryAfter?: number;
            estimatedWaitMs?: number;
        }>("/replay", {
            method: "POST",
            headers: {"Content-Type": "application/json", ...this.headers},
            body: JSON.stringify(payload),
        });
    }

    async getReplayStatus(jobId: string): Promise<{
        jobId: string;
        status: string;
        error?: string;
        chunkStats?: Record<string, unknown>;
        hasArtifact: boolean;
        downloadUrl?: string;
    }> {
        return this.requestJson<{
            jobId: string;
            status: string;
            error?: string;
            chunkStats?: Record<string, unknown>;
            hasArtifact: boolean;
            downloadUrl?: string;
        }>(`/replay/${jobId}`, {
            method: "GET",
            headers: this.headers,
        });
    }

    async getReplayLogs(jobId: string): Promise<Record<string, unknown>> {
        return this.requestJson<Record<string, unknown>>(
            `/replay/${jobId}/logs`,
            {
                method: "GET",
                headers: this.headers,
            },
        );
    }

    async downloadReplay(jobId: string): Promise<{
        data: Uint8Array<any>;
        contentType?: string;
        filename?: string;
    }> {
        const response = await this.requestRaw(`/replay/${jobId}/download`, {
            method: "GET",
            headers: this.headers,
        });
        const buffer = await response.arrayBuffer();
        return {
            data: new Uint8Array(buffer),
            contentType: response.headers.get("Content-Type") ?? undefined,
            filename: parseFilename(response.headers.get("Content-Disposition")),
        };
    }

    private buildUrl(path: string): string {
        if (!this.baseUrl) {
            throw new Error("replay service baseUrl is not set");
        }
        const base = trimTrailingSlash(this.baseUrl);
        const suffix = path.startsWith("/") ? path : `/${path}`;
        return `${base}${suffix}`;
    }

    private async requestRaw(path: string, init: RequestInit): Promise<Response> {
        const response = await this.fetcher(this.buildUrl(path), init);
        if (!response.ok) {
            const body = await response.text().catch(() => "");
            const message = body ? `: ${body}` : "";
            throw new Error(`replay request failed (${response.status})${message}`);
        }
        return response;
    }

    private async requestJson<T>(path: string, init: RequestInit): Promise<T> {
        const response = await this.requestRaw(path, init);
        const text = await response.text();
        if (!text) {
            return {} as T;
        }
        try {
            return JSON.parse(text) as T;
        } catch {
            throw new Error("replay response is not valid JSON");
        }
    }
}
