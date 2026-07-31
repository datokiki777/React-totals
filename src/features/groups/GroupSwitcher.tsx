import { useState } from "react";
import { useAppStore } from "../../app/store";
import styles from "./GroupSwitcher.module.css";

export function GroupSwitcher() {
  const groups = useAppStore((s) => s.groups);
  const workspace = useAppStore((s) => s.workspace);
  const activeGroupId = useAppStore((s) => s.activeGroupId);
  const setActiveGroup = useAppStore((s) => s.setActiveGroup);
  const addGroup = useAppStore((s) => s.addGroup);
  const renameGroup = useAppStore((s) => s.renameGroup);
  const deleteGroup = useAppStore((s) => s.deleteGroup);
  const toggleArchiveGroup = useAppStore((s) => s.toggleArchiveGroup);

  const [isPickerOpen, setPickerOpen] = useState(false);

  const visibleGroups = groups.filter((g) =>
    workspace === "active" ? !g.archived : g.archived
  );
  const activeGroup = groups.find((g) => g.id === activeGroupId);

  async function handleAddGroup() {
    const name = window.prompt("ჯგუფის სახელი:");
    if (name === null) return;
    await addGroup(name);
  }

  async function handleRename() {
    if (!activeGroup) return;
    const name = window.prompt("ახალი სახელი:", activeGroup.name);
    if (name === null) return;
    await renameGroup(activeGroup.id, name);
  }

  async function handleDelete() {
    if (!activeGroup) return;
    if (!window.confirm(`წაიშალოს ჯგუფი "${activeGroup.name}" ყველა პერიოდით?`)) return;
    await deleteGroup(activeGroup.id);
  }

  return (
    <div className={styles.row}>
      <div className={styles.pickerWrap}>
        <button
          className={styles.pickerBtn}
          type="button"
          onClick={() => setPickerOpen((v) => !v)}
        >
          {activeGroup ? activeGroup.name : "აირჩიე ჯგუფი"} ▾
        </button>
        {isPickerOpen && (
          <div className={styles.pickerList}>
            {visibleGroups.length === 0 && (
              <div className={styles.empty}>ჯგუფები არ არის</div>
            )}
            {visibleGroups.map((g) => (
              <button
                key={g.id}
                className={styles.pickerItem}
                onClick={() => {
                  setActiveGroup(g.id);
                  setPickerOpen(false);
                }}
              >
                {g.name}
              </button>
            ))}
          </div>
        )}
      </div>
      <button className={styles.btn} onClick={handleAddGroup} type="button">
        + ჯგუფი
      </button>
      <button className={styles.btn} onClick={handleRename} type="button" disabled={!activeGroup}>
        გადარქმევა
      </button>
      <button
        className={styles.btnDanger}
        onClick={handleDelete}
        type="button"
        disabled={!activeGroup}
      >
        წაშლა
      </button>
      <button
        className={styles.btn}
        onClick={() => activeGroup && toggleArchiveGroup(activeGroup.id)}
        type="button"
        disabled={!activeGroup}
        title="არქივი / დაბრუნება"
      >
        📦
      </button>
    </div>
  );
}
