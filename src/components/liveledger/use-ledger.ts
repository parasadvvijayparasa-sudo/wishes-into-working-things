import { useCallback, useEffect, useRef, useState } from "react";
import { initialState, type LedgerState } from "@/lib/liveledger";

const STORAGE_KEY = "liveledger:v1";

export function useLedger() {
  const [state, setState] = useState<LedgerState>(initialState);
  const loaded = useRef(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setState({ ...initialState(), ...(JSON.parse(raw) as LedgerState) });
    } catch {
      /* ignore corrupt storage */
    }
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const reset = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    loaded.current = false;
    setState(initialState());
    // Re-enable saving after the reset render so the cleared storage stays cleared until the next change.
    setTimeout(() => {
      loaded.current = true;
    }, 0);
  }, []);

  return { state, setState, reset };
}
