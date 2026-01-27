# Friend Fetcher Functions - 구현 플랜

## 목적
UserState PDA의 트랜잭션 히스토리를 분석하여 친구 요청/연결 목록을 가져오는 헬퍼 함수들을 SDK에 추가

## 배경

### 현재 상황
- ✅ `requestConnection()`: 친구 요청을 보내면 상대방의 UserState PDA에 트랜잭션 전송
- ✅ `readConnection()`: 두 당사자 간의 연결 상태 확인 (단일 연결만)
- ❌ 사용자의 **모든 친구 요청/연결 목록**을 가져오는 함수 없음

### 작동 원리
1. A가 B에게 `requestConnection()` 호출
2. B의 UserState PDA에 해당 트랜잭션이 기록됨
3. B가 자신의 친구 요청을 보려면:
   - UserState PDA의 트랜잭션 히스토리 조회
   - `requestConnection` 인스트럭션 필터링
   - 각 연결에 대해 `readConnection()` 호출하여 현재 상태 확인
   - 상태별로 분류 (pending/approved/blocked)

### 참고 구현
`/Users/sumin/WebstormProjects/iqlabs-sdk-cli-example/cli/src/apps/chat/chat-service.ts`에 유사한 로직이 구현되어 있음

---

## 구현할 함수

### `fetchUserConnections()`
사용자의 모든 연결 목록을 가져오기

```typescript
/**
 * 사용자의 모든 연결(친구 요청) 목록을 가져옵니다.
 * UserState PDA의 트랜잭션 히스토리를 분석하여 연결 상태를 반환합니다.
 *
 * @param userPubkey - 조회할 사용자의 공개 키
 * @param dbRootId - 데이터베이스 루트 ID
 * @param options - 옵션
 * @param options.limit - 최대 개수
 * @param options.before - 이 시그니처 이전의 데이터만 (페이지네이션)
 * @param options.speed - 속도 프로파일 ('light' | 'medium' | 'heavy' | 'extreme', 기본값: 'light')
 * @returns 연결 목록
 */
async function fetchUserConnections(
  userPubkey: PublicKey | string,
  dbRootId: string,
  options?: {
    limit?: number;
    before?: string;
    speed?: 'light' | 'medium' | 'heavy' | 'extreme';
  }
): Promise<Array<{
  partyA: string;
  partyB: string;
  status: 'pending' | 'approved' | 'blocked';
  requester: 'a' | 'b';
  blocker?: 'a' | 'b' | 'none';
  timestamp?: number;
}>>
```

**구현 단계:**
1. UserState PDA 주소 계산
2. `fetchAccountTransactions()` 호출하여 트랜잭션 히스토리 가져오기
3. 각 트랜잭션 분석:
   - `requestConnection` 인스트럭션 필터링
   - partyA, partyB 추출
4. **Rate limiter 생성** (speed 프로파일 기반)
5. 각 연결에 대해 `readConnection()` 호출 (rate limiter 적용하여 병렬 처리)
6. 결과 반환 (status 포함)

**사용 예시:**
```typescript
// 모든 연결 가져오기
const connections = await fetchUserConnections(userPubkey, 'my-db');

// 사용자가 status로 직접 필터링
const pending = connections.filter(c => c.status === 'pending');
const approved = connections.filter(c => c.status === 'approved');
const blocked = connections.filter(c => c.status === 'blocked');
```

**왜 편의 함수를 만들지 않나요?**
- `fetchUserConnections()`가 모든 연결을 status와 함께 반환하므로
- 사용자가 직접 `.filter()`로 원하는 상태만 필터링 가능
- SDK를 단순하게 유지하고, 유연성을 사용자에게 제공

---

## 파일 구조

### 현재 위치
- `/src/core/reader/reader_utils.ts` - `fetchUserConnections` 구현
- `/src/core/reader/index.ts` - reader exports
- `/src/index.ts` - 최상위 export

---

## 필요한 기존 함수들

### Reader
- ✅ `fetchAccountTransactions()` - UserState PDA의 트랜잭션 히스토리
- ✅ `readConnection()` - 개별 연결 상태 조회
- ✅ `decodeReaderInstruction()` - 트랜잭션 인스트럭션 디코딩

### Contract
- ✅ `getUserPda()` - UserState PDA 주소 계산
- ✅ `getConnectionTablePda()` - Connection PDA 주소 계산

### Utils
- ✅ `deriveDmSeed()` - 두 지갑 주소로부터 연결 시드 생성
- ✅ `createRateLimiter()` - Rate limiter 생성 (`/src/sdk/utils/rate_limiter.ts`)
- ✅ `SESSION_SPEED_PROFILES` - 속도 프로파일 설정 (`/src/sdk/utils/session_speed.ts`)

---

## 구현 세부사항

### 트랜잭션 필터링
```typescript
// requestConnection 인스트럭션 찾기
const connectionTxs = allTxs.filter(tx => {
  const instructions = tx.transaction.message.instructions;
  return instructions.some(ix => {
    const decoded = decodeReaderInstruction(ix);
    return decoded?.name === 'requestConnection';
  });
});
```

### partyA, partyB 추출
```typescript
// 인스트럭션 데이터에서 추출
const { partyA, partyB } = decodeConnectionRequestInstruction(ix);

// 정렬 순서 확인 (deriveDmSeed 로직과 동일)
const sorted = [partyA, partyB].sort();
```

