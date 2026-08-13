"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";
import { WalletMultiButton } from "@provablehq/aleo-wallet-adaptor-react-ui";
import {
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Heart,
  Home,
  KeyRound,
  LockKeyhole,
  MessageSquareText,
  Plus,
  Radio,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  TreePine,
  Users,
  Vote,
  X
} from "lucide-react";
import { ALEO_CONFIG, APP_CONFIG, validatePublicConfig } from "@/lib/config";
import { loadChainState } from "@/lib/aleo-api";
import { getRecordPlaintext, shortId, textToField } from "@/lib/aleo";
import { addPostReaction, loadCommunity, loadPosts, loadProposalMetadata, publishVerifiedPost } from "@/lib/supabase";
import type { ActionState, Community, Post, Proposal } from "@/lib/types";
import { PixelTreehouse } from "./pixel-treehouse";

const INITIAL_ACTION: ActionState = { phase: "idle", message: "" };

function relativeTime(value: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "刚刚";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟前`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时前`;
  return `${Math.floor(seconds / 86400)} 天前`;
}

function deadline(value: string | null): string {
  if (!value) return "未设置截止时间";
  const remaining = new Date(value).getTime() - Date.now();
  if (remaining <= 0) return "已到截止时间";
  const hours = Math.ceil(remaining / 3_600_000);
  return hours < 24 ? `还剩 ${hours} 小时` : `还剩 ${Math.floor(hours / 24)} 天 ${hours % 24} 小时`;
}

function formatRecord(record: unknown): string | null {
  const direct = getRecordPlaintext(record);
  if (direct) return direct;
  if (!record || typeof record !== "object") return null;

  const envelope = record as Record<string, unknown>;
  if (envelope.record && typeof envelope.record === "string") return envelope.record;
  return null;
}

