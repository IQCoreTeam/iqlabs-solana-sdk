After I merge all contracts, I'm gonna let you all know the whole concept of how it's working.

Connection PDA

First of all, we have Connection PDA. I will start digging in from here.

the former name of connection PDA was DM PDA
have you wondered how we make friend requests' list and manage the status without any db, 
here is the core concept 

First, lets simulate we make the connection PDA 
imagine this Zo wallet (zdi23jfd..12f) try to friend request to G wallet (abc2.efwf..ff) 

Then Zo needs to make the CPDA (connection pda) between us.

Step 1 ) Sort the wallet addresses in alphabetical order. 

[ abc2.efwf..ff, zdi23jfd..12f ] <- G wallets goes first and zo wallet goes later, 
and hash this two wallets! 
This rule can make people generate a unique ID for their connection. 

Step 2 ) Uses that to one of the pda seeds, generate the pda and set the status

pub struct Connection {
    pub column_names: Vec<Vec<u8>>,
    pub id_col: Vec<u8>,
    pub ext_keys:  Vec<Vec<u8>>,
    pub name: Vec<u8>,
    pub gate_mint: Pubkey,
    pub party_a: Pubkey,
    pub party_b: Pubkey,
    pub status: u8,      // pending / approved / blocked
    pub requester: u8,   // 0=a, 1=b
    pub blocker: u8,     // 0=a, 1=b, 255=none
    pub last_timestamp: i64,
}

 first , the status set as "Pending" have you seen when you try to text in twitter, first it goes pending friends?
and then  the partner should accept their dm request, same as that, the first status is pending, 

you will see the "requester" in that object, this give the authority only non-requester can accept their request, 

And after they accept the request, they can block each other, and this time , only the "blocker" can unlock the connection!  (if you want to see detail, search the pub fn manage_connection in the codebase.

So, now I guess you understand the connection requestor make "CPDA" for making the connection table. 


Then how can we know some random guy sent me the CPDA with me without the backend?

here is the next step

User PDA

every user make the user pda , now it name as "UserState"

#[account]
pub struct UserState {
    pub owner: Pubkey,//only owner can edit their data. 
    pub trail_anchor: Vec<u8>, // for code in ,
    pub metadata: Vec<u8>,// for pfp, name etc 
    pub total_session_files: u64, // for session pda files
}

so basically lets focus on when we make the "CPDA" and try to let people know I friend requested. 

what we are doing is (imagine zo send friend request to G)

Step 1 ) Zo sends the transaction that contains our CPDA to G's UserState PDA account.
Step 2 ) Whenever G turn on his account and see the friend request, we do this:
               He fetches his UserState's transaction list.
               Then he can see Zo's CPDA tranasaction, that status is pending, so he can see his pending request.
               After he check it, he can change the status to "approve" after he see that CPDA. 
This is how we made the onchain connection!

And there is the other action that userstate handles.I'm gonna start to explain other parts by seeing user state.

first , most simple one, "metadata" here we store the code in inscription that contains the json file include their name, profile pic, bio

Are you interested in how we can store the metadata without the length limit? 

We only store the DB transaction ID that contains the IQ inscription. 
So we can write unlimited bytes in the metadata field.

metadata field have a 100 byte size, this is for the inscription tranasaction id 


and another thing, "total_session_files."

// if you didnt read our whitepaper before , go visit and learn what is the code in and everything. 
https://docs.google.com/document/d/1yaZcpEFZ7gMmhZxuzQpoW5QzIG_hZsqWnFnujKMP4M8/edit?tab=t.0

I added that value to userstate, because that delete the requirement that we need to store the session pda's 

#[account(
    init,
    payer = user,
    seeds = [b"bundle", crate::ID.as_ref(), user.key().as_ref(), &seq.to_le_bytes()],
    bump,
    space = 8 + SessionAccount::SIZE
)]
pub session: Account<'info, SessionAccount>

