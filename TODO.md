TODO
- `src/sdk/reader/reading_methods.ts`: `readSessionResult` still ignores `method`/`decode_break` and does not validate the session account discriminator/owner/size. Add proper decode/decrypt/decompress handling and account validation.
- `src/sdk/reader/reader_utils.ts`: `listUserSessions` / `readConnectionList` are referenced in `src/sdk/reader/reading_flow.ts` but not implemented. Decide whether to implement or drop them.
- `src/contract/constants.ts`: add remaining backend base URL constants (reader/replay) once final endpoints are decided.
