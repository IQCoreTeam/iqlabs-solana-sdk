# IQLabs SDK 

> **Draft**: This document is in progress and will be refined.

---

## Table of Contents

1. [Core Concepts](#core-concepts)
   - [Data Storage (Code In)](#data-storage-code-in)
   - [User State PDA](#user-state-pda)
   - [Connection PDA](#connection-pda)
   - [Database Tables](#database-tables)

2. [Function Details](#function-details)
   - [Data Storage and Retrieval](#data-storage-and-retrieval)
   - [Connection Management](#connection-management)
   - [Table Management](#table-management)
   - [Environment Settings](#environment-settings)

2.1. [Advanced Functions](#advanced-functions) (list only)

---

## Core Concepts

These are the key concepts to know before using the IQLabs SDK.

---

### Data Storage (Code In)

This is how you store any data (files, text, JSON) on-chain.

#### How is it stored?

Depending on data size, the SDK picks the optimal method:

- **Small data (< 900 bytes)**: store immediately, fastest
- **Medium data (< 8.5 KB)**: split into multiple transactions
- **Large data (>= 8.5 KB)**: upload in parallel for speed

#### Key related functions

- [`codeIn()`](#codein): upload data and get a transaction ID
- [`readCodeIn()`](#readcodein): read data back from a transaction ID

---

### User State PDA

An on-chain profile account for a user.

#### What gets stored?

- Profile info (name, profile picture, bio, etc.)
- Number of uploaded files
- Friend request records

> **Note**: Friend requests are not stored as values in the PDA; they are sent as transactions.

#### When is it created?

It is created automatically the first time you call [`codeIn()`](#codein). No extra setup is required, but the first user may need to sign twice.

---

### Connection PDA

An on-chain account that manages relationships between two users (friends, messages, etc.).

#### What states can it have?

- **pending**: a friend request was sent but not accepted yet
- **approved**: the request was accepted and the users are connected
- **blocked**: one side blocked the other

> **Important**: A blocked connection can only be unblocked by the blocker.

#### Key related functions

- [`requestConnection()`](#requestconnection): send a friend request (creates pending)
- [`manageConnection()`](#manageconnection): approve/reject/block/unblock a request
- [`readConnection()`](#readconnection): check current relationship status
- [`writeConnectionRow()`](#writeconnectionrow): exchange messages/data with a connected friend
- [`fetchUserConnections()`](#fetchuserconnections) (WIP): fetch friend list (in progress)

---

### Database Tables

Store JSON data in tables like a database.

#### How are tables created?

There is no dedicated "create table" function. The first write via [`writeRow()`](#writerow) creates the table automatically.

> **Note**: A table is uniquely identified by the combination of `dbRootId` and `tableSeed` (table name).

#### Key related functions

- [`writeRow()`](#writerow): add a new row (creates the table if missing)
- [`readTableRows()`](#readtablerows): read rows from a table
- [`getTablelistFromRoot()`](#gettablelistfromroot): list all tables in a database
- [`fetchInventoryTransactions()`](#fetchinventorytransactions): list uploaded files

---

## Function Details

### Data Storage and Retrieval

#### `codeIn()`

| **Parameters** | `connection`: Solana RPC connection<br>`signer`: signing wallet<br>`data`: data to upload (single string or array)<br>`mode`: contract mode (default: 'anchor') |
|----------|--------------------------|
| **Returns** | Transaction signature (string) |

**Example:**
```typescript
import { codeIn } from 'iqlabs-sdk';

// Upload a single file
const signature = await codeIn(connection, signer, 'Hello, blockchain!');

// Upload multiple files
const multiSig = await codeIn(connection, signer, ['file1.txt', 'file2.txt', 'file3.txt']);
```

---

#### `readCodeIn()`

| **Parameters** | `txSignature`: transaction signature<br>`connection`: (optional) Solana RPC connection |
|----------|--------------------------|
| **Returns** | Stored data (string) |

**Example:**
```typescript
import { readCodeIn } from 'iqlabs-sdk';

const data = await readCodeIn('5Xg7...', connection);
console.log(data); // 'Hello, blockchain!'
```

---

### Connection Management

#### `requestConnection()`

| **Parameters** | `connection`: Solana RPC connection<br>`signer`: signing wallet<br>`dbRootId`: database ID<br>`partyA`, `partyB`: the two users to connect<br>`tableName`: connection table name<br>`columns`: column list<br>`idCol`: ID column<br>`extKeys`: extension keys |
|----------|--------------------------|
| **Returns** | Transaction signature (string) |

**Example:**
```typescript
import { requestConnection } from 'iqlabs-sdk';

await requestConnection(
  connection, signer, 'my-db',
  myWalletAddress, friendWalletAddress,
  'dm_table', ['message', 'timestamp'], 'message_id', []
);
```

---

#### `manageConnection()`

| **Parameters** | `builder`: InstructionBuilder<br>`accounts`: `{ db_root, connection_table, signer }`<br>`args`: `{ db_root_id, connection_seed, new_status }` |
|----------|--------------------------|
| **Returns** | TransactionInstruction |

**Example:**
```typescript
import { contract } from 'iqlabs-sdk';

// Approve a friend request
const approveIx = contract.manageConnectionInstruction(
  builder,
  { db_root, connection_table, signer: myPubkey },
  { db_root_id, connection_seed, new_status: contract.CONNECTION_STATUS_APPROVED }
);

// Block a user
const blockIx = contract.manageConnectionInstruction(
  builder,
  { db_root, connection_table, signer: myPubkey },
  { db_root_id, connection_seed, new_status: contract.CONNECTION_STATUS_BLOCKED }
);
```

---

#### `readConnection()`

| **Parameters** | `dbRootId`: database ID<br>`walletA`, `walletB`: the two wallets to check |
|----------|--------------------------|
| **Returns** | `{ status: 'pending' | 'approved' | 'blocked', requester, blocker }` |

**Example:**
```typescript
import { readConnection } from 'iqlabs-sdk';

const { status, requester, blocker } = await readConnection('my-db', walletA, walletB);
console.log(status); // 'pending' | 'approved' | 'blocked'
```

---

#### `writeConnectionRow()`

| **Parameters** | `connection`: Solana RPC connection<br>`signer`: signing wallet<br>`dbRootId`: database ID<br>`connectionSeed`: connection seed<br>`rowJson`: JSON data |
|----------|--------------------------|
| **Returns** | Transaction signature (string) |

**Example:**
```typescript
import { writeConnectionRow } from 'iqlabs-sdk';

await writeConnectionRow(
  connection, signer, 'my-db', connectionSeed,
  JSON.stringify({ message_id: '123', message: 'Hello friend!', timestamp: Date.now() })
);
```

---

#### `fetchUserConnections()`

> **WIP**: This function is currently under development.

| **Parameters** | `userPubkey`: user public key<br>`dbRootId`: database ID<br>`options`: options (limit, before, speed) |
|----------|--------------------------|
| **Returns** | Array of connections |

**Expected usage:**
```typescript
const connections = await fetchUserConnections(myPubkey, 'my-db');
const pending = connections.filter(c => c.status === 'pending');
const approved = connections.filter(c => c.status === 'approved');
```

---

### Table Management

#### `writeRow()`

| **Parameters** | `connection`: Solana RPC connection<br>`signer`: signing wallet<br>`dbRootId`: database ID<br>`tableSeed`: table name<br>`rowJson`: JSON row data |
|----------|--------------------------|
| **Returns** | Transaction signature (string) |

**Example:**
```typescript
import { writeRow } from 'iqlabs-sdk';

// Write the first row to create the table
await writeRow(connection, signer, 'my-db', 'users', JSON.stringify({
  id: 1, name: 'Alice', email: 'alice@example.com'
}));

// Add another row to the same table
await writeRow(connection, signer, 'my-db', 'users', JSON.stringify({
  id: 2, name: 'Bob', email: 'bob@example.com'
}));
```

---

#### `readTableRows()`

| **Parameters** | `accountInfo`: table account info |
|----------|--------------------------|
| **Returns** | Row array (Row[]) |

**Example:**
```typescript
import { readTableRows, contract } from 'iqlabs-sdk';

const dbRootPda = contract.pda.getDbRootPda('my-db');
const tablePda = contract.pda.getTablePda(dbRootPda, 'users');
const accountInfo = await connection.getAccountInfo(tablePda);
const rows = readTableRows(accountInfo);

console.log(`Total rows: ${rows.length}`);
```

---

#### `getTablelistFromRoot()`

| **Parameters** | `dbRootId`: database ID |
|----------|--------------------------|
| **Returns** | Table name array (string[]) |

**Example:**
```typescript
import { getTablelistFromRoot } from 'iqlabs-sdk';

const tables = await getTablelistFromRoot('my-db');
console.log('Table list:', tables);
```

---

#### `fetchInventoryTransactions()`

| **Parameters** | `userPubkey`: user public key<br>`limit`: max count (optional) |
|----------|--------------------------|
| **Returns** | Transaction array |

**Example:**
```typescript
import { fetchInventoryTransactions } from 'iqlabs-sdk';

const myFiles = await fetchInventoryTransactions(myPubkey, 20);
myFiles.forEach(tx => {
  let metadata: { data?: unknown } | null = null;
  try {
    metadata = JSON.parse(tx.metadata);
  } catch {
    metadata = null;
  }

  if (metadata && metadata.data !== undefined) {
    const inlineData = typeof metadata.data === 'string'
      ? metadata.data
      : JSON.stringify(metadata.data);
    console.log(`Inline data: ${inlineData}`);
  } else {
    console.log(`Signature: ${tx.signature}`);
  }
});
```

---

### Environment Settings

#### `setRpcUrl()`

| **Parameters** | `url`: Solana RPC URL |
|----------|--------------------------|
| **Returns** | None (void) |

**Example:**
```typescript
import { setRpcUrl } from 'iqlabs-sdk';

setRpcUrl('https://your-rpc.example.com');
```

---

## Advanced Functions

These functions are advanced/internal, so this doc lists them only. If you are looking for any of the following functions, please see our API docs (in progress).

- `manageRowData()` (`writer`)
- `readUserState()` (`reader`)
- `readInventoryMetadata()` (`reader`)
- `fetchAccountTransactions()` (`reader`)
- `getSessionPdaList()` (`reader`)
- `deriveDmSeed()` (`utils`/`reader`)
- `toSeedBytes()` (`utils`)

---

## Additional Resources
- [IQLabs Official X](#https://x.com/IQLabsOfficial)
- [Example Project](#https://github.com/IQCoreTeam/IQSdkUsageExampleCliTool)
