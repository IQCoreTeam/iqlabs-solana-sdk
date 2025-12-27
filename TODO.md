# TODO - TS SDK Structure (single package, two layers)

## Goals
- Keep the IDL as the single source of truth.
- Support Anchor + Pinocchio with owner(programId) auto selection.
- Separate layers: contract (low-level) and sdk (high-level).
- Use Codama for code generation (no custom gen.ts).
- Start simple in one package; allow future split if needed.

## Proposed folders
```
iqlabs-sdk/
  package.json
  tsconfig.json
  codama.json
  src/
    index.ts
    contract/
      index.ts
      profile.ts
      discriminators.ts
      pda.ts
      generated/
    sdk/
      index.ts
      reader/
      writer/
      user/
  idl/
    code_in.json
  tests/
    contract/
    sdk/
```

## Code generation (Codama)
- Install: `pnpm add -D codama @codama/renderers-js @codama/nodes-from-anchor`
- Config: `codama.json` points to `idl/code_in.json`
- Script: `codama run js` outputs to `src/contract/generated`
- Generated files are committed.
- Rerun when the IDL changes and commit the updates.

## Contract layer responsibilities
- Use Codama output in contract/generated as the source for types/clients.
- Load Anchor profile from IDL metadata (programId, discriminators, seeds).
- Build Pinocchio profile from the same IDL + discriminator overrides in `discriminators.ts`.
- Resolve profile by owner(programId) automatically.
- Expose minimal low-level builders/helpers; no business logic.

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
