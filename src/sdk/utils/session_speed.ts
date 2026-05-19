export const DEFAULT_SESSION_SPEED = "light" as const;
export const SESSION_SPEED_PROFILES = {
    light: {maxRps: 2, maxConcurrency:  5, maxConcurrencyUpload: 1}, //this was good with helius but you guys can maintain it
    medium: {maxRps: 50, maxConcurrency: 50, maxConcurrencyUpload: 5},
    heavy: {maxRps: 100, maxConcurrency: 100, maxConcurrencyUpload: 50},
    extreme: {maxRps: 250, maxConcurrency: 250, maxConcurrencyUpload: 100},

} satisfies Record<string, { maxRps: number; maxConcurrency: number, maxConcurrencyUpload: number }>;

export type SessionSpeedKey = keyof typeof SESSION_SPEED_PROFILES;

export const resolveSessionSpeed = (speed?: string): SessionSpeedKey => {
    if (
        typeof speed === "string" &&
        Object.prototype.hasOwnProperty.call(SESSION_SPEED_PROFILES, speed)
    ) {
        return speed as SessionSpeedKey;
    }
    return DEFAULT_SESSION_SPEED;
};
