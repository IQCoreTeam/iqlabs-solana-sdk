"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.iqlabs = exports.setRpcUrl = exports.utils = exports.wallet = exports.constants = exports.writer = exports.reader = exports.contract = void 0;
const contract = __importStar(require("./contract"));
exports.contract = contract;
const reader = __importStar(require("./sdk/reader"));
exports.reader = reader;
const writer = __importStar(require("./sdk/writer"));
exports.writer = writer;
const wallet = __importStar(require("./sdk/utils/wallet"));
exports.wallet = wallet;
const constants = __importStar(require("./sdk/constants"));
exports.constants = constants;
const utils = __importStar(require("./sdk/utils"));
exports.utils = utils;
const connection_helper_1 = require("./sdk/utils/connection_helper");
Object.defineProperty(exports, "setRpcUrl", { enumerable: true, get: function () { return connection_helper_1.setRpcUrl; } });
const connection_helper_2 = require("./sdk/utils/connection_helper");
const iqlabs = {
    contract,
    reader,
    writer,
    utils,
    wallet,
    constants,
    setRpcUrl: connection_helper_1.setRpcUrl,
    getRpcUrl: connection_helper_2.getRpcUrl,
};
exports.iqlabs = iqlabs;
exports.default = iqlabs;
