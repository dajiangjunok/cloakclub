import type { Metadata } from "next";
import "@provablehq/aleo-wallet-adaptor-react-ui/dist/styles.css";
import "./globals.css";
import { WalletProviders } from "@/components/wallet-providers";
import { LanguageProvider } from "@/components/language-provider";

export const metadata: Metadata = {
  title: "CloakClub | Private community on Aleo",
  description: "Prove you belong without revealing who you are. Private membership and anonymous voting, powered by Aleo."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider><WalletProviders>{children}</WalletProviders></LanguageProvider>
      </body>
    </html>
  );
}
