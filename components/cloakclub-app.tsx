"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useWallet } from "@provablehq/aleo-wallet-adaptor-react";
import {
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Crown,
  Heart,
  KeyRound,
  Languages,
  LockKeyhole,
  MessageSquareText,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  TreePine,
  Users,
  UserPlus,
  Vote,
  X
} from "lucide-react";
import { ALEO_CONFIG, APP_CONFIG, validatePublicConfig } from "@/lib/config";
import { loadChainState } from "@/lib/aleo-api";
import { getRecordPlaintext, shortId, textToField } from "@/lib/aleo";
import { addPostReaction, loadCommunity, loadPosts, loadProposalMetadata, publishVerifiedPost } from "@/lib/supabase";
import type { ActionState, Community, Post, Proposal } from "@/lib/types";
import { PixelTreehouse } from "./pixel-treehouse";
import { WalletButton } from "./wallet-button";
import { useLanguage } from "./language-provider";

const INITIAL_ACTION: ActionState = { phase: "idle", message: "" };
type PendingPost = { body: string; commitment: string; transactionId: string };

function randomField(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let value = 0n;
  for (const byte of bytes) value = value * 256n + BigInt(byte);
  return `${value}field`;
}

function isAleoAddress(value: string): boolean {
  return /^aleo1[023456789acdefghjklmnpqrstuvwxyz]{58}$/.test(value);
}

function relativeTime(value: string, messages: ReturnType<typeof useLanguage>["messages"]): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return messages.justNow;
  if (seconds < 3600) return messages.minutesAgo(Math.floor(seconds / 60));
  if (seconds < 86400) return messages.hoursAgo(Math.floor(seconds / 3600));
  return messages.daysAgo(Math.floor(seconds / 86400));
}

