# Node.js Upgrade Path

## Current: Node 22 LTS (Iron)
- **Current Version**: 22.x (LTS since October 2024)
- **Modern Features**: ES2024, native fetch, improved performance
- **End of Life**: April 2027

## Future: Node 24 LTS (Planned October 2025)
- **Promotion**: Node 24 will become LTS in ~8 weeks (October 2025)
- **Preparation**: Our code is already future-ready

## Upgrade Strategy

### Phase 1: Node 22 Foundation (Current)
```json
{
  "engines": {
    "node": ">=22.0.0"
  }
}
```

### Phase 2: Node 24 Preparation (October 2025)
- Update engines to `">=22.0.0 || >=24.0.0"`
- Test with Node 24 RC versions
- Leverage new performance improvements

### Phase 3: Node 24 Migration (Early 2026)
- Update to `">=24.0.0"` 
- Adopt Node 24 specific optimizations
- Deprecate Node 22 support in v5.0

## Code Compatibility Notes

Our modern architecture ensures easy upgrades:

1. **ESM-First**: Already compatible with future Node versions
2. **Modern APIs**: Using latest stable APIs (fetch, crypto, etc.)
3. **TypeScript 5.9+**: Forward-compatible with Node improvements
4. **Zero Legacy**: No deprecated APIs to worry about

## Automated Testing Strategy

```yaml
# .github/workflows/node-versions.yml
strategy:
  matrix:
    node-version: [22.x, 24.x]  # Test both LTS versions
```

This ensures we catch compatibility issues early and maintain support for both versions during the transition period.