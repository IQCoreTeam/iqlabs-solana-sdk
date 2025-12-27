# TODO - Python SDK Structure (single package, two layers)

## Proposed folders
```
sdk-py/
  pyproject.toml
  src/
    iqlabs_sdk/
      __init__.py
      contract/
        __init__.py
        profile.py
        discriminators.py
        pda.py
        generated/
      sdk/
        __init__.py
        reader/
        writer/
        user/
  idl/
    iqlabs.json
  tests/
    contract/
    sdk/
```

## Contract layer responsibilities
- Load Anchor profile from IDL metadata.
- Build Pinocchio profile from the same IDL + discriminator overrides.
- Resolve profile by owner(programId) automatically.
- Keep generated code isolated under contract/generated.

## SDK layer responsibilities
- Use contract layer only (no direct IDL usage).
- Provide domain workflows and user-facing API.
