# Rejected and unresolved findings

Commit: 1c0f1f82340f096e5850386d617d6a3885693001  |  run-id: f70bdd8da0dee52d

This file exists on purpose: the product is not 'we found everything', it is 'we do not publish what we could not prove'. Rejected findings stay visible with the evidence that refuted them.

## Refuted

_None this run._
## Uncertain

### F-002 - Suspended range handle never cleared

**Claim:** Component._excess range handle is stored and reused via || without ever being cleared in unmount, so a re-suspend keeps a stale start marker and unmount leaks the reference.

**Verifier:** uncertain - The excerpt at diff/index.js:417-419 only proves _excess is assigned and reused, with diff/index.js:416 stating this preserves the original range on re-suspend; the cited unmount evidence ends at the opening condition around diff/index.js:811-820 without its body, and no other _excess assignments or clears are shown, so it cannot be settled whether unmount or a successful render clears it or whether the marker is detached on re-suspend. The full unmount function, the successful-render path in diff/index.js, and a repo-wide search for _excess would be needed.

### F-003 - Old-vnode MATCHED flag never reset

**Claim:** MATCHED is set on oldChildren during matching but only new-vnode flags are cleared after each child, so flags left on old vnodes after a throw persist into the next diff and cause findMatchingIndex to skip live nodes.

**Verifier:** uncertain - The excerpts show MATCHED being set on old vnodes at diff/children.js:250-252, but they do not show findMatchingIndex, any MATCHED reset in the unshown portions of diff/children.js, or the throw/suspend retry path, so persistence into the next diff and skipping of live nodes cannot be settled from the given context.

