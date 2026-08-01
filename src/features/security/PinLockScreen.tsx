import { useState } from "react";
import { useAppStore } from "../../app/store";
import styles from "./PinLockScreen.module.css";

export function PinLockScreen() {
  const verifyPin = useAppStore((s) => s.verifyPin);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setChecking(true);
    const ok = await verifyPin(pin);
    setChecking(false);
    if (!ok) {
      setError(true);
      setPin("");
      return;
    }
    setError(false);
  }

  return (
    <div className={styles.overlay}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <div className={styles.icon} aria-hidden="true">
          🔒
        </div>
        <h1 className={styles.title}>Enter PIN</h1>
        <p className={styles.hint}>This device needs the PIN to continue.</p>
        <input
          className={styles.input}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          maxLength={8}
          value={pin}
          onChange={(e) => {
            setPin(e.target.value.replace(/\D/g, "").slice(0, 8));
            setError(false);
          }}
          aria-label="PIN"
          placeholder="••••••"
        />
        {error && (
          <div className={styles.error} role="alert">
            Incorrect PIN. Try again.
          </div>
        )}
        <button className={styles.submit} type="submit" disabled={!pin || checking}>
          {checking ? "Checking…" : "Unlock"}
        </button>
      </form>
    </div>
  );
}
