"use client";

import { useMemo, type ReactNode } from "react";
import { DecryptPermission } from "@provablehq/aleo-wallet-adaptor-core";
import { LeoWalletAdapter } from "@provablehq/aleo-wallet-adaptor-leo";
import { AleoWalletProvider } from "@provablehq/aleo-wallet-adaptor-react";
import { WalletModalProvider } from "@provablehq/aleo-wallet-adaptor-react-ui";
import { ShieldWalletAdapter } from "@provablehq/aleo-wallet-adaptor-shield";
import { Network } from "@provablehq/aleo-types";
import { ALEO_CONFIG } from "@/lib/config";

export function WalletProviders({ children }: { children: ReactNode }) {
  const wallets = useMemo(
    () => [new ShieldWalletAdapter(), new LeoWalletAdapter()],
    []
  );

  return (
    <AleoWalletProvider
      wallets={wallets}
      network={Network.TESTNET}
      autoConnect
      decryptPermission={DecryptPermission.UponRequest}
      programs={[ALEO_CONFIG.programId]}
      onError={(error) => console.error("Aleo wallet error", error)}
    >
      <WalletModalProvider network={Network.TESTNET}>{children}</WalletModalProvider>
    </AleoWalletProvider>
  );
}
