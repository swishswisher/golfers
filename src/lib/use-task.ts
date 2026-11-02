"use client";
import { useCallback, useRef, useState } from "react";
export function useTask() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    active = useRef(false);
  const run = useCallback(async (task: () => Promise<void>, message = "") => {
    if (active.current) return;
    active.current = true;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await task();
      if (message) setSuccess(message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      active.current = false;
      setBusy(false);
    }
  }, []);
  return { busy, error, success, run };
}
