import { useRef, useState } from "react";
import { useAppStore } from "../../app/store";
import styles from "./GroupSwitcher.module.css";

/** How long a press must be held before it counts as "long press" (ms). */
export const GROUP_SWITCHER_LONG_PRESS_MS = 500;

export function GroupSwitcher() {
  const groups = useAppStore((s) => s.groups);
  const workspace = useAppStore((s) => s.workspace);
  const activeGroupId = useAppStore((s) => s.activeGroupId);
  const setActiveGroup = useAppStore((s) => s.setActiveGroup);
  const addGroup = useAppStore((s) => s.addGroup);
  const renameGroup = useAppStore((s) => s.renameGroup);
  const deleteGroup = useAppStore((s) => s.deleteGroup);
  const toggleArchiveGroup = useAppStore((s) => s.toggleArchiveGroup);
  const updateGroupSettings = useAppStore((s) => s.updateGroupSettings);
  const confirmDestructive = useAppStore((s) => s.settings.confirmDestructiveActions);

  const [menuOpen, setMenuOpen] = useState(false);
  const pressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);

  const visibleGroups = groups.filter((g) =>
    workspace === "active" ? !g.archived : g.archived
  );
  const activeGroup = groups.find((g) => g.id === activeGroupId);

  function cycleGroup() {
    if (visibleGroups.length === 0) return;
    const currentIndex = visibleGroups.findIndex((g) => g.id === activeGroupId);
    const next = visibleGroups[(currentIndex + 1) % visibleGroups.length];
    setActiveGroup(next.id);
  }

  function clearPressTimer() {
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }

  function handlePointerDown() {
    longPressFired.current = false;
    clearPressTimer();
    pressTimer.current = window.setTimeout(() => {
      longPressFired.current = true;
      setMenuOpen((v) => !v);
    }, GROUP_SWITCHER_LONG_PRESS_MS);
  }

  function handleSwitcherClick() {
    if (longPressFired.current) {
      // The long-press already toggled the menu; a short tap wasn't intended.
      longPressFired.current = false;
      return;
    }
    cycleGroup();
  }

  async function handleAddGroup() {
    const name = window.prompt("Group name:");
    if (name === null) return;
    await addGroup(name);
  }

  async function handleRename() {
    if (!activeGroup) return;
    const name = window.prompt("New name:", activeGroup.name);
    if (name === null) return;
    await renameGroup(activeGroup.id, name);
  }

  async function handleDelete() {
    if (!activeGroup) return;
    if (
      confirmDestructive &&
      !window.confirm(`Delete group "${activeGroup.name}" and all its periods?`)
    ) {
      return;
    }
    await deleteGroup(activeGroup.id);
  }

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        data-testid="group-switcher-btn"
        className={styles.switcherBtn}
        onPointerDown={handlePointerDown}
        onPointerUp={clearPressTimer}
        onPointerLeave={clearPressTimer}
        onPointerCancel={clearPressTimer}
        onClick={handleSwitcherClick}
        aria-haspopup="true"
        aria-expanded={menuOpen}
        title="Tap: next group · Long-press: menu"
      >
        <span className={styles.switcherDot} aria-hidden="true" />
        {activeGroup ? activeGroup.name : "Select group"} ▾
      </button>

      {menuOpen && (
        <div className={styles.menuPanel} role="menu">
          <div className={styles.row}>
            <button className={styles.btn} onClick={handleAddGroup} type="button">
              + Group
            </button>
            <button
              className={styles.btn}
              onClick={handleRename}
              type="button"
              disabled={!activeGroup}
            >
              Rename
            </button>
            <button
              className={styles.btnDanger}
              onClick={handleDelete}
              type="button"
              disabled={!activeGroup}
            >
              Delete
            </button>
            <button
              className={styles.btn}
              onClick={() => activeGroup && toggleArchiveGroup(activeGroup.id)}
              type="button"
              disabled={!activeGroup}
              title="Archive / Restore"
              aria-label="Archive / Restore"
            >
              📦
            </button>
          </div>

          <div className={styles.settingsRow}>
            <label className={styles.settingsField}>
              <span>Default %</span>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                disabled={!activeGroup}
                value={activeGroup?.defaultRate ?? ""}
                onChange={(e) =>
                  activeGroup &&
                  updateGroupSettings(activeGroup.id, { defaultRate: Number(e.target.value) })
                }
              />
            </label>
            <label className={styles.settingsField}>
              <span>Default salary / 28d</span>
              <input
                type="number"
                step="1"
                min="0"
                disabled={!activeGroup}
                value={activeGroup?.defaultSalary ?? ""}
                onChange={(e) =>
                  activeGroup &&
                  updateGroupSettings(activeGroup.id, { defaultSalary: Number(e.target.value) })
                }
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
