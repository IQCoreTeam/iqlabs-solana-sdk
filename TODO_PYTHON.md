# TODO - Python SDK Structure (single package, two layers)


## Contract layer responsibilities
- Load Anchor profile from IDL metadata.
- Build Pinocchio profile from the same IDL + discriminator overrides.
- Resolve profile by owner(programId) automatically.
- Keep generated code isolated under contract/generated.

## SDK layer responsibilities
- Use contract layer only (no direct IDL usage).
- Provide domain workflows and user-facing API.
