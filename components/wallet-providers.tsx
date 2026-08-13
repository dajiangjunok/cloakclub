"use client";

import { useCallback, useMemo, type ReactNode } from "react";
import { DecryptPermission } from "@provablehq/aleo-wallet-adaptor-core";
import { LeoWalletAdapter } from "@provablehq/aleo-wallet-adaptor-leo";
import { AleoWalletProvider } from "@provablehq/aleo-wallet-adaptor-react";
import { ShieldWalletAdapter } from "@provablehq/aleo-wallet-adaptor-shield";
import { Network } from "@provablehq/aleo-types";
import { ALEO_CONFIG } from "@/lib/config";

export function WalletProviders({ children }: { children: ReactNode }) {
  const wallets = useMemo(
    () => [new ShieldWalletAdapter(), new LeoWalletAdapter()],
    []
  );
  const programs = useMemo(() => [ALEO_CONFIG.programId], []);
  const handleError = useCallback((error: Error) => {
    if (error.message.includes("connect request is already in progress")) return;
    console.error("Aleo wallet error", error);
  }, []);

  return (
    <AleoWalletProvider
      wallets={wallets}
      network={Network.TESTNET}
      decryptPermission={DecryptPermission.UponRequest}
      programs={programs}
      onError={handleError}
    >
      {children}
    </AleoWalletProvider>
  );
}
