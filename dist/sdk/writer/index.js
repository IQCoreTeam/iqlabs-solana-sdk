"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserMetadata = exports.requestConnection = exports.manageRowData = exports.writeConnectionRow = exports.writeRow = exports.createTable = exports.codeIn = void 0;
// writer: high-level flows only
var code_in_1 = require("./code_in");
Object.defineProperty(exports, "codeIn", { enumerable: true, get: function () { return code_in_1.codeIn; } });
var iqdb_1 = require("./iqdb");
Object.defineProperty(exports, "createTable", { enumerable: true, get: function () { return iqdb_1.createTable; } });
Object.defineProperty(exports, "writeRow", { enumerable: true, get: function () { return iqdb_1.writeRow; } });
Object.defineProperty(exports, "writeConnectionRow", { enumerable: true, get: function () { return iqdb_1.writeConnectionRow; } });
Object.defineProperty(exports, "manageRowData", { enumerable: true, get: function () { return iqdb_1.manageRowData; } });
Object.defineProperty(exports, "requestConnection", { enumerable: true, get: function () { return iqdb_1.requestConnection; } });
Object.defineProperty(exports, "updateUserMetadata", { enumerable: true, get: function () { return iqdb_1.updateUserMetadata; } });
