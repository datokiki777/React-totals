import { useState } from "react";
import { useAppStore } from "../app/store";
import { manualCloudSave, resolveCloudConflict } from "./cloudSyncController";
import { RestoreSourcePicker } from "./RestoreSourcePicker";
import { signInWithEmail } from "./auth";
import styles from "../features/settings/SettingsPanel.module.css";

const STATUS_LABEL: Record<string, string> = {
  idle: "Not synced yet",
  syncing: "Syncing…",
  synced: "Synced",
  local: "Saved locally (will sync when possible)",
  error: "Cloud error",
};

function describeAuthError(err: unknown): string {
  const code = err && typeof err === "object" && "code" in err ? String((err as { code: unknown }).code) : "";
  switch (code) {
    case "auth/user-not-found":
      return "No account exists with this email yet — it must be created first in the Firebase Console (Authentication > Users > Add user).";
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Wrong email or password.";
    case "auth/invalid-email":
      return "That doesn't look like a valid email address.";
    case "auth/user-disabled":
      return "This account has been disabled in the Firebase Console.";
    case "auth/too-many-requests":
      return "Too many failed attempts — wait a bit before trying again.";
    case "auth/network-request-failed":
      return "Network error — check your connection and try again.";
    case "auth/operation-not-allowed":
      return "Email/Password sign-in isn't enabled for this project (Firebase Console > Authentication > Sign-in method).";
    default:
      return code ? `Sign in failed (${code}).` : "Sign in failed — check your email and password.";
  }
}

function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      setError("Enter both email and password.");
      return;
    }
    setSigningIn(true);
    setError(null);
    try {
      await signInWithEmail(email, password);
      // onAuthStateChanged (subscribed in startCloudSync) picks this up
      // and triggers the first sync automatically.
    } catch (err) {
      console.error("Sign in failed:", err);
      setError(describeAuthError(err));
    } finally {
      setSigningIn(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p className={styles.hint}>
        Sign in once on this device to sync your data to the cloud and pull it
        down on any other device. Entirely optional — the app works fully
        offline without this.
      </p>
      <div className={styles.fieldRow}>
        <label className={styles.field}>
          <span>Email</span>
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
      </div>
      {error && (
        <div role="alert" style={{ color: "var(--danger)", fontSize: 13 }}>
          {error}
        </div>
      )}
      <button
        type="submit"
        className={styles.clearBtn}
        style={{ background: "var(--accent)", alignSelf: "flex-start" }}
        disabled={signingIn}
      >
        {signingIn ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export function CloudSyncSettings() {
  const cloudUserEmail = useAppStore((s) => s.cloudUserEmail);
  const cloudStatus = useAppStore((s) => s.cloudStatus);
  const cloudError = useAppStore((s) => s.cloudError);
  const cloudConflict = useAppStore((s) => s.cloudConflict);
  const cloudLastSyncDetail = useAppStore((s) => s.cloudLastSyncDetail);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  async function handleSave() {
    setBusy(true);
    setMessage(null);
    try {
      await manualCloudSave();
      setMessage("Saved to cloud.");
    } catch {
      setMessage("Cloud save failed.");
    } finally {
      setBusy(false);
    }
  }

  if (cloudConflict) {
    return (
      <div>
        <p className={styles.hint}>
          <b>This device and the cloud both have changes and we can't tell which is
          newer.</b> Choose which version to keep — the other will be replaced.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            className={styles.clearBtn}
            style={{ background: "var(--accent)" }}
            onClick={() => resolveCloudConflict("keep-local")}
          >
            Keep this device's data
          </button>
          <button
            type="button"
            className={styles.clearBtn}
            onClick={() => resolveCloudConflict("use-cloud")}
          >
            Use cloud data instead
          </button>
        </div>
      </div>
    );
  }

  if (!cloudUserEmail) {
    return <SignInForm />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div className={styles.infoGrid}>
        <span>Account</span>
        <span>{cloudUserEmail}</span>
        <span>Status</span>
        <span>{STATUS_LABEL[cloudStatus] ?? cloudStatus}</span>
        {cloudStatus === "error" && cloudError && (
          <>
            <span>Details</span>
            <span>{cloudError}</span>
          </>
        )}
      </div>
      {cloudLastSyncDetail && (
        <div style={{ fontSize: 13, color: "var(--success)" }}>{cloudLastSyncDetail}</div>
      )}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button type="button" className={styles.clearBtn} onClick={handleSave} disabled={busy}>
          Save to cloud now
        </button>
        <button
          type="button"
          className={styles.clearBtn}
          onClick={() => setPickerOpen(true)}
          disabled={busy}
        >
          Load from cloud
        </button>
      </div>
      {message && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{message}</div>}
      {pickerOpen && <RestoreSourcePicker onClose={() => setPickerOpen(false)} />}
    </div>
  );
}
