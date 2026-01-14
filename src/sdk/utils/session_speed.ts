export const DEFAULT_SESSION_SPEED = "light" as const;
export const SESSION_SPEED_PROFILES = {
    light: {maxRps: 5, maxConcurrency:  10}, //this was good with helius but you guys can maintain it
    medium: {maxRps: 50, maxConcurrency: 50},
    heavy: {maxRps: 100, maxConcurrency: 100},
    extreme: {maxRps: 250, maxConcurrency: 250},

} satisfies Record<string, { maxRps: number; maxConcurrency: number }>;

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
