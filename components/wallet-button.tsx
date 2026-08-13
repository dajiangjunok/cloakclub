"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";
import { WalletReadyState, type WalletName } from "@provablehq/aleo-wallet-standard";
import { Network } from "@provablehq/aleo-types";
import { Check, ChevronDown, LoaderCircle, LogOut, WalletCards, X } from "lucide-react";
import { shortId } from "@/lib/aleo";

function connectionMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.toLowerCase().includes("connect request is already in progress")) {
    return "钱包中已有未完成的连接请求。请打开钱包扩展完成或取消；若没有弹窗，请重载扩展和本页面后再试。";
  }
  if (message.toLowerCase().includes("user rejected")) return "你已取消钱包连接。";
  return message || "钱包连接失败，请检查扩展后重试。";
}

export function WalletButton() {
  const {
    wallets,
    wallet,
    address,
    connected,
    connecting,
    reconnecting,
    disconnecting,
    selectWallet,
    connect,
    disconnect
  } = useWallet();
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState("");
  const [requestPending, setRequestPending] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const connectRequest = useRef<Promise<void> | null>(null);
  const busy = connecting || reconnecting || disconnecting || requestPending;

  useEffect(() => {
    if (!menuOpen) return;
    function closeMenu(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setMenuOpen(false);
    }
    function closeWithEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", closeMenu);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("mousedown", closeMenu);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, [menuOpen]);

  function chooseWallet(name: WalletName) {
    if (busy) return;
    setError("");
    selectWallet(name);
    setMenuOpen(false);
  }

  async function connectOnce() {
    if (connectRequest.current || busy) return;
    if (!wallet) {
      setMenuOpen(true);
      return;
    }
    if (![WalletReadyState.INSTALLED, WalletReadyState.LOADABLE].includes(wallet.readyState)) {
      setError(`${wallet.adapter.name} 扩展尚未安装或未被浏览器检测到。`);
      if (wallet.adapter.url) window.open(wallet.adapter.url, "_blank", "noopener,noreferrer");
      return;
    }

    setError("");
    const request = connect(Network.TESTNET);
    connectRequest.current = request;
    setRequestPending(true);
    try {
      await request;
    } catch (connectError) {
      setError(connectionMessage(connectError));
    } finally {
      connectRequest.current = null;
      setRequestPending(false);
    }
  }

  async function disconnectWallet() {
    if (busy) return;
    setError("");
    try {
      await disconnect();
      setMenuOpen(false);
    } catch (disconnectError) {
      setError(disconnectError instanceof Error ? disconnectError.message : "断开钱包失败，请重试。");
    }
  }

  const buttonLabel = busy
    ? connecting || reconnecting ? "连接中..." : "断开中..."
    : connected && address
      ? shortId(address, 6, 4)
      : wallet
        ? `连接 ${wallet.adapter.name}`
        : "选择钱包";

  return (
    <div className="wallet-control" ref={rootRef}>
      <div className="wallet-control-row">
        <button
          className="wallet-adapter-button wallet-main-button"
          type="button"
          disabled={busy}
          onClick={() => connected ? setMenuOpen((open) => !open) : void connectOnce()}
          aria-expanded={menuOpen}
        >
          {busy ? <LoaderCircle className="wallet-spinner" size={17} /> : <WalletCards size={17} />}
          <span>{buttonLabel}</span>
          {connected && <ChevronDown size={14} />}
        </button>
        {!connected && wallet && (
          <button
            className="wallet-change-button"
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            disabled={busy}
            title="更换钱包"
            aria-label="更换钱包"
            aria-expanded={menuOpen}
          >
            <ChevronDown size={16} />
          </button>
        )}
      </div>

      {menuOpen && (
        <div className="wallet-menu" role="dialog" aria-label="Aleo 钱包">
          <div className="wallet-menu-heading">
            <strong>{connected ? "钱包账户" : "选择 Aleo 钱包"}</strong>
            <button type="button" onClick={() => setMenuOpen(false)} aria-label="关闭钱包菜单"><X size={15} /></button>
          </div>
          {connected ? (
            <>
              <div className="wallet-account">
                <span>{wallet?.adapter.name}</span>
                <code>{address}</code>
              </div>
              <button className="wallet-menu-action danger" type="button" onClick={() => void disconnectWallet()}>
                <LogOut size={16} />断开连接
              </button>
            </>
          ) : (
            <div className="wallet-options">
              {wallets.map((candidate) => {
                const available = [WalletReadyState.INSTALLED, WalletReadyState.LOADABLE].includes(candidate.readyState);
                return (
                  <button
                    type="button"
                    key={candidate.adapter.name}
                    onClick={() => chooseWallet(candidate.adapter.name)}
                    disabled={!available}
                  >
                    {candidate.adapter.icon
                      ? <Image src={candidate.adapter.icon} alt="" width={27} height={27} unoptimized />
                      : <WalletCards size={24} />}
                    <span><strong>{candidate.adapter.name}</strong><small>{available ? "已检测到" : "未安装"}</small></span>
                    {wallet?.adapter.name === candidate.adapter.name && <Check size={17} />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {error && <div className="wallet-error" role="alert">{error}</div>}
    </div>
  );
}
