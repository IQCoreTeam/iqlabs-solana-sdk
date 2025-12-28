- e Clean Code notes: follow these global practices across the new backend codebase.

- SOLID principles (SRP, OCP, LSP, ISP, DIP)
- DRY (Don't Repeat Yourself) and KISS (Keep It Simple, Stupid)
- Prefer expressive implementation over heavy commenting; code should explain itself
- Keep functions small, focused, and easy to unit test (dependency injection, pure functions when possible)
- Follow language-specific style guides (PEP 8 for Python, gofmt for Go, fmt for Rust, etc.)
- Tests are part of clean code: write unit/integration tests as part of normal development
- Comments must be in English; avoid non-ASCII strings unless absolutely necessary
- Maintain the planned architecture: reader → utils → writer → sender pipeline, so the logical flow stays obvious
