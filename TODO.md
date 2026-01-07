TODO
- `src/sdk/reader/reading_methods.ts`: `readSessionResult` still ignores `method`/`decode_break` and does not validate the session account discriminator/owner/size. Add proper decode/decrypt/decompress handling and account validation.
- `src/contract/constants.ts`: add remaining backend base URL constants (reader/replay) once final endpoints are decided.

----
We switched only the table path (database) to emit, removing the 100-character limit, and kept connections as-is.
We also made small data use an empty on_chain_path while updating metadata, with IQ holders free and others paying 0.001 SOL.

--Things to set after finishing
- programs/iqlabs/src/constants.rs: set real IQ_MINT value + confirm IQ_HOLD_MIN units/decimals.

TODO for SDK
1. Remove table_ref/target_table_ref accounts when calling create_table/create_private_table/write_data/database_instruction
2. Add consumer logic in the indexer/SDK for the TableTrailEmitted event
3. For IQ holders, pass ATA to codein. To save RPC calls, do only the minimum checks (maybe just existence, or even skip that) before sending to the contract.
4. programs/iqlabs/src/constants.rs: set IQ_MINT to a test token here and verify that users with >= IQ_HOLD_MIN get free short direct inscriptions




테이블 쓰기/관리에서 table_ref/target_table_ref 제거: global_fetch.ts, iqdb.ts (writeRow, manageRowData)
db_code_in 호출에 iq_ata 옵션 계정 추가 + direct fee 추가: code_in.ts, constants.ts
direct path 처리: readInscription/decideReadMode에서 on_chain_path === "" 케이스를 처리하도록 업데이트. reading_flow.ts, reader_profile.ts
이벤트 소비 로직 추가: TableTrailEmitted 로그 파서(Anchor EventParser 또는 커스텀) 유틸 제공. reader_context.ts 안에 만들기. 


IDL 변경(테이블 관련 계정 제거) 기준으로 SDK 영향 범위 정리: global_fetch.ts, iqdb.ts에서 table_ref/target_table_ref 제거가 필요한 호출/검증 포인트 목록화.
code_in 플로우 설계:
short inscription(≤900 bytes metadata)만 metadata.data 포함, on_chain_path=""
그 외는 기존 chunk 분기(<10 linked list, >=10 session)
iq_ata 옵션 계정 전달 방식(존재 확인 최소화)
fee는 컨트랙트가 직접 청구하므로 SDK는 fee 계산/transfer 제거

reader 쪽 direct path 처리 설계:
readInscription 반환을 { metadata, data }로 통일(모든 모드 공통)
on_chain_path === ""일 때 data는 metadata.data 사용
decideReadMode는 동일 반환 형식 유지(내부 분기만 처리)

TableTrailEmitted 이벤트 파서 설계:
Anchor EventParser vs 커스텀 디코드 선택
어떤 입력(트랜잭션/로그/slot) 기준으로 제공할지, SDK public API 위치
