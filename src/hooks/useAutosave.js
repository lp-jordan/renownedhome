import { useEffect, useRef, useState } from "react";

export function useAutosave({ draft, enabled, resetKey, save }) {
  const [status, setStatus] = useState("Saved");
  const saveRef = useRef(save);
  const firstRunRef = useRef(true);
  const serialized = JSON.stringify(draft);

  saveRef.current = save;

  useEffect(() => {
    firstRunRef.current = true;
    setStatus("Saved");
  }, [resetKey]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    if (firstRunRef.current) {
      firstRunRef.current = false;
      return undefined;
    }

    setStatus("Saving...");
    const timeout = setTimeout(async () => {
      try {
        await saveRef.current(draft);
        setStatus("Saved");
      } catch (error) {
        setStatus(error.message || "Error");
      }
    }, 900);

    return () => clearTimeout(timeout);
  }, [draft, enabled, serialized]);

  async function saveNow() {
    setStatus("Saving...");
    try {
      await saveRef.current(draft);
      setStatus("Saved");
    } catch (error) {
      setStatus(error.message || "Error");
    }
  }

  return { status, saveNow, setStatus };
}
