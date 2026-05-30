export const DEFAULT_SESSION_SPEED = "light" as const;
export const SESSION_SPEED_PROFILES = {
    light: {maxRps: 2, maxConcurrency:  5, maxConcurrencyUpload: 1}, //this was good with helius but you guys can maintain it
    medium: {maxRps: 50, maxConcurrency: 50, maxConcurrencyUpload: 5},
    heavy: {maxRps: 100, maxConcurrency: 100, maxConcurrencyUpload: 50},
    extreme: {maxRps: 250, maxConcurrency: 250, maxConcurrencyUpload: 100},

} satisfies Record<string, SessionSpeedConfig>;

export interface SessionSpeedConfig {
    maxRps: number;
    maxConcurrency: number;
    maxConcurrencyUpload: number;
}

export type SessionSpeedKey = keyof typeof SESSION_SPEED_PROFILES;

/** What writer/reader functions accept for the `speed` parameter.
 *  Either a preset name or a raw override of any subset of the three dials —
 *  missing keys fall back to the current `DEFAULT_SESSION_SPEED` preset. */
export type SessionSpeedOption = SessionSpeedKey | Partial<SessionSpeedConfig>;

export const resolveSessionSpeed = (speed?: string): SessionSpeedKey => {
    if (
        typeof speed === "string" &&
        Object.prototype.hasOwnProperty.call(SESSION_SPEED_PROFILES, speed)
    ) {
        return speed as SessionSpeedKey;
    }
    return DEFAULT_SESSION_SPEED;
};

/** Resolve any caller `speed` value into a concrete config object.
 *  `undefined` / unknown string → DEFAULT_SESSION_SPEED preset.
 *  Known preset string → that preset.
 *  Object → DEFAULT_SESSION_SPEED preset overlaid with the provided dials. */
export const resolveSessionConfig = (speed?: SessionSpeedOption): SessionSpeedConfig => {
    if (typeof speed === "object" && speed !== null) {
        return { ...SESSION_SPEED_PROFILES[DEFAULT_SESSION_SPEED], ...speed };
    }
    return SESSION_SPEED_PROFILES[resolveSessionSpeed(speed)];
};
