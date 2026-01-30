"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveSessionSpeed = exports.SESSION_SPEED_PROFILES = exports.DEFAULT_SESSION_SPEED = void 0;
exports.DEFAULT_SESSION_SPEED = "light";
exports.SESSION_SPEED_PROFILES = {
    light: { maxRps: 2, maxConcurrency: 5 }, //this was good with helius but you guys can maintain it
    medium: { maxRps: 50, maxConcurrency: 50 },
    heavy: { maxRps: 100, maxConcurrency: 100 },
    extreme: { maxRps: 250, maxConcurrency: 250 },
};
const resolveSessionSpeed = (speed) => {
    if (typeof speed === "string" &&
        Object.prototype.hasOwnProperty.call(exports.SESSION_SPEED_PROFILES, speed)) {
        return speed;
    }
    return exports.DEFAULT_SESSION_SPEED;
};
exports.resolveSessionSpeed = resolveSessionSpeed;
