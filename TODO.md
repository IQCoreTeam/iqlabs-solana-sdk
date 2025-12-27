# TODO - TS SDK Structure (single package, two layers)

## Goals
- Keep the IDL as the single source of truth.
- Support Anchor + Pinocchio with owner(programId) auto selection.
- Separate layers: contract (low-level) and sdk (high-level).
- Start simple in one package; allow future split if needed.



## Contract layer responsibilities
- Maintain program profile selection (anchor vs pinocchio).
- Keep discriminator overrides in one place.
- Provide PDA helpers and low-level instruction builders.
- No business logic here.

## SDK layer responsibilities
- Use contract layer only (no direct IDL usage).
- Provide domain workflows and user-facing API.
- Hide adapter details from SDK users.

## Owner-based profile resolution
- Map owner(programId) to Anchor or Pinocchio profile.
- If owner is unknown, choose a default policy (TBD: error vs anchor).
- Program IDs should be configurable per environment.

## Future split path (if needed)
- Move src/contract to packages/contract.
- Move src/sdk to packages/sdk (depends on contract).

## Reader TODO (한글)

### 1) Core API/구조
- Reader 생성 함수(`createReader`/`Reader`): `connection`, `commitment`, batch size, 프로그램 ID override 설정.
- `read`/`readSession`: `ReadMode`(auto/onchain/replay) 분기 + `ReadRequest`/`ReadResult` 정의.
- 슬롯 판단 로직: account slot + block time으로 fresh/recent/archive 계산, owner 힌트는 `resolveProfileByOwner`에 연결.
- RPC 유틸: `fetchAccountInfo`, `fetchSignaturesForAddress`, `fetchTransaction`, `fetchTransactionsBatch`(retry/backoff).

### 2) 세션 복원
- 세션 계정 파싱: Anchor(14/46 bytes) vs Pinocchio(94 bytes) 레이아웃 구분.
- tx instruction에서 chunk 추출: pinocchio 0x04 포맷 + anchor `post_chunk`/`post_hybrid_chunk` discriminator 대응.
- instruction 데이터 디코딩(base58/base64) → chunk payload decode → 재조립(`reconstructSessionChunks`).
- 압축 해제(`decompressPayload`, header 기반) + 파일 타입 추정(`detectFileType`, magic bytes).

### 3) DB PDA 읽기
- `db_account` 조회 + `on_chain_path`/`metadata` 파싱(`fetchDbAccount`, `parseDbAccount`).
- `resolveOnChainPath`: session PDA 경로 vs linked-list tail tx 경로 분기.
- `readDbEntry`: session 읽기 or `readLinkedListFromTail` 호출을 한 군데로 묶기.
- `database_instruction`/`write_data` args 디코딩으로 linked list 추적용 tx 정보 확보.

### 4) User/Connection 읽기
- UserState 파싱: owner/metadata/trail_anchor/total_session_files.
- `total_session_files` 기준으로 seq 0..N 세션 PDA 계산(`listSessionPdasForUser`).
- metadata inscription tx 읽어서 프로필 데이터 복원(`readMetadataInscription`).
- connection seed 계산(정렬 + 해시) → Connection 계정 파싱(`deriveConnectionSeed`, `parseConnectionAccount`).
- UserState tx 히스토리 스캔으로 요청 목록 복원(trail_anchor 업데이트 + `user_payload` decode).

### 5) 테스트/샘플
- Anchor/Pinocchio 세션 tx 샘플 + DB linked-list tx 샘플 준비.
- instruction 디코딩, `on_chain_path` 분기 로직 단위 테스트.
