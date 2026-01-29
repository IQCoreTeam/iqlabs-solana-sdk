import * as contract from "./contract";
import * as reader from "./sdk/reader";
import * as writer from "./sdk/writer";
import * as wallet from "./sdk/utils/wallet";
import * as constants from "./sdk/constants";
import * as utils from "./sdk/utils";
import {setRpcProvider, setRpcUrl, getRpcProvider, getRpcUrl} from "./sdk/utils/connection_helper";

export {contract, reader, writer, constants, wallet, utils, setRpcUrl, setRpcProvider, getRpcUrl, getRpcProvider};

const iqlabs = {
    contract,
    reader,
    writer,
    utils,
    wallet,
    constants,
    setRpcUrl,
    setRpcProvider,
    getRpcUrl,
    getRpcProvider,
};

export {iqlabs};
export default iqlabs;
