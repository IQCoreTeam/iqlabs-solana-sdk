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
- [`fetchUserConnections()`](#fetchuserconnections): fetch all connections (sent & received friend requests)

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

| **Parameters** | `input`: `{ connection, signer }` object<br>`data`: data to upload (string or string[])<br>`filename`: optional filename (string)<br>`method`: upload method (number, default: 0)<br>`filetype`: file type hint (string, default: '')<br>`onProgress`: optional progress callback `(percent: number) => void` |
|----------|--------------------------|
| **Returns** | Transaction signature (string) |

**Example:**
```typescript
import iqlabs from '@iqlabs-official/solana-sdk';

// Upload data
const signature = await iqlabs.writer.codeIn(
  { connection, signer },
  'Hello, blockchain!'
);

// Upload with filename
const sig = await iqlabs.writer.codeIn(
  { connection, signer },
  'file contents here',
  'hello.txt'
);
```

---

#### `readCodeIn()`

| **Parameters** | `txSignature`: transaction signature (string)<br>`speed`: rate limit profile (optional, 'light' \| 'medium' \| 'heavy' \| 'extreme')<br>`onProgress`: optional progress callback `(percent: number) => void` |
|----------|--------------------------|
| **Returns** | `{ metadata: string, data: string \| null }` |

**Example:**
```typescript
import iqlabs from '@iqlabs-official/solana-sdk';

const result = await iqlabs.reader.readCodeIn('5Xg7...');
console.log(result.data);      // 'Hello, blockchain!'
console.log(result.metadata);  // JSON string with file metadata
```

---

### Connection Management

#### `requestConnection()`

| **Parameters** | `connection`: Solana RPC Connection<br>`signer`: Signer<br>`dbRootId`: database ID (Uint8Array or string)<br>`partyA`: first user pubkey (string)<br>`partyB`: second user pubkey (string)<br>`tableName`: connection table name (string or Uint8Array)<br>`columns`: column list (Array\<string \| Uint8Array\>)<br>`idCol`: ID column (string or Uint8Array)<br>`extKeys`: extension keys (Array\<string \| Uint8Array\>) |
|----------|--------------------------|
| **Returns** | Transaction signature (string) |

**Example:**
```typescript
import iqlabs from '@iqlabs-official/solana-sdk';

await iqlabs.writer.requestConnection(
  connection, signer, 'my-db',
  myWalletAddress, friendWalletAddress,
  'dm_table', ['message', 'timestamp'], 'message_id', []
);
```

---

#### `manageConnection()`

> **Note**: There is no high-level SDK wrapper for this function. Use the contract-level instruction builder directly.

| **Parameters** | `builder`: InstructionBuilder<br>`accounts`: `{ db_root, connection_table, signer }` (PublicKey)<br>`args`: `{ db_root_id, connection_seed, new_status }` |
|----------|--------------------------|
| **Returns** | TransactionInstruction |

**Example:**
```typescript
import iqlabs from '@iqlabs-official/solana-sdk';

const builder = iqlabs.contract.createInstructionBuilder(iqlabs.contract.PROGRAM_ID);

// Approve a friend request
const approveIx = iqlabs.contract.manageConnectionInstruction(
  builder,
  { db_root, connection_table, signer: myPubkey },
  { db_root_id, connection_seed, new_status: iqlabs.contract.CONNECTION_STATUS_APPROVED }
);

// Block a user
const blockIx = iqlabs.contract.manageConnectionInstruction(
  builder,
  { db_root, connection_table, signer: myPubkey },
  { db_root_id, connection_seed, new_status: iqlabs.contract.CONNECTION_STATUS_BLOCKED }
);
```

---

#### `readConnection()`

| **Parameters** | `dbRootId`: database ID (Uint8Array or string)<br>`partyA`: first wallet (string)<br>`partyB`: second wallet (string) |
|----------|--------------------------|
| **Returns** | `{ status: 'pending' \| 'approved' \| 'blocked' \| 'unknown', requester: 'a' \| 'b', blocker: 'a' \| 'b' \| 'none' }` |

**Example:**
```typescript
import iqlabs from '@iqlabs-official/solana-sdk';

const { status, requester, blocker } = await iqlabs.reader.readConnection('my-db', partyA, partyB);
console.log(status); // 'pending' | 'approved' | 'blocked'
```

---

#### `writeConnectionRow()`

| **Parameters** | `connection`: Solana RPC Connection<br>`signer`: Signer<br>`dbRootId`: database ID (Uint8Array or string)<br>`connectionSeed`: connection seed (Uint8Array or string)<br>`rowJson`: JSON data (string) |
|----------|--------------------------|
| **Returns** | Transaction signature (string) |

**Example:**
```typescript
import iqlabs from '@iqlabs-official/solana-sdk';

await iqlabs.writer.writeConnectionRow(
  connection, signer, 'my-db', connectionSeed,
  JSON.stringify({ message_id: '123', message: 'Hello friend!', timestamp: Date.now() })
);
```

---

#### `fetchUserConnections()`

Fetch all connections (friend requests) for a user by analyzing their UserState PDA transaction history. Each connection includes its `dbRootId`, identifying which app the connection belongs to.

| **Parameters** | `userPubkey`: user public key (string or PublicKey)<br>`options`: optional settings |
|----------|--------------------------|
| **Options** | `limit`: max number of transactions to fetch<br>`before`: signature to paginate from<br>`speed`: rate limit profile ('light' \| 'medium' \| 'heavy' \| 'extreme') |
| **Returns** | Array of `{ dbRootId, connectionPda, partyA, partyB, status, requester, blocker, timestamp }` |

**Example:**
```typescript
import iqlabs from '@iqlabs-official/solana-sdk';

const connections = await iqlabs.reader.fetchUserConnections(myPubkey, {
  speed: 'light',
  limit: 100
});

// Filter by status
const pendingRequests = connections.filter(c => c.status === 'pending');
const friends = connections.filter(c => c.status === 'approved');
const blocked = connections.filter(c => c.status === 'blocked');

// Check connection details
connections.forEach(conn => {
  console.log(`${conn.partyA} <-> ${conn.partyB}, status: ${conn.status}`);
});
```

---

### Table Management

#### `writeRow()`

| **Parameters** | `connection`: Solana RPC Connection<br>`signer`: Signer<br>`dbRootId`: database ID (Uint8Array or string)<br>`tableSeed`: table name (Uint8Array or string)<br>`rowJson`: JSON row data (string)<br>`skipConfirmation`: skip tx confirmation (boolean, default: false) |
|----------|--------------------------|
| **Returns** | Transaction signature (string) |

**Example:**
```typescript
import iqlabs from '@iqlabs-official/solana-sdk';

// Write the first row to create the table
await iqlabs.writer.writeRow(connection, signer, 'my-db', 'users', JSON.stringify({
  id: 1, name: 'Alice', email: 'alice@example.com'
}));

// Add another row to the same table
await iqlabs.writer.writeRow(connection, signer, 'my-db', 'users', JSON.stringify({
  id: 2, name: 'Bob', email: 'bob@example.com'
}));
```

---

#### `readTableRows()`

| **Parameters** | `account`: table PDA (PublicKey or string)<br>`options`: optional settings |
|----------|--------------------------|
| **Options** | `limit`: max number of rows to fetch<br>`before`: signature cursor for pagination<br>`signatures`: pre-collected signature array (skips RPC fetch if provided)<br>`speed`: rate limit profile ('light', 'medium', 'heavy', 'extreme') |
| **Returns** | `Array<Record<string, unknown>>` |

**Example:**
```typescript
import iqlabs from '@iqlabs-official/solana-sdk';

// Basic usage
const rows = await iqlabs.reader.readTableRows(tablePda, { limit: 50 });

// Cursor-based pagination
const olderRows = await iqlabs.reader.readTableRows(tablePda, { limit: 50, before: 'sig...' });

// With pre-collected signatures (skips signature fetching, decodes directly)
const sigs = await iqlabs.reader.collectSignatures(tablePda);
const targetIdx = sigs.indexOf('abc123');
const slice = sigs.slice(targetIdx - 25, targetIdx + 25);
const rows = await iqlabs.reader.readTableRows(tablePda, { signatures: slice });
```

---

#### `collectSignatures()`

Collects all (or up to `maxSignatures`) transaction signatures for an account. Lightweight — no transaction decoding, only signature strings. Useful for pagination: fetch the full signature list once, then slice and pass to `readTableRows()`.

| **Parameters** | `account`: table PDA (PublicKey or string)<br>`maxSignatures`: max number of signatures to collect (optional, fetches all if omitted) |
|----------|--------------------------|
| **Returns** | `string[]` (signature strings) |

**Example:**
```typescript
import iqlabs from '@iqlabs-official/solana-sdk';

// Collect all signatures
const allSigs = await iqlabs.reader.collectSignatures(tablePda);

// Collect up to 3000 signatures
const sigs = await iqlabs.reader.collectSignatures(tablePda, 3000);

// Use with readTableRows to read from the middle
const targetIdx = sigs.indexOf('abc123');
const chunk = sigs.slice(targetIdx - 25, targetIdx + 25);
const rows = await iqlabs.reader.readTableRows(tablePda, { signatures: chunk });
```

---

#### `getTablelistFromRoot()`

| **Parameters** | `connection`: Solana RPC Connection<br>`dbRootId`: database ID (Uint8Array or string) |
|----------|--------------------------|
| **Returns** | `{ rootPda: PublicKey, creator: string \| null, tableSeeds: string[], globalTableSeeds: string[] }` |

**Example:**
```typescript
import iqlabs from '@iqlabs-official/solana-sdk';

const result = await iqlabs.reader.getTablelistFromRoot(connection, 'my-db');
console.log('Creator:', result.creator);
console.log('Table seeds:', result.tableSeeds);
```

---

#### `fetchInventoryTransactions()`

| **Parameters** | `publicKey`: user public key (PublicKey)<br>`limit`: max count (number)<br>`before`: pagination cursor (optional, string) |
|----------|--------------------------|
| **Returns** | Transaction array |

**Example:**
```typescript
import iqlabs from '@iqlabs-official/solana-sdk';

const myFiles = await iqlabs.reader.fetchInventoryTransactions(myPubkey, 20);
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

| **Parameters** | `url`: Solana RPC URL (string) |
|----------|--------------------------|
| **Returns** | void |

**Example:**
```typescript
import iqlabs from '@iqlabs-official/solana-sdk';

iqlabs.utils.setRpcUrl('https://your-rpc.example.com');
```

---

## Advanced Functions

These functions are advanced/internal, so this doc lists them only. If you are looking for any of the following functions, please see our API docs (in progress).

- `manageRowData()` (`writer`)
- `readUserState()` (`reader`)
- `readInventoryMetadata()` (`reader`)
- `getSessionPdaList()` (`reader`)
- `deriveDmSeed()` (`utils`/`reader`)
- `toSeedBytes()` (`utils`)

---

## Additional Resources
- [IQLabs Official X](https://x.com/IQLabsOfficial)
- [IQLabs Official Website](https://iqlabs.dev)
