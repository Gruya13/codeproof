Hi — I was chasing a stale `getServerSnapshot` value and traced it to `INITIAL_CACHE` in `src/_internal/utils/helper.ts`.

It's a plain module-level object keyed only by the SWR key, shared by every cache and never cleared. Once one cache writes a key, a different cache using the same key ends up with the first cache's initial snapshot:

```js
const [get1, set1, , snap1] = createCacheHelper(cache1, "k");
set1({ data: "from-cache-1" });

const [, , , snap2] = createCacheHelper(cache2, "k");
snap2(); // undefined — expected {} (EMPTY_CACHE), cache2 is fresh
```

The bigger effect is that two independent caches (or two tests in the same process) interfere with each other through this global.

Shouldn't the initial snapshot be stored per cache, e.g. in the SWRGlobalState entry, or cleared when the cache is dropped?

2.3.x (8148ef01). Thanks!