export function CloakClubApp() {
  const { connected, address, executeTransaction, requestRecords, requestTransactionHistory, transactionStatus } = useWallet();
  const [posts, setPosts] = useState<Post[]>([]);
  const [community, setCommunity] = useState<Community | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [composerOpen, setComposerOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [body, setBody] = useState("");
  const [action, setAction] = useState<ActionState>(INITIAL_ACTION);
  const [votedAddress, setVotedAddress] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"home" | "posts" | "vote">("home");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const totalVotes = (proposal?.yes ?? 0) + (proposal?.no ?? 0);
  const yesPercent = totalVotes && proposal ? Math.round((proposal.yes / totalVotes) * 100) : 0;
  const hasVoted = Boolean(address && votedAddress === address);

  const refreshData = useCallback(async () => {
    const missing = validatePublicConfig();
    if (missing.length) {
      setLoadError(`缺少环境配置：${missing.join("、")}`);
      setLoading(false);
      return;
    }
    setLoadError("");
    try {
      const [communityData, proposalMetadata, postData, chain] = await Promise.all([
        loadCommunity(), loadProposalMetadata(), loadPosts(), loadChainState()
      ]);
      setCommunity(communityData);
      setPosts(postData);
      setMemberCount(chain.memberCount);
      setProposal({ ...proposalMetadata, yes: chain.yes, no: chain.no, isOpen: chain.isOpen });
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "无法读取测试网数据");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const task = window.setTimeout(() => void refreshData(), 0);
    return () => window.clearTimeout(task);
  }, [refreshData]);

  const identityLabel = useMemo(() => {
    if (connected && address) return shortId(address, 7, 5);
    return "尚未连接";
  }, [address, connected]);

  async function membershipRecord(): Promise<string> {
    const records = await requestRecords(ALEO_CONFIG.programId, true, "unspent");
    for (const record of records) {
      const plaintext = formatRecord(record);
      if (plaintext?.includes(APP_CONFIG.communityId) && plaintext.includes("member_secret")) {
        return plaintext;
      }
    }
    throw new Error("钱包中没有找到该社区的未消费 Member 凭证，请先让管理员发放凭证。");
  }

  async function submitTransition(functionName: string, inputs: string[]) {
    if (!connected) throw new Error("请先连接 Shield 或 Leo Wallet，再提交到 Aleo 测试网。");
    const result = await executeTransaction({
      program: ALEO_CONFIG.programId,
      function: functionName,
      inputs,
      fee: ALEO_CONFIG.fee,
      privateFee: false
    });
    if (!result?.transactionId) throw new Error("钱包没有返回交易 ID，请检查签名请求。");
    return result.transactionId;
  }

  async function waitForConfirmation(temporaryTransactionId: string): Promise<string> {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const result = await transactionStatus(temporaryTransactionId);
      const status = result.status.toLowerCase();
      if (["accepted", "finalized"].includes(status)) {
        if (result.transactionId) return result.transactionId;
        const history = await requestTransactionHistory(ALEO_CONFIG.programId);
        const match = history.transactions.find(
          (transaction) => transaction.id === temporaryTransactionId || transaction.transactionId === temporaryTransactionId
        );
        return match?.transactionId ?? temporaryTransactionId;
      }
      if (["failed", "rejected", "aborted"].includes(status)) {
        throw new Error(result.error ?? `交易未被测试网接受：${result.status}`);
      }
      await new Promise((resolve) => window.setTimeout(resolve, 5000));
    }
    throw new Error("等待链上确认超时。交易可能仍在处理中，请稍后刷新页面。");
  }

  async function publishPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanBody = body.trim();
    if (!cleanBody) return;

    setAction({ phase: "proving", message: "正在生成零知识证明，请在钱包中确认..." });
    try {
      const commitment = await textToField(cleanBody);
      const record = await membershipRecord();
      const temporaryId = await submitTransition("publish_post", [record, APP_CONFIG.communityId, commitment]);
      setAction({ phase: "submitted", message: "交易已提交，正在等待 Aleo 测试网确认...", transactionId: temporaryId });
      const transactionId = await waitForConfirmation(temporaryId);
      await publishVerifiedPost({ body: cleanBody, commitment, transactionId });
      await refreshData();
      setBody("");
      setComposerOpen(false);
      setAction({
        phase: "confirmed",
        message: "帖子交易已在测试网确认，公开正文已通过链上 commitment 校验。",
        transactionId
      });
    } catch (error) {
      setAction({ phase: "error", message: error instanceof Error ? error.message : "发布失败，请重试。" });
    }
  }

  async function castVote(choice: boolean) {
    if (hasVoted) return;
    if (!proposal?.isOpen) return;
    setAction({ phase: "proving", message: "正在证明成员资格，请在钱包中确认..." });
    try {
      const record = await membershipRecord();
      const temporaryId = await submitTransition("vote", [record, APP_CONFIG.communityId, APP_CONFIG.proposalId, String(choice)]);
      setAction({ phase: "submitted", message: "投票已提交，正在等待 Aleo 测试网确认...", transactionId: temporaryId });
      const transactionId = await waitForConfirmation(temporaryId);
      await refreshData();
      setVotedAddress(address);
      setAction({
        phase: "confirmed",
        message: "投票已在测试网确认，票数来自 Aleo mapping。",
        transactionId
      });
    } catch (error) {
      setAction({ phase: "error", message: error instanceof Error ? error.message : "投票失败，请重试。" });
    }
  }

  async function addReaction(id: string) {
    try {
      await addPostReaction(id);
      await refreshData();
    } catch (error) {
      setAction({ phase: "error", message: error instanceof Error ? error.message : "回应失败" });
    }
  }

  if (loading) return <div className="loading-screen">正在同步 Aleo 测试网...</div>;
  if (loadError || !community || !proposal) return (
    <div className="loading-screen">
      <div><strong>无法加载真实数据</strong><p>{loadError || "社区或提案尚未初始化"}</p><button onClick={() => { setLoading(true); void refreshData(); }}><RefreshCw size={16} />重新加载</button></div>
    </div>
  );

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="CloakClub 首页">
          <span className="brand-mark"><KeyRound size={19} /></span>
          <span>CLOAK<span>CLUB</span></span>
        </a>
        <nav className="desktop-nav" aria-label="主导航">
          <button className={activeView === "home" ? "active" : ""} onClick={() => setActiveView("home")}><Home size={16} />树屋</button>
          <button className={activeView === "posts" ? "active" : ""} onClick={() => setActiveView("posts")}><MessageSquareText size={16} />匿名帖</button>
          <button className={activeView === "vote" ? "active" : ""} onClick={() => setActiveView("vote")}><Vote size={16} />投票</button>
        </nav>
        <div className="wallet-wrap"><WalletMultiButton /></div>
      </header>

      <div className="mode-ribbon" role="status">
        <Radio size={15} />
        <strong>Aleo 测试网</strong>
        <span>{ALEO_CONFIG.programId} · 链上状态已同步</span>
        <button onClick={() => void refreshData()} title="刷新链上数据"><RefreshCw size={14} /></button>
      </div>

      <div className="dashboard" id="top">
        <aside className={`left-rail ${activeView === "home" ? "mobile-active" : ""}`}>
          <section className="club-intro">
            <PixelTreehouse />
            <div className="club-title-row">
              <span className="club-icon"><TreePine size={20} /></span>
              <div><p>欢迎回到</p><h1>{community.name}</h1></div>
            </div>
            <p className="club-copy">{community.description}</p>
            <div className="member-stats">
              <span><Users size={16} /><b>{memberCount}</b> 份成员凭证</span>
              <span><Sparkles size={16} /><b>{posts.reduce((total, post) => total + post.reactions, 0)}</b> 次回应</span>
            </div>
          </section>

          <section className="identity-panel">
            <div className="panel-label"><ShieldCheck size={16} />我的隐私身份</div>
            <div className="identity-row">
              <span className="pixel-avatar" aria-hidden="true"><i /><b /></span>
              <div><strong>{identityLabel}</strong><span>{connected ? "已连接测试网钱包" : "连接后检查成员凭证"}</span></div>
              {connected && <Check className="verified-check" size={17} />}
            </div>
            <div className="privacy-meter"><i /><i /><i /><i /><i /></div>
            <div className="privacy-score"><span>网络</span><strong>TESTNET</strong></div>
            <button className="text-button" onClick={() => setPrivacyOpen(true)}>查看保护详情 <ChevronRight size={15} /></button>
          </section>
        </aside>

        <section className={`feed-column ${activeView === "posts" ? "mobile-active" : ""}`}>
          <div className="feed-heading">
            <div><span className="eyebrow">MEMBERS ONLY</span><h2>树洞动态</h2></div>
            <button className="primary-button" onClick={() => setComposerOpen(true)}><Plus size={18} />写匿名帖</button>
          </div>

          <button className="composer-trigger" onClick={() => setComposerOpen(true)}>
            <span className="tiny-mask"><LockKeyhole size={17} /></span>
            <span>分享一个想法，不留下身份...</span>
            <Send size={18} />
          </button>

          <div className="privacy-note"><ShieldCheck size={15} /><span>发帖时仅验证成员凭证，链上保存内容承诺，不公开钱包地址。</span></div>

          <div className="post-list">
            {posts.map((post, index) => (
              <article className="post-card" key={post.id} style={{ "--delay": `${index * 60}ms` } as React.CSSProperties}>
                <div className="post-meta">
                  <span className={`anon-avatar avatar-${(index % 3) + 1}`} aria-hidden="true"><i /></span>
                  <div><strong>已验证成员</strong><span><Clock3 size={13} />{relativeTime(post.createdAt)}</span></div>
                </div>
                <p>{post.body}</p>
                <footer>
                  <button aria-label="为帖子送出爱心" title="送出爱心" onClick={() => void addReaction(post.id)}><Heart size={17} />{post.reactions}</button>
                  <span><LockKeyhole size={13} />承诺 {post.commitment}</span>
                </footer>
              </article>
            ))}
            {posts.length === 0 && <div className="privacy-note"><MessageSquareText size={15} /><span>测试网上还没有已确认的帖子。</span></div>}
          </div>
        </section>

        <aside className={`right-rail ${activeView === "vote" ? "mobile-active" : ""}`}>
          <section className="proposal-board">
            <div className="board-pin pin-left" /><div className="board-pin pin-right" />
            <div className="proposal-kicker"><Vote size={17} />正在投票</div>
            <h2>{proposal.title}</h2>
            <p>{proposal.description}</p>
            <div className="deadline"><Clock3 size={15} />{deadline(proposal.endsAt)}</div>

            <div className="vote-results">
              <div className="result-label"><span>{proposal.yesLabel}</span><strong>{proposal.yes} 票</strong></div>
              <div className="result-track"><i style={{ width: `${yesPercent}%` }} /></div>
              <div className="result-label"><span>{proposal.noLabel}</span><strong>{proposal.no} 票</strong></div>
              <div className="result-track coral"><i style={{ width: `${100 - yesPercent}%` }} /></div>
            </div>

            <div className="vote-actions">
              <button disabled={hasVoted || !proposal.isOpen || action.phase === "proving" || action.phase === "submitted"} onClick={() => castVote(true)}>{proposal.yesLabel}</button>
              <button className="coral-button" disabled={hasVoted || !proposal.isOpen || action.phase === "proving" || action.phase === "submitted"} onClick={() => castVote(false)}>{proposal.noLabel}</button>
            </div>
            {hasVoted && <div className="voted-message"><Check size={16} />你已经匿名投过票了</div>}
          </section>

          <section className="chain-card">
            <div className="chain-card-title"><span className="aleo-dot">A</span><div><strong>Aleo 隐私层</strong><span>{ALEO_CONFIG.programId}</span></div></div>
            <ul>
              <li><Check size={14} />成员凭证保存在私有 record</li>
              <li><Check size={14} />nullifier 阻止重复投票</li>
              <li><Check size={14} />公开结果不包含成员地址</li>
            </ul>
            <button className="text-button" onClick={() => setPrivacyOpen(true)}>它是怎么工作的？ <CircleHelp size={15} /></button>
          </section>
        </aside>
      </div>

      <nav className="mobile-nav" aria-label="移动端导航">
        <button className={activeView === "home" ? "active" : ""} onClick={() => setActiveView("home")}><Home size={20} /><span>树屋</span></button>
        <button className={activeView === "posts" ? "active" : ""} onClick={() => setActiveView("posts")}><MessageSquareText size={20} /><span>匿名帖</span></button>
        <button className={activeView === "vote" ? "active" : ""} onClick={() => setActiveView("vote")}><Vote size={20} /><span>投票</span></button>
      </nav>

      {action.phase !== "idle" && (
        <div className={`toast toast-${action.phase}`} role="status">
          <span className="toast-icon">{action.phase === "proving" ? <span className="loader" /> : action.phase === "error" ? <X size={18} /> : <Check size={18} />}</span>
          <div><strong>{action.phase === "proving" ? "生成证明" : action.phase === "error" ? "操作未完成" : action.phase === "confirmed" ? "链上已确认" : "操作已提交"}</strong><p>{action.message}</p>{action.transactionId && <a href={`${ALEO_CONFIG.explorerUrl}/transaction/${action.transactionId}`} target="_blank" rel="noreferrer"><code>{shortId(action.transactionId, 12, 8)}</code></a>}</div>
          <button aria-label="关闭通知" title="关闭" onClick={() => setAction(INITIAL_ACTION)}><X size={17} /></button>
        </div>
      )}

      {composerOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setComposerOpen(false)}>
          <section className="modal composer-modal" role="dialog" aria-modal="true" aria-labelledby="composer-title">
            <button className="icon-button close-button" aria-label="关闭" title="关闭" onClick={() => setComposerOpen(false)}><X size={20} /></button>
            <span className="modal-icon"><MessageSquareText size={24} /></span>
            <span className="eyebrow">PRIVATE MEMBER POST</span>
            <h2 id="composer-title">写进树洞</h2>
            <p>正文会显示给社区成员；你的钱包地址和成员密钥不会随帖子公开。</p>
            <form onSubmit={publishPost}>
              <label htmlFor="post-body">帖子内容</label>
              <textarea id="post-body" autoFocus maxLength={280} value={body} onChange={(event) => setBody(event.target.value)} placeholder="今天想和树屋分享什么？" />
              <div className="form-meta"><span><ShieldCheck size={14} />通过 Aleo 私有凭证验证</span><b>{body.length}/280</b></div>
              <button className="primary-button full-button" disabled={!body.trim() || action.phase === "proving" || action.phase === "submitted"}><Send size={18} />生成证明并发布</button>
            </form>
          </section>
        </div>
      )}

      {privacyOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setPrivacyOpen(false)}>
          <section className="modal privacy-modal" role="dialog" aria-modal="true" aria-labelledby="privacy-title">
            <button className="icon-button close-button" aria-label="关闭" title="关闭" onClick={() => setPrivacyOpen(false)}><X size={20} /></button>
            <span className="modal-icon mint"><ShieldCheck size={25} /></span>
            <span className="eyebrow">ALEO PRIVACY MAP</span>
            <h2 id="privacy-title">你的秘密留在哪里？</h2>
            <div className="privacy-grid">
              <div><span className="status-dot hidden" /><strong>保持隐藏</strong><p>成员钱包地址、成员密钥、私有 Member record。</p></div>
              <div><span className="status-dot public" /><strong>公开验证</strong><p>帖子内容承诺、投票选择、总票数与防重复 nullifier。</p></div>
            </div>
            <p className="privacy-footnote">MVP 采用“身份隐私、选择公开”的设计。任何人能核验结果，但无法从投票记录还原成员身份。</p>
          </section>
        </div>
      )}
    </main>
  );
}