function deadline(value: string | null, messages: ReturnType<typeof useLanguage>["messages"]): string {
  if (!value) return messages.noDeadline;
  const remaining = new Date(value).getTime() - Date.now();
  if (remaining <= 0) return messages.deadlineReached;
  const hours = Math.ceil(remaining / 3_600_000);
  return hours < 24 ? messages.hoursLeft(hours) : messages.daysHoursLeft(Math.floor(hours / 24), hours % 24);
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
  const { locale, messages, setLocale } = useLanguage();
  const { connected, address, wallet, executeTransaction, requestRecords, requestTransactionHistory, transactionStatus } = useWallet();
  const [posts, setPosts] = useState<Post[]>([]);
  const [community, setCommunity] = useState<Community | null>(null);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [communityAdmin, setCommunityAdmin] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [recipientAddress, setRecipientAddress] = useState("");
  const [body, setBody] = useState("");
  const [action, setAction] = useState<ActionState>(INITIAL_ACTION);
  const [votedAddress, setVotedAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [pendingPost, setPendingPost] = useState<PendingPost | null>(null);

  const totalVotes = (proposal?.yes ?? 0) + (proposal?.no ?? 0);
  const yesPercent = totalVotes && proposal ? Math.round((proposal.yes / totalVotes) * 100) : 0;
  const hasVoted = Boolean(address && votedAddress === address);
  const isAdmin = Boolean(address && communityAdmin && address.toLowerCase() === communityAdmin.toLowerCase());

  const refreshData = useCallback(async () => {
    const missing = validatePublicConfig();
    if (missing.length) {
      setLoadError(messages.missingConfig(missing));
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
      setCommunityAdmin(chain.communityAdmin);
      setProposal({ ...proposalMetadata, yes: chain.yes, no: chain.no, isOpen: chain.isOpen });
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : messages.testnetReadFailed);
    } finally {
      setLoading(false);
    }
  }, [messages]);

  useEffect(() => {
    const task = window.setTimeout(() => void refreshData(), 0);
    return () => window.clearTimeout(task);
  }, [refreshData]);

  const identityLabel = useMemo(() => {
    if (connected && address) return shortId(address, 7, 5);
    return messages.notConnected;
  }, [address, connected, messages]);

  async function membershipRecord(): Promise<string> {
    const records = await requestRecords(ALEO_CONFIG.programId, true, "unspent");
    for (const record of records) {
      const plaintext = formatRecord(record);
      if (plaintext?.includes(APP_CONFIG.communityId) && plaintext.includes("member_secret")) {
        return plaintext;
      }
    }
    throw new Error(messages.memberRecordMissing);
  }

  async function submitTransition(functionName: string, inputs: string[]) {
    if (!connected) throw new Error(messages.connectBeforeSubmit);
    // Shield 1.29 expects an integer microcredit fee; Leo expects ALEO credits.
    const fee = wallet?.adapter.name === "Shield Wallet"
      ? Math.round(ALEO_CONFIG.fee * 1_000_000)
      : ALEO_CONFIG.fee;
    let result;
    try {
      result = await executeTransaction({
        program: ALEO_CONFIG.programId,
        function: functionName,
        inputs,
        fee,
        privateFee: false
      });
    } catch (error) {
      if (error instanceof Error && error.message === "Invalid transaction payload") {
        throw new Error(messages.invalidTransactionPayload);
      }
      throw error;
    }
    if (!result?.transactionId) throw new Error(messages.missingTransactionId);
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
        throw new Error(result.error ?? messages.transactionRejected(result.status));
      }
      await new Promise((resolve) => window.setTimeout(resolve, 5000));
    }
    throw new Error(messages.confirmationTimeout);
  }

  async function publishPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanBody = body.trim();
    if (!cleanBody) return;

    setAction({ phase: "proving", message: messages.generatingPostProof });
    let confirmedPost: PendingPost | null = null;
    try {
      const commitment = await textToField(cleanBody);
      const record = await membershipRecord();
      const temporaryId = await submitTransition("publish_post", [record, APP_CONFIG.communityId, commitment]);
      setAction({ phase: "submitted", message: messages.postSubmitted, transactionId: temporaryId });
      const transactionId = await waitForConfirmation(temporaryId);
      const verifiedPost = { body: cleanBody, commitment, transactionId };
      confirmedPost = verifiedPost;
      setPendingPost(verifiedPost);
      setAction({ phase: "submitted", message: messages.savingPost, transactionId });
      await publishVerifiedPost(verifiedPost);
      await refreshData();
      setPendingPost(null);
      setBody("");
      setComposerOpen(false);
      setAction({
        phase: "confirmed",
        message: messages.postConfirmed,
        transactionId
      });
    } catch (error) {
      const recoverablePost = confirmedPost ?? pendingPost;
      setAction({
        phase: "error",
        message: recoverablePost
          ? messages.postRecoverable
          : error instanceof Error ? error.message : messages.postFailed,
        transactionId: recoverablePost?.transactionId
      });
    }
  }

  async function retryPendingPost() {
    if (!pendingPost) return;
    setAction({ phase: "submitted", message: messages.retryingPost, transactionId: pendingPost.transactionId });
    try {
      await publishVerifiedPost(pendingPost);
      await refreshData();
      setPendingPost(null);
      setBody("");
      setComposerOpen(false);
      setAction({
        phase: "confirmed",
        message: messages.postSaved,
        transactionId: pendingPost.transactionId
      });
    } catch (error) {
      setAction({
        phase: "error",
        message: error instanceof Error ? error.message : messages.postSaveFailed,
        transactionId: pendingPost.transactionId
      });
    }
  }

  async function castVote(choice: boolean) {
    if (hasVoted) return;
    if (!proposal?.isOpen) return;
    setAction({ phase: "proving", message: messages.provingMembership });
    try {
      const record = await membershipRecord();
      const temporaryId = await submitTransition("vote", [record, APP_CONFIG.communityId, APP_CONFIG.proposalId, String(choice)]);
      setAction({ phase: "submitted", message: messages.voteSubmitted, transactionId: temporaryId });
      const transactionId = await waitForConfirmation(temporaryId);
      await refreshData();
      setVotedAddress(address);
      setAction({
        phase: "confirmed",
        message: messages.voteConfirmed,
        transactionId
      });
    } catch (error) {
      setAction({ phase: "error", message: error instanceof Error ? error.message : messages.voteFailed });
    }
  }

  async function issueMembership(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const recipient = recipientAddress.trim().toLowerCase();
    if (!isAdmin) {
      setAction({ phase: "error", message: messages.notAdmin });
      return;
    }
    if (!isAleoAddress(recipient)) {
      setAction({ phase: "error", message: messages.invalidAleoAddress });
      return;
    }

    setAction({ phase: "proving", message: messages.creatingCredential });
    try {
      const temporaryId = await submitTransition("issue_membership", [
        APP_CONFIG.communityId,
        recipient,
        randomField()
      ]);
      setAction({ phase: "submitted", message: messages.credentialSubmitted, transactionId: temporaryId });
      const transactionId = await waitForConfirmation(temporaryId);
      await refreshData();
      setRecipientAddress("");
      setAction({
        phase: "confirmed",
        message: messages.credentialIssued(shortId(recipient, 10, 8)),
        transactionId
      });
    } catch (error) {
      setAction({ phase: "error", message: error instanceof Error ? error.message : messages.credentialFailed });
    }
  }

  async function addReaction(id: string) {
    try {
      await addPostReaction(id);
      await refreshData();
    } catch (error) {
      setAction({ phase: "error", message: error instanceof Error ? error.message : messages.reactionFailed });
    }
  }

  if (loading) return <div className="loading-screen">{messages.syncing}</div>;
  if (loadError || !community || !proposal) return (
    <div className="loading-screen">
      <div><strong>{messages.loadFailed}</strong><p>{loadError || messages.dataNotInitialized}</p><button onClick={() => { setLoading(true); void refreshData(); }}><RefreshCw size={16} />{messages.reload}</button></div>
    </div>
  );

  return (
    <main className="site-shell">
      <header className="topbar">
        <div className="header-identity">
          <a className="brand" href="#top" aria-label={messages.backToTop}>
            <span className="brand-mark"><KeyRound size={19} /></span>
            <span>CLOAK<span>CLUB</span></span>
          </a>
          <span className="header-divider" aria-hidden="true" />
          <div className="workspace-context">
            <TreePine size={17} />
            <span><small>{messages.currentTreehouse}</small><strong>{messages.communityName}</strong></span>
          </div>
        </div>
        <div className="header-tools">
          <div className="network-status" title={`${ALEO_CONFIG.programId} · ${messages.chainSynced}`}>
            <i aria-hidden="true" />
            <span>{messages.aleoTestnet}</span>
          </div>
          <div className="language-switch" role="group" aria-label={messages.language}>
            <Languages size={15} aria-hidden="true" />
            <button type="button" className={locale === "en" ? "active" : ""} onClick={() => setLocale("en")} aria-pressed={locale === "en"} title={messages.english}>EN</button>
            <button type="button" className={locale === "zh" ? "active" : ""} onClick={() => setLocale("zh")} aria-pressed={locale === "zh"} title={messages.chinese}>中文</button>
          </div>
          <button className="header-refresh" type="button" onClick={() => void refreshData()} title={messages.refreshChainData} aria-label={messages.refreshChainData}>
            <RefreshCw size={17} />
          </button>
          <div className="wallet-wrap"><WalletButton /></div>
        </div>
      </header>

      <div className="dashboard" id="top">
        <aside className="left-rail">
          <section className="club-intro">
            <PixelTreehouse />
            <div className="club-title-row">
              <span className="club-icon"><TreePine size={20} /></span>
              <div><p>{messages.welcomeBack}</p><h1>{messages.communityName}</h1></div>
            </div>
            <p className="club-copy">{messages.communityDescription}</p>
            <div className="member-stats">
              <span><Users size={16} />{messages.memberCredentials(memberCount)}</span>
              <span><Sparkles size={16} />{messages.reactions(posts.reduce((total, post) => total + post.reactions, 0))}</span>
            </div>
          </section>

          <section className="identity-panel">
            <div className="panel-label"><ShieldCheck size={16} />{messages.privacyIdentity}</div>
            <div className="identity-row">
              <span className="pixel-avatar" aria-hidden="true"><i /><b /></span>
              <div><strong>{identityLabel}</strong><span>{connected ? messages.testnetWalletConnected : messages.connectToCheckCredential}</span></div>
              {connected && <Check className="verified-check" size={17} />}
            </div>
            <div className="privacy-meter"><i /><i /><i /><i /><i /></div>
            <div className="privacy-score"><span>{messages.network}</span><strong>TESTNET</strong></div>
            <button className="text-button" onClick={() => setPrivacyOpen(true)}>{messages.protectionDetails} <ChevronRight size={15} /></button>
            {isAdmin && <button className="admin-entry" onClick={() => setAdminOpen(true)}><Crown size={15} />{messages.memberManagement}<ChevronRight size={15} /></button>}
          </section>
        </aside>

        <section className="feed-column">
          <div className="feed-heading">
            <div><span className="eyebrow">{messages.membersOnly}</span><h2>{messages.feed}</h2></div>
            <button className="primary-button" onClick={() => setComposerOpen(true)}><Plus size={18} />{messages.writeAnonymousPost}</button>
          </div>

          <button className="composer-trigger" onClick={() => setComposerOpen(true)}>
            <span className="tiny-mask"><LockKeyhole size={17} /></span>
            <span>{messages.composerPrompt}</span>
            <Send size={18} />
          </button>

          <div className="privacy-note"><ShieldCheck size={15} /><span>{messages.postPrivacyNote}</span></div>

          <div className="post-list">
            {posts.map((post, index) => (
              <article className="post-card" key={post.id} style={{ "--delay": `${index * 60}ms` } as React.CSSProperties}>
                <div className="post-meta">
                  <span className={`anon-avatar avatar-${(index % 3) + 1}`} aria-hidden="true"><i /></span>
                  <div><strong>{messages.verifiedMember}</strong><span><Clock3 size={13} />{relativeTime(post.createdAt, messages)}</span></div>
                </div>
                <p>{post.body}</p>
                <footer>
                  <button aria-label={messages.sendHeart} title={messages.sendHeart} onClick={() => void addReaction(post.id)}><Heart size={17} />{post.reactions}</button>
                  <span><LockKeyhole size={13} />{messages.commitment} {post.commitment}</span>
                </footer>
              </article>
            ))}
            {posts.length === 0 && <div className="privacy-note"><MessageSquareText size={15} /><span>{messages.noPosts}</span></div>}
          </div>
        </section>

        <aside className="right-rail">
          <section className="proposal-board">
            <div className="board-pin pin-left" /><div className="board-pin pin-right" />
            <div className="proposal-kicker"><Vote size={17} />{messages.votingNow}</div>
            <h2>{messages.proposalTitle}</h2>
            <p>{messages.proposalDescription}</p>
            <div className="deadline"><Clock3 size={15} />{deadline(proposal.endsAt, messages)}</div>

            <div className="vote-results">
              <div className="result-label"><span>{messages.proposalYesLabel}</span><strong>{messages.votes(proposal.yes)}</strong></div>
              <div className="result-track"><i style={{ width: `${yesPercent}%` }} /></div>
              <div className="result-label"><span>{messages.proposalNoLabel}</span><strong>{messages.votes(proposal.no)}</strong></div>
              <div className="result-track coral"><i style={{ width: `${100 - yesPercent}%` }} /></div>
            </div>

            <div className="vote-actions">
              <button disabled={hasVoted || !proposal.isOpen || action.phase === "proving" || action.phase === "submitted"} onClick={() => castVote(true)}>{messages.proposalYesLabel}</button>
              <button className="coral-button" disabled={hasVoted || !proposal.isOpen || action.phase === "proving" || action.phase === "submitted"} onClick={() => castVote(false)}>{messages.proposalNoLabel}</button>
            </div>
            {hasVoted && <div className="voted-message"><Check size={16} />{messages.alreadyVoted}</div>}
          </section>

          <section className="chain-card">
            <div className="chain-card-title"><span className="aleo-dot">A</span><div><strong>{messages.privacyLayer}</strong><span>{ALEO_CONFIG.programId}</span></div></div>
            <ul>
              <li><Check size={14} />{messages.credentialPrivate}</li>
              <li><Check size={14} />{messages.nullifierStopsDuplicates}</li>
              <li><Check size={14} />{messages.resultsHideAddresses}</li>
            </ul>
            <button className="text-button" onClick={() => setPrivacyOpen(true)}>{messages.howItWorks} <CircleHelp size={15} /></button>
          </section>
        </aside>
      </div>

      {action.phase !== "idle" && (
        <div className={`toast toast-${action.phase}`} role="status">
          <span className="toast-icon">{action.phase === "proving" ? <span className="loader" /> : action.phase === "error" ? <X size={18} /> : <Check size={18} />}</span>
          <div><strong>{action.phase === "proving" ? messages.proving : action.phase === "error" ? messages.actionFailed : action.phase === "confirmed" ? messages.confirmedOnchain : messages.submitted}</strong><p>{action.message}</p>{action.transactionId && <a href={`${ALEO_CONFIG.explorerUrl}/transaction/${action.transactionId}`} target="_blank" rel="noreferrer"><code>{shortId(action.transactionId, 12, 8)}</code></a>}{pendingPost && action.phase === "error" && <button className="toast-retry" type="button" onClick={() => void retryPendingPost()}><RefreshCw size={14} />{messages.retrySavingPost}</button>}</div>
          <button aria-label={messages.closeNotification} title={messages.close} onClick={() => setAction(INITIAL_ACTION)}><X size={17} /></button>
        </div>
      )}

      {composerOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setComposerOpen(false)}>
          <section className="modal composer-modal" role="dialog" aria-modal="true" aria-labelledby="composer-title">
            <button className="icon-button close-button" aria-label={messages.close} title={messages.close} onClick={() => setComposerOpen(false)}><X size={20} /></button>
            <span className="modal-icon"><MessageSquareText size={24} /></span>
            <span className="eyebrow">{messages.privateMemberPost}</span>
            <h2 id="composer-title">{messages.composerTitle}</h2>
            <p>{messages.composerDescription}</p>
            <form onSubmit={publishPost}>
              <label htmlFor="post-body">{messages.postContent}</label>
              <textarea id="post-body" autoFocus maxLength={280} value={body} onChange={(event) => setBody(event.target.value)} placeholder={messages.postPlaceholder} />
              <div className="form-meta"><span><ShieldCheck size={14} />{messages.verifiedWithCredential}</span><b>{body.length}/280</b></div>
              <button className="primary-button full-button" disabled={!body.trim() || Boolean(pendingPost) || action.phase === "proving" || action.phase === "submitted"}><Send size={18} />{messages.proveAndPublish}</button>
            </form>
          </section>
        </div>
      )}

      {privacyOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setPrivacyOpen(false)}>
          <section className="modal privacy-modal" role="dialog" aria-modal="true" aria-labelledby="privacy-title">
            <button className="icon-button close-button" aria-label={messages.close} title={messages.close} onClick={() => setPrivacyOpen(false)}><X size={20} /></button>
            <span className="modal-icon mint"><ShieldCheck size={25} /></span>
            <span className="eyebrow">{messages.privacyMap}</span>
            <h2 id="privacy-title">{messages.privacyTitle}</h2>
            <div className="privacy-grid">
              <div><span className="status-dot hidden" /><strong>{messages.staysHidden}</strong><p>{messages.hiddenDetails}</p></div>
              <div><span className="status-dot public" /><strong>{messages.publiclyVerified}</strong><p>{messages.publicDetails}</p></div>
            </div>
            <p className="privacy-footnote">{messages.privacyFootnote}</p>
          </section>
        </div>
      )}

      {adminOpen && isAdmin && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setAdminOpen(false)}>
          <section className="modal admin-modal" role="dialog" aria-modal="true" aria-labelledby="admin-title">
            <button className="icon-button close-button" aria-label={messages.close} title={messages.close} onClick={() => setAdminOpen(false)}><X size={20} /></button>
            <span className="modal-icon mint"><Crown size={24} /></span>
            <span className="eyebrow">{messages.onchainAdmin}</span>
            <h2 id="admin-title">{messages.adminTitle}</h2>
            <div className="admin-summary">
              <div><span>{messages.adminAddress}</span><code>{shortId(communityAdmin ?? "", 12, 10)}</code></div>
              <div><span>{messages.credentialsIssued}</span><strong>{memberCount}</strong></div>
            </div>
            <form onSubmit={issueMembership}>
              <label htmlFor="member-address">{messages.memberAleoAddress}</label>
              <input
                id="member-address"
                autoComplete="off"
                spellCheck={false}
                value={recipientAddress}
                onChange={(event) => setRecipientAddress(event.target.value)}
                placeholder="aleo1..."
              />
              <div className="form-meta"><span><ShieldCheck size={14} />{messages.privateMemberRecord}</span><b>{recipientAddress.trim().length}/63</b></div>
              <button className="primary-button full-button" disabled={!isAleoAddress(recipientAddress.trim().toLowerCase()) || action.phase === "proving" || action.phase === "submitted"}>
                <UserPlus size={18} />{messages.issueCredential}
              </button>
            </form>
            <p className="admin-footnote">{messages.adminFootnote}</p>
          </section>
        </div>
      )}
    </main>
  );
}
