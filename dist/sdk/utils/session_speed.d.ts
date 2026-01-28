export declare const DEFAULT_SESSION_SPEED: "light";
export declare const SESSION_SPEED_PROFILES: {
    light: {
        maxRps: number;
        maxConcurrency: number;
    };
    medium: {
        maxRps: number;
        maxConcurrency: number;
    };
    heavy: {
        maxRps: number;
        maxConcurrency: number;
    };
    extreme: {
        maxRps: number;
        maxConcurrency: number;
    };
};
export type SessionSpeedKey = keyof typeof SESSION_SPEED_PROFILES;
export declare const resolveSessionSpeed: (speed?: string) => SessionSpeedKey;
