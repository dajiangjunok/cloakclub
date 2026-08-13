import type { Metadata } from "next";
import "@provablehq/aleo-wallet-adaptor-react-ui/dist/styles.css";
import "./globals.css";
import { WalletProviders } from "@/components/wallet-providers";

export const metadata: Metadata = {
  title: "CloakClub | Aleo 隐私社区",
  description: "证明你属于这里，不必说出你是谁。由 Aleo 提供隐私成员凭证与匿名投票。"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <WalletProviders>{children}</WalletProviders>
      </body>
    </html>
  );
}