### 연결 상태 조회 (Rate Limiter 사용)
```typescript
import { createRateLimiter } from '../utils/rate_limiter';
import { SESSION_SPEED_PROFILES } from '../utils/session_speed';

// speed 프로파일에 따라 rate limiter 생성 (기본값: 'light')
const speed = options?.speed || 'light';
const profile = SESSION_SPEED_PROFILES[speed];
const rateLimiter = createRateLimiter(profile.rps);

// 병렬 처리하되 rate limit 준수
const connectionPromises = connectionTxs.map(async (tx) => {
  if (rateLimiter) {
    await rateLimiter.wait();
  }

  const { partyA, partyB } = extractParties(tx);
  const { status, requester, blocker } = await readConnection(
    dbRootId,
    partyA,
    partyB
  );

  return {
    partyA,
    partyB,
    status,
    requester,
    blocker,
    timestamp: tx.blockTime
  };
});

const connections = await Promise.all(connectionPromises);
```

---

## 성능 고려사항

### 페이지네이션
- `fetchAccountTransactions()`는 이미 `before`, `limit` 지원
- 대량의 연결이 있는 경우 페이지네이션 필수

### 캐싱
- 트랜잭션 히스토리는 자주 바뀌지 않으므로 캐싱 고려
- 상태는 실시간으로 변할 수 있으므로 `readConnection()` 결과는 짧게 캐싱

### Rate Limiting (필수)
- **기존 `createRateLimiter()` 사용** (`/src/sdk/utils/rate_limiter.ts`)
- `SESSION_SPEED_PROFILES`에서 RPS 설정 가져오기
- 여러 `readConnection()` 호출을 `Promise.all()`로 병렬 처리하되, rate limiter로 RPS 제한
- 기본값: 'light' (6 RPS)

**속도 프로파일별 RPS:**
- light: 6 RPS (안정적, 기본값)
- medium: 50 RPS (빠른 처리)
- heavy: 100 RPS (대량 데이터)
- extreme: 250 RPS (최고 성능, RPC 제한 주의)

---

## 테스트 시나리오

### 1. 기본 테스트
```typescript
// 사용자 A의 모든 연결 조회
const connections = await fetchUserConnections(userA, 'my-db');
console.log('총 연결:', connections.length);

// status로 필터링
const pending = connections.filter(c => c.status === 'pending');
console.log('대기중 요청:', pending.length);

const approved = connections.filter(c => c.status === 'approved');
console.log('친구 수:', approved.length);

const blocked = connections.filter(c => c.status === 'blocked');
console.log('차단된 사용자:', blocked.length);
```

### 2. 상태 변화 테스트
```typescript
// 1. 친구 요청 보내기
await requestConnection(connection, signer, 'my-db', userA, userB, ...);

// 2. B의 pending 요청 확인
const connections = await fetchUserConnections(userB, 'my-db');
const pending = connections.filter(c => c.status === 'pending');
assert(pending.some(c =>
  (c.partyA === userA || c.partyB === userA)
));

// 3. 승인 후 (manageConnection으로 approve)
// ...

// 4. B의 친구 목록 확인
const updatedConnections = await fetchUserConnections(userB, 'my-db');
const friends = updatedConnections.filter(c => c.status === 'approved');
assert(friends.some(c =>
  (c.partyA === userA || c.partyB === userA)
));
```

### 3. 성능 테스트
- 100개 이상의 연결이 있는 경우
- 페이지네이션 동작 확인
- RPS 제한 준수 확인

---

## 문서 업데이트

### README.md
```markdown
### 친구 목록 조회
\`\`\`typescript
import {createClient} from "@iqlabs/solana-sdk";

const client = createClient({connection});
const {reader} = client;

// 모든 연결 가져오기
const connections = await reader.fetchUserConnections(myPubkey, {
  limit: 100,
});

// 받은 친구 요청 확인
const pending = connections.filter(c => c.status === 'pending');
pending.forEach(conn => {
  const friend = conn.partyA === myPubkey ? conn.partyB : conn.partyA;
  console.log(`${friend}님이 친구 요청을 보냈습니다`);
});

// 내 친구 목록
const friends = connections.filter(c => c.status === 'approved');
console.log(`친구 ${friends.length}명`);

// 차단한 사용자
const blocked = connections.filter(c => c.status === 'blocked');
console.log(`차단된 사용자 ${blocked.length}명`);
\`\`\`
```

### API_DOCS.md
High-level API 섹션에 추가:
- `fetchUserConnections()` - 모든 연결 목록을 status와 함께 반환
---

## 우선순위
1. **Phase 1**: `fetchUserConnections()` 구현 (핵심 - 이것만 구현)
2. **Phase 2**: 성능 최적화 (캐싱, 병렬 처리)
3. **Phase 3**: 문서 및 예제 업데이트

**참고**: 편의 함수(getPendingRequests, getApprovedFriends 등)는 만들지 않음. 사용자가 직접 `.filter()`로 필터링 가능.

---

## 참고
- 예시 구현: `/Users/sumin/WebstormProjects/iqlabs-sdk-cli-example/cli/src/apps/chat/chat-service.ts`
- 기존 함수: `/Users/sumin/WebstormProjects/iqlabs-sdk/src/core/reader/iqdb.ts` (`readConnection`)
- 트랜잭션 유틸: `/Users/sumin/WebstormProjects/iqlabs-sdk/src/core/reader/reader_utils.ts`
