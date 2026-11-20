import { useEffect, useState } from "react";
import { LiveLedgerSDK, type LedgerState } from "@/sdk/liveledger-sdk";

/** Binds one LiveLedgerSDK instance to React. Storage is attached after hydration to avoid SSR mismatches. */
export function useLiveLedger(): { ledger: LiveLedgerSDK; state: LedgerState } {
  const [ledger, setLedger] = useState(() => new LiveLedgerSDK());
  const [state, setState] = useState<LedgerState>(() => ledger.getState());

  useEffect(() => {
    const sdk = new LiveLedgerSDK({ storage: window.localStorage });
    setLedger(sdk);
    setState(sdk.getState());
    return sdk.subscribe(() => setState(sdk.getState()));
  }, []);

  return { ledger, state };
}
