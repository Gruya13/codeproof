# Rejected and unresolved findings

Commit: 1f93cc2c44adfc33a49b05715bf3bc2aedecbb22  |  run-id: a5d8f85f0577cbfa

This file exists on purpose: the product is not 'we found everything', it is 'we do not publish what we could not prove'. Rejected findings stay visible with the evidence that refuted them.

## Refuted

### F-004 - Late or changed provider misses init and cleanup

**Claim:** Cache init is stored in a ref only on first provider and the layout effect has empty deps; a provider that appears after mount never gets initProvider called nor unmount cleanup, and a changed provider is ignored while old listeners leak.

**Verifier (muse-wonder-1.0):** refute/strong - The claim that a late provider never gets initProvider called is false: config-context.ts:45 re-evaluates the provider guard on every render and calls initCache when a provider first appears, and cache.ts:123 calls initProvider() inside initCache itself, so initialization occurs during that render even though the empty-deps effect will not re-run.

**Counter-citation:** config-context.ts:45-50 (machine-checked)
```text
  if (provider && !cacheContextRef.current) {
    cacheContextRef.current = initCache(
      provider((extendedConfig as any).cache || defaultCache),
      config
    )
  }
```
**Counter-citation:** cache.ts:123-123 (machine-checked)
```text
    initProvider()
```

## Uncertain

### F-003 - Unconditional _c clear races with concurrent optimistic mutations

**Claim:** After startRevalidate the code unconditionally clears _c, so a second concurrent optimistic mutation that set a new _c backup has its backup wiped by the first mutation's completion, breaking rollback.

**Verifier:** uncertain - verifier output was not parseable JSON (empty model output), finish_reason=length