This is what our session account looks like, before we needed to provide the session ID to make a unique session. but I change this to the seq, and use this for sequential number .
so zo's first session pda's seq number is 1, 100 of files seq number is 100.

the result of this update

1 . we are now be able to guess user's all session pda only with the total session.

example quary loop:
for i =0 i <totalsession i++

array.append  (calculate sessionpda)

#after we do this, all we need to do is display this array to the screen. 


so everything means we made the user's session pda guessable, 

some people might think "if we make the pda guessable, will it be bad at privacy?"

but there is the 2 facts

before's session pda, we stored the session id in there, so after I see that, I decide this as public.

we cannot hide the pda creation anyway in the wallet, even if we want to hide it, people can track in solscan, or using rpc

Therefore, since hiding all users' session pda list was not possible. so that I rather made this guessable 
to make trackable without web2 dbs. 


So CPDA holding the friend list, and also the all user's files.

ok then you might curious about "trail_anchor"

this should be long and boring concept, so i fold here

About trail_anchor in usersession

We don’t do this in the session PDA, but the way we store data works like this.

We continuously update chunked data inside a rent-paid account space.

By doing that, the ledger keeps account update records, and we treat those update records themselves as data.

The reason we do this is because of a very simple philosophy.

If you ask what Bitcoin is, it’s a shared ledger.

A shared ledger means that all transaction records are written and maintained in a decentralized way — I pay you, someone pays me, and all of that is recorded.

I’ve always thought of Web3 as the web that lives on top of a public ledger.

The reason Bitcoin transactions can be decentralized is because the transaction history is written to the ledger — in other words, the history of account state changes.

I wanted to imitate that.

So most of our functions do something like this.

Let’s say we have data like:

11111222223333344444

And let’s assume we only have space for 5 bytes.

We split the data like this:

11111, 22222, 33333, 44444

As I said, we only have a 5-byte space.

Let’s call that space int space.

We first store 11111 in that space,

then overwrite it with 22222,

then 33333,

and finally 44444.

The whole point of doing this is very simple:

to deliberately leave data change history on the ledger, in order to faithfully mimic the core idea of blockchains — transaction records.

That’s the philosophy of IQLABS right now.

In this analogy, trail_anchor is the variable that plays the role of that int space.

Most of our inscriptions work this way as well, not just the user field.

This is simply our overall design concept, just keep that in mind.

DB PDA merge

lets move on the context, 

The way we made multiple data chunks appear as a single file is explained in the image below.

We ran into the following issues:

Session PDA inscriptions couldn’t be aggregated and viewed through the dbPDA. Metadata and indexing had to be managed separately.

It’s essentially the same issue from the other direction — when using the dbPDA, the only structure available was a linked list, which caused scalability problems.


So I wrote the docs for merge it :

All I want to do is actually merge every backend function in a one way so that whatever we do a nft, solchat, fileshare
the service will be in a same line

solchat use Write() to our backend nft use write in our backend and also filesharing do same
and also

sdk aswell
and put in there the money function
then we can controll the income good way

Right now, I am trying to upgrade the inscription method with this , 

Make the inscription function and

Wrap the current code in a function and the session function 

In that function, whenever the data is more then 15kb, inscribe with the session method, and if that's less, insert with the linked list

After the linked list code in our session pda, we do the DB code with this type.

onchain path: tail transaction id or session pda, and metadata string 

Support both case in the reader function
So DB PDA transaction will look like this later:

Before:

After:

now I put this update aswell. !


So in the end, we’re now able to do two things without relying on a separate database.

If you query the dbPDA, you’ll get all of a user’s inscriptions.

And using the loop I mentioned earlier, you can also view only the session PDAs separately.

I want to explain this in a way that everyone can understand.

When there’s a chance, I’ll stream it and walk through the code and files live.

Thanks for staying focused through such a long explanation.

All the code is here.

https://github.com/IQCoreTeam/IQLabsContract.git