TODO
- `src/sdk/reader/reading_methods.ts`: `readSessionResult` still ignores `method`/`decode_break` and does not validate the session account discriminator/owner/size. Add proper decode/decrypt/decompress handling and account validation.
- `src/contract/constants.ts`: set replay service base URL (and reader base URL if needed) once final endpoints are decided.
- Consider folding whitelist checks into `db_code_in` so whitelisted users can be free automatically later; plan to remove `db_code_in_for_free`.
- 테이블 row 입력은 생성된 테이블 스키마(컬럼 + id_col)에 맞춘 JSON이어야 함을 문서로 명시.

----
We switched only the table path (database) to emit, removing the 100-character limit, and kept connections as-is.
We also made small data use an empty on_chain_path while updating metadata, with IQ holders free and others paying 0.001 SOL.

--Things to set after finishing
- programs/iqlabs/src/constants.rs: set real IQ_MINT value + confirm IQ_HOLD_MIN units/decimals.
- Verify users with >= IQ_HOLD_MIN get free short direct inscriptions.

TODO for SDK
1. Remove table_ref/target_table_ref accounts when calling create_table/create_private_table/write_data/database_instruction


IDL 변경(테이블 관련 계정 제거) 기준으로 SDK 영향 범위 정리: global_fetch.ts, iqdb.ts에서 table_ref/target_table_ref 제거가 필요한 호출/검증 포인트 목록화.
code_in 플로우 설계:
short inscription(≤900 bytes metadata)만 metadata.data 포함, on_chain_path=""
우리는 멀티 탭을 지원 해야 할수도 잇음, 뭐 개발자 모드를 키면 디폴트 모드가아닌 탭을 볼수있다던가 그런거 말이지 
그리고 디폴트 값을 이제 상수로 관리 하는데, 이걸 reader 건 writer 건 다 적용해서 한번에 바꾸야 할듯