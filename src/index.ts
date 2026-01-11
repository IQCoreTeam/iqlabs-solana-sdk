import * as contract from "./contract";
import * as reader from "./sdk/reader";
import * as writer from "./sdk/writer";
import * as wallet from "./sdk/utils/wallet";
import * as constants from "./sdk/constants";
import * as utils from "./sdk/utils";
import {setRpcUrl} from "./sdk/utils/connection_helper";

export {contract, reader, writer, wallet,utils, setRpcUrl};
export * from "./sdk/constants";
import {getRpcUrl}from "./sdk/utils/connection_helper";

const iqlabs = {
    contract,
    reader,
    writer,
    utils,
    wallet,
    constants,
    setRpcUrl,
    getRpcUrl,

};

export {iqlabs};
export default iqlabs;
