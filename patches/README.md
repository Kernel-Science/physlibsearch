# jixia compatibility patches

The indexing pipeline runs [jixia](https://github.com/frenzymath/jixia) over
PhysLib. jixia reads PhysLib's compiled `.olean` files, whose headers are locked
to an exact Lean version, so **jixia must be built with PhysLib's exact
toolchain**. Otherwise every module fails with `incompatible header`.

PhysLib tracks Lean releases closely — v4.32.0 in July 2026, v4.33.0 weeks later
— while upstream jixia has been on v4.29.0 since April 2026. So jixia usually
does not compile against the toolchain PhysLib is currently on, and the pipeline
needs a patch to bridge the gap.

## How the workflow uses these

`Build jixia` tries, in order:

1. **Upstream jixia, unpatched.** If this works the patches are unnecessary and
   should be deleted.
2. **Each `jixia-lean-*.patch` in turn**, skipping any that no longer apply and
   reverting any that apply but fail to build.

If nothing builds, the run fails rather than quietly skipping — a green run that
indexes nothing once went unnoticed for two and a half weeks.

Adding support for a new Lean release means **dropping in another patch file**.
The workflow needs no change.

## Why there is one patch per Lean version

The patches are not interchangeable. `docString?` takes two constructor fields in
v4.32.0 and one in v4.33.0, so a single patch cannot satisfy both.

## Writing a new patch

The changes so far have been mechanical migrations, not logic changes:

- `let x := ← e` → `let x ← e` (Lean tightened `do`-block elaboration)
- `return` → `pure` inside those branches
- an explicit `(none : Option Syntax)` where the type is no longer inferred
- an explicit `:term` antiquotation annotation in `nestedAction`

Check [jarfo/jixia](https://github.com/jarfo/jixia) first — that fork has carried
branches targeting newer Lean releases (`v4.33.0-rc2` was usable verbatim), which
is where both current patches came from.

To produce one:

```sh
git clone --depth 1 https://github.com/frenzymath/jixia jixia-upstream
git clone --depth 1 -b <branch> https://github.com/jarfo/jixia jixia-fixed
cd jixia-fixed
echo "leanprover/lean4:vX.Y.Z" > lean-toolchain   # match PhysLib exactly
rm -rf .lake/build && lake build                  # MUST be a clean build
```

A clean build is not optional. A cached build once hid a failure in
`Analyzer/Process.lean` that only surfaced in CI, because the stale `.olean` was
reused instead of recompiled.

Once it builds, diff the changed files against upstream and save the result as
`patches/jixia-lean-<version>.patch` with `a/` and `b/` path prefixes so
`git apply` accepts it. Prose above the first `---` line is ignored by
`git apply`, so explain the change there.

## Removing them

When upstream jixia supports the toolchain PhysLib is on, step 1 succeeds and the
patches stop being consulted. Delete them then — they are dead weight, and a
stale patch that still applies but produces subtly wrong output is worse than no
patch at all.
