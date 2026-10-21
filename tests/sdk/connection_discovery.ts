import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {Message,Connection,PublicKey} from '@solana/web3.js';
import {fetchUserConnections} from '../../src/sdk/reader/reader_utils';
import {setRpcUrl} from '../../src/sdk/utils/connection_helper';
const fixture=JSON.parse(readFileSync(join(__dirname,'connection_discovery.fixture.json'),'utf8'));

test('recorded request discovers the connection table rather than its db root and deduplicates it',async()=>{
 const message=Message.from(Buffer.from(fixture.message,'base64'));
 const originalSignatures=Connection.prototype.getSignaturesForAddress;
 const originalTransaction=Connection.prototype.getTransaction;
 const originalInfo=Connection.prototype.getAccountInfo;
 let accountReads=0;
 setRpcUrl('http://127.0.0.1:1'); // Any accidental network call must fail locally.
 Connection.prototype.getSignaturesForAddress=async()=>[fixture,fixture] as any;
 Connection.prototype.getTransaction=async()=>({transaction:{message}}) as any;
 Connection.prototype.getAccountInfo=async(address:PublicKey)=>{
  accountReads++;assert.equal(address.toBase58(),fixture.table,'reader selected db_root instead of connection_table');
  return {data:Buffer.from(fixture.account,'base64')} as any;
 };
 try{
  const rows=await fetchUserConnections(fixture.wallet,{speed:'medium'});
  assert.equal(rows.length,1);assert.equal(rows[0].connectionPda,fixture.table);
  assert.equal(rows[0].status,'approved');assert.equal(accountReads,1);
 }finally{
  Connection.prototype.getSignaturesForAddress=originalSignatures;
  Connection.prototype.getTransaction=originalTransaction;
  Connection.prototype.getAccountInfo=originalInfo;
 }
});
