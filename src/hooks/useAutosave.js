import { useEffect, useRef, useState } from "react";

export function useAutosave({ draft, enabled, resetKey, save }) {
  const [status, setStatus] = useState("Saved");
  const saveRef = useRef(save);
  const firstRunRef = useRef(true);
  const lastSavedSerializedRef = useRef(JSON.stringify(draft));
  const serialized = JSON.stringify(draft);

  saveRef.current = save;

  useEffect(() => {
    firstRunRef.current = true;
    lastSavedSerializedRef.current = serialized;
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

    if (serialized === lastSavedSerializedRef.current) {
      setStatus("Saved");
      return undefined;
    }

    setStatus("Unsaved");
    const timeout = setTimeout(async () => {
      try {
        setStatus("Saving...");
        await saveRef.current(draft);
        lastSavedSerializedRef.current = serialized;
        setStatus("Saved");
      } catch (error) {
        setStatus(error.message || "Error");
      }
    }, 900);

    return () => clearTimeout(timeout);
  }, [draft, enabled, serialized]);

  async function saveNow() {
    if (serialized === lastSavedSerializedRef.current) {
      setStatus("Saved");
      return;
    }

    setStatus("Saving...");
    try {
      await saveRef.current(draft);
      lastSavedSerializedRef.current = serialized;
      setStatus("Saved");
    } catch (error) {
      setStatus(error.message || "Error");
    }
  }

  return { status, saveNow, setStatus };
}
