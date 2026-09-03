// Game version. Bumped automatically by scripts/hooks/pre-commit (via scripts/bump-version.sh) together with version.json. The page shows it bottom-left and
// polls version.json so a player on an old build gets an "update available" prompt.
export const VERSION = '1.0.15';
export const VERSION_CHECK_MS = 5 * 60 * 1000;

/** Poll version.json (cache-busted) and call `onNew(remote)` once when the deployed version differs. */
export function watchVersion(onNew) {
  let told = false;
  const check = async () => {
    try {
      const r = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!r.ok) return;
      const { version } = await r.json();
      if (version && version !== VERSION && !told) { told = true; onNew(version); }
    } catch (e) { /* offline or file:// - ignore */ }
  };
  check();
  setInterval(check, VERSION_CHECK_MS);
}
