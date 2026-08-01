import { useState } from "react";
import { useAppStore } from "../../app/store";
import { isValidPinFormat } from "../../shared/lib/pin";
import styles from "../settings/SettingsPanel.module.css";

export function PinLockSettings() {
  const pinEnabled = useAppStore((s) => s.settings.pinEnabled);
  const verifyPin = useAppStore((s) => s.verifyPin);
  const setPinLock = useAppStore((s) => s.setPinLock);

  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [justChanged, setJustChanged] = useState(false);

  function resetFields() {
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
  }

  async function handleEnableOrChange(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (pinEnabled) {
      const ok = await verifyPin(currentPin);
      if (!ok) {
        setError("Current PIN is incorrect.");
        return;
      }
    }
    if (!isValidPinFormat(newPin)) {
      setError("PIN must be 4-8 digits.");
      return;
    }
    if (newPin !== confirmPin) {
      setError("PINs don't match.");
      return;
    }

    setBusy(true);
    try {
      await setPinLock({ enabled: true, newPin });
      resetFields();
      setJustChanged(true);
      setTimeout(() => setJustChanged(false), 2500);
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    setError(null);
    const ok = await verifyPin(currentPin);
    if (!ok) {
      setError("Current PIN is incorrect.");
      return;
    }
    setBusy(true);
    try {
      await setPinLock({ enabled: false });
      resetFields();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.wrap} style={{ gap: 0 }}>
      <p className={styles.hint}>
        When enabled, this PIN is required once per device (and syncs across your
        devices via Cloud Sync, if enabled) — it's a privacy screen, not real
        encryption, since anything client-side can technically be bypassed with
        developer tools.
      </p>

      <form onSubmit={handleEnableOrChange} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {pinEnabled && (
          <label className={styles.field}>
            <span>Current PIN</span>
            <input
              type="password"
              inputMode="numeric"
              maxLength={8}
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
            />
          </label>
        )}
        <div className={styles.fieldRow}>
          <label className={styles.field}>
            <span>{pinEnabled ? "New PIN" : "Set PIN (4-8 digits)"}</span>
            <input
              type="password"
              inputMode="numeric"
              maxLength={8}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
            />
          </label>
          <label className={styles.field}>
            <span>Confirm PIN</span>
            <input
              type="password"
              inputMode="numeric"
              maxLength={8}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
            />
          </label>
        </div>

        {error && (
          <div role="alert" style={{ color: "var(--danger)", fontSize: 13 }}>
            {error}
          </div>
        )}
        {justChanged && (
          <div style={{ color: "var(--success)", fontSize: 13 }}>
            PIN {pinEnabled ? "updated" : "enabled"}.
          </div>
        )}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="submit" className={styles.clearBtn} style={{ background: "var(--accent)" }} disabled={busy}>
            {pinEnabled ? "Change PIN" : "Enable PIN lock"}
          </button>
          {pinEnabled && (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={handleDisable}
              disabled={busy || !currentPin}
            >
              Disable PIN lock
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
