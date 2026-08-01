/**
 * The core "which side wins" decision for cloud sync — deliberately kept
 * free of any Firebase import so it's a pure function, fully unit
 * testable, and the one place this logic lives (no duplicated timestamp
 * comparisons scattered across the sync orchestrator).
 */

export type SyncDecision = "push" | "pull" | "ask" | "noop";

export interface SyncSide {
  /** True if this side has at least one group (i.e. real data, not an
   * empty fresh install). */
  hasData: boolean;
  /** ISO timestamp of the last local/cloud change, or null if unknown. */
  updatedAt: string | null;
}

/**
 * Decides what a device should do on startup (or after reconnecting),
 * given the local and cloud data's "last changed" state:
 *
 * - Neither side has data yet             -> noop (nothing to sync)
 * - Cloud has never been written to       -> push  ("first device")
 * - Local has no data yet, cloud does     -> pull  ("new device")
 * - Both have data, local is newer        -> push  (incl. "offline changes":
 *                                             local changed while offline,
 *                                             cloud didn't move, so local
 *                                             is unambiguously newer once
 *                                             back online)
 * - Both have data, cloud is newer        -> pull
 * - Timestamps tie or are unparsable      -> ask   (never guess — let the
 *                                             person choose which side to
 *                                             keep instead of silently
 *                                             overwriting newer data with
 *                                             older data)
 */
export function resolveSyncDirection(local: SyncSide, cloud: SyncSide): SyncDecision {
  if (!local.hasData && !cloud.hasData) return "noop";
  if (!cloud.hasData) return local.hasData ? "push" : "noop";
  if (!local.hasData) return "pull";

  const localTime = local.updatedAt ? Date.parse(local.updatedAt) : NaN;
  const cloudTime = cloud.updatedAt ? Date.parse(cloud.updatedAt) : NaN;

  if (Number.isNaN(localTime) || Number.isNaN(cloudTime)) return "ask";
  if (localTime === cloudTime) return "ask";
  return localTime > cloudTime ? "push" : "pull";
}
