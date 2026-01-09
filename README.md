# iqlabs-sdk
# WE NEED TO MAKE WHOLE TODO AND LINK WITH THE EXAMPLE & MAKESOMME SITE
things you need to know in new update:
## Reader contract mode

The reader uses a contract mode string (`"pinocchio"` or `"anchor"`) to decide
which program profile to use. The default is `DEFAULT_CONTRACT_MODE`, currently
set to `"pinocchio"`.

Key behavior:
- All reader functions accept an optional `mode` argument as the last parameter.
  If you omit it or pass an invalid value, the default is forced.
- Transaction-based reads (for example `readCodeIn` and `decideReadMode`)
  attempt to auto-detect the runtime from the transaction's program IDs. If
  detection is ambiguous, the code falls back to the provided `mode` or the
  default.
- List/lookup reads that do not inspect a transaction (for example
  `getSessionPdaList` or `readUserState`) do not auto-detect and always use the
  provided `mode` or the default.

Examples:
```ts
await readCodeIn(signature); // uses auto-detect, default fallback is pinocchio
await readCodeIn(signature, undefined, "anchor"); // force anchor when needed
await getSessionPdaList(pubkey, "pinocchio"); // list/lookup uses explicit mode
```

Note: If anchor and pinocchio program IDs are configured to the same value,
auto-detection cannot distinguish them and will fall back to the default.
