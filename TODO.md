TODO
- `src/sdk/reader/reading_methods.ts`: `readSessionResult` still ignores `method`/`decode_break` and does not validate the session account discriminator/owner/size. Add proper decode/decrypt/decompress handling and account validation.
- `src/contract/constants.ts`: add remaining backend base URL constants (reader/replay) once final endpoints are decided.


//todo : make the CodeInOptions simple, decide automatically by the status will be good inside. or default is just fast and make it chooseable 
inline the all function that never reuse. no need to make like useSession type. 

return sendTx(connection, signer, ix, {label: "write_data"});
}

export async function writeConnectionRow(
@@ -234,7 +234,7 @@ export async function writeConnectionRow(
},
);

    return sendTx(connection, signer, ix, {label: "write_connection_data"});

no need to make the meanless label. we know our action by reading the insctuction. 


we dont need to make the label in all the send tx .