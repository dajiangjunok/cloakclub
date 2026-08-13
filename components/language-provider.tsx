"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";

export type Locale = "en" | "zh";

const english = {
  justNow: "Just now",
  minutesAgo: (count: number) => `${count} min ago`,
  hoursAgo: (count: number) => `${count} hr ago`,
  daysAgo: (count: number) => `${count} day${count === 1 ? "" : "s"} ago`,
  noDeadline: "No deadline set",
  deadlineReached: "Deadline reached",
  hoursLeft: (count: number) => `${count} hr left`,
  daysHoursLeft: (days: number, hours: number) => `${days}d ${hours}h left`,
  missingConfig: (names: string[]) => `Missing environment configuration: ${names.join(", ")}`,
  testnetReadFailed: "Unable to read testnet data",
  notConnected: "Not connected",
  memberRecordMissing: "No unspent Member credential for this community was found in your wallet. Ask an admin to issue one first.",
  connectBeforeSubmit: "Connect Shield or Leo Wallet before submitting to the Aleo testnet.",
  invalidTransactionPayload: "The wallet rejected the transaction parameters. Update Shield to a compatible version and reconnect.",
  missingTransactionId: "The wallet did not return a transaction ID. Check the signature request.",
  transactionRejected: (status: string) => `The testnet did not accept the transaction: ${status}`,
  confirmationTimeout: "Confirmation timed out. The transaction may still be processing; refresh the page later.",
  generatingPostProof: "Generating a zero-knowledge proof. Confirm it in your wallet...",
  postSubmitted: "Transaction submitted. Waiting for Aleo testnet confirmation...",
  savingPost: "Onchain transaction confirmed. Saving the public post body...",
  postConfirmed: "The post transaction is confirmed on testnet, and its public body passed the onchain commitment check.",
  postRecoverable: "The onchain publish succeeded, but the post body was not saved. Do not create another transaction. Deploy verify-post, then select Retry saving post.",
  postFailed: "Publishing failed. Try again.",
  retryingPost: "Rechecking the onchain transaction and saving the post body...",
  postSaved: "The post body was verified against the onchain transaction and saved.",
  postSaveFailed: "Could not save the post body. Try again later.",
  provingMembership: "Proving membership. Confirm it in your wallet...",
  voteSubmitted: "Vote submitted. Waiting for Aleo testnet confirmation...",
  voteConfirmed: "The vote is confirmed on testnet. Totals come from the Aleo mapping.",
  voteFailed: "Voting failed. Try again.",
  notAdmin: "The connected wallet is not this community's onchain admin.",
  invalidAleoAddress: "Enter a valid Aleo address.",
  creatingCredential: "Creating a private member credential. Confirm it in your wallet...",
  credentialSubmitted: "Member credential submitted. Waiting for testnet confirmation...",
  credentialIssued: (address: string) => `Private member credential issued to ${address}.`,
  credentialFailed: "Could not issue the member credential.",
  reactionFailed: "Could not add the reaction.",
  syncing: "Syncing with Aleo testnet...",
  loadFailed: "Unable to load live data",
  dataNotInitialized: "The community or proposal has not been initialized",
  reload: "Reload",
  backToTop: "Back to the top of CloakClub",
  currentTreehouse: "Current treehouse",
  chainSynced: "Onchain state synced",
  aleoTestnet: "Aleo testnet",
  refreshChainData: "Refresh onchain data",
  language: "Language",
  english: "English",
  chinese: "Chinese",
  communityName: "CloakClub Treehouse",
  communityDescription: "A private community for Aleo creators and developers. Members can join discussions and governance with private credentials, without revealing their wallet identity.",
  proposalTitle: "Which theme should we choose for our first member co-creation night?",
  proposalDescription: "Members anonymously choose the theme for CloakClub Treehouse No. 4's first co-creation event. Voting results are public while member identities remain hidden.",
  proposalYesLabel: "Leo Privacy App Workshop",
  proposalNoLabel: "Aleo Governance Design Roundtable",
  welcomeBack: "Welcome back",
  memberCredentials: (count: number) => `${count} member credential${count === 1 ? "" : "s"}`,
  reactions: (count: number) => `${count} reaction${count === 1 ? "" : "s"}`,
  privacyIdentity: "My private identity",
  testnetWalletConnected: "Testnet wallet connected",
  connectToCheckCredential: "Connect to check your credential",
  network: "Network",
  protectionDetails: "View protection details",
  memberManagement: "Manage members",
  membersOnly: "MEMBERS ONLY",
  feed: "Treehouse feed",
  writeAnonymousPost: "Write anonymously",
  composerPrompt: "Share a thought without revealing who you are...",
  postPrivacyNote: "Posting verifies only your member credential. The chain stores a content commitment, never your wallet address.",
  verifiedMember: "Verified member",
  sendHeart: "Send a heart",
  commitment: "Commitment",
  noPosts: "No confirmed posts on testnet yet.",
  votingNow: "VOTING NOW",
  votes: (count: number) => `${count} vote${count === 1 ? "" : "s"}`,
  alreadyVoted: "You have already voted anonymously",
  privacyLayer: "Aleo privacy layer",
  credentialPrivate: "Member credentials stay in private records",
  nullifierStopsDuplicates: "A nullifier prevents duplicate voting",
  resultsHideAddresses: "Public results contain no member addresses",
  howItWorks: "How does it work?",
  proving: "Generating proof",
  actionFailed: "Action incomplete",
  confirmedOnchain: "Confirmed onchain",
  submitted: "Action submitted",
  retrySavingPost: "Retry saving post",
  closeNotification: "Close notification",
  close: "Close",
  privateMemberPost: "PRIVATE MEMBER POST",
  composerTitle: "Post to the treehouse",
  composerDescription: "The post body is visible to community members. Your wallet address and member secret are never published with it.",
  postContent: "Post content",
  postPlaceholder: "What would you like to share with the treehouse today?",
  verifiedWithCredential: "Verified with a private Aleo credential",
  proveAndPublish: "Generate proof and publish",
  privacyMap: "ALEO PRIVACY MAP",
  privacyTitle: "Where do your secrets stay?",
  staysHidden: "Stays hidden",
  hiddenDetails: "Member wallet address, member secret, and private Member record.",
  publiclyVerified: "Publicly verified",
  publicDetails: "Post commitments, vote choices, totals, and duplicate-prevention nullifiers.",
  privacyFootnote: "This MVP keeps identities private while choices are public. Anyone can verify the result, but no one can recover a member's identity from a vote.",
  onchainAdmin: "ONCHAIN ADMIN",
  adminTitle: "Member management",
  adminAddress: "Onchain admin",
  credentialsIssued: "Credentials issued",
  memberAleoAddress: "Member Aleo address",
  privateMemberRecord: "TESTNET · Private Member record",
  issueCredential: "Issue member credential",
  adminFootnote: "The contract exposes only the number of issued credentials, never member addresses. Issuing again to the same address creates a separate credential.",
  connectionInProgress: "A connection request is already pending in your wallet. Open the extension to complete or cancel it. If no prompt appears, reload the extension and this page.",
  connectionCancelled: "You cancelled the wallet connection.",
  connectionFailed: "Wallet connection failed. Check the extension and try again.",
  extensionUnavailable: (name: string) => `${name} is not installed or was not detected by your browser.`,
  disconnectFailed: "Could not disconnect the wallet. Try again.",
  connecting: "Connecting...",
  disconnecting: "Disconnecting...",
  connectWallet: (name: string) => `Connect ${name}`,
  selectWallet: "Select wallet",
  changeWallet: "Change wallet",
  walletDialog: "Aleo wallet",
  walletAccount: "Wallet account",
  selectAleoWallet: "Select Aleo wallet",
  closeWalletMenu: "Close wallet menu",
  disconnect: "Disconnect",
  detected: "Detected",
  notInstalled: "Not installed"
};

type Messages = {
  [Key in keyof typeof english]: typeof english[Key] extends (...args: infer Args) => string
    ? (...args: Args) => string
    : string;
};

const chinese: Messages = {
  justNow: "刚刚",
  minutesAgo: (count) => `${count} 分钟前`,
  hoursAgo: (count) => `${count} 小时前`,
  daysAgo: (count) => `${count} 天前`,
  noDeadline: "未设置截止时间",
  deadlineReached: "已到截止时间",
  hoursLeft: (count) => `还剩 ${count} 小时`,
  daysHoursLeft: (days, hours) => `还剩 ${days} 天 ${hours} 小时`,
  missingConfig: (names) => `缺少环境配置：${names.join("、")}`,
  testnetReadFailed: "无法读取测试网数据",
  notConnected: "尚未连接",
  memberRecordMissing: "钱包中没有找到该社区的未消费 Member 凭证，请先让管理员发放凭证。",
  connectBeforeSubmit: "请先连接 Shield 或 Leo Wallet，再提交到 Aleo 测试网。",
  invalidTransactionPayload: "钱包拒绝了交易参数，请确认 Shield 已更新到兼容版本并重新连接。",
  missingTransactionId: "钱包没有返回交易 ID，请检查签名请求。",
  transactionRejected: (status) => `交易未被测试网接受：${status}`,
  confirmationTimeout: "等待链上确认超时。交易可能仍在处理中，请稍后刷新页面。",
  generatingPostProof: "正在生成零知识证明，请在钱包中确认...",
  postSubmitted: "交易已提交，正在等待 Aleo 测试网确认...",
  savingPost: "链上交易已确认，正在保存公开正文...",
  postConfirmed: "帖子交易已在测试网确认，公开正文已通过链上 commitment 校验。",
  postRecoverable: "链上发布已成功，但正文尚未保存。请勿再次生成链上交易，部署 verify-post 后点击“重试保存正文”。",
  postFailed: "发布失败，请重试。",
  retryingPost: "正在重新验证链上交易并保存正文...",
  postSaved: "正文已通过链上交易验证并保存。",
  postSaveFailed: "保存正文失败，请稍后重试。",
  provingMembership: "正在证明成员资格，请在钱包中确认...",
  voteSubmitted: "投票已提交，正在等待 Aleo 测试网确认...",
  voteConfirmed: "投票已在测试网确认，票数来自 Aleo mapping。",
  voteFailed: "投票失败，请重试。",
  notAdmin: "当前钱包不是该社区的链上管理员。",
  invalidAleoAddress: "请输入有效的 Aleo 地址。",
  creatingCredential: "正在创建私有成员凭证，请在钱包中确认...",
  credentialSubmitted: "成员凭证已提交，正在等待测试网确认...",
  credentialIssued: (address) => `已向 ${address} 签发私有成员凭证。`,
  credentialFailed: "成员凭证签发失败。",
  reactionFailed: "回应失败",
  syncing: "正在同步 Aleo 测试网...",
  loadFailed: "无法加载真实数据",
  dataNotInitialized: "社区或提案尚未初始化",
  reload: "重新加载",
  backToTop: "返回 CloakClub 页面顶部",
  currentTreehouse: "当前树屋",
  chainSynced: "链上状态已同步",
  aleoTestnet: "Aleo 测试网",
  refreshChainData: "刷新链上数据",
  language: "语言",
  english: "英文",
  chinese: "中文",
  communityName: "CloakClub 四号树屋",
  communityDescription: "面向 Aleo 创作者与开发者的隐私社区。成员可以使用私有凭证参与讨论和治理，而无需公开钱包身份。",
  proposalTitle: "首场成员共创夜选择哪个主题？",
  proposalDescription: "由成员匿名选择 CloakClub 四号树屋的首场共创活动。投票结果公开，成员身份保持隐藏。",
  proposalYesLabel: "Leo 隐私应用工作坊",
  proposalNoLabel: "Aleo 治理设计圆桌",
  welcomeBack: "欢迎回到",
  memberCredentials: (count) => `${count} 份成员凭证`,
  reactions: (count) => `${count} 次回应`,
  privacyIdentity: "我的隐私身份",
  testnetWalletConnected: "已连接测试网钱包",
  connectToCheckCredential: "连接后检查成员凭证",
  network: "网络",
  protectionDetails: "查看保护详情",
  memberManagement: "成员管理",
  membersOnly: "仅限成员",
  feed: "树洞动态",
  writeAnonymousPost: "写匿名帖",
  composerPrompt: "分享一个想法，不留下身份...",
  postPrivacyNote: "发帖时仅验证成员凭证，链上保存内容承诺，不公开钱包地址。",
  verifiedMember: "已验证成员",
  sendHeart: "送出爱心",
  commitment: "承诺",
  noPosts: "测试网上还没有已确认的帖子。",
  votingNow: "正在投票",
  votes: (count) => `${count} 票`,
  alreadyVoted: "你已经匿名投过票了",
  privacyLayer: "Aleo 隐私层",
  credentialPrivate: "成员凭证保存在私有 record",
  nullifierStopsDuplicates: "nullifier 阻止重复投票",
  resultsHideAddresses: "公开结果不包含成员地址",
  howItWorks: "它是怎么工作的？",
  proving: "生成证明",
  actionFailed: "操作未完成",
  confirmedOnchain: "链上已确认",
  submitted: "操作已提交",
  retrySavingPost: "重试保存正文",
  closeNotification: "关闭通知",
  close: "关闭",
  privateMemberPost: "私密成员帖子",
  composerTitle: "写进树洞",
  composerDescription: "正文会显示给社区成员；你的钱包地址和成员密钥不会随帖子公开。",
  postContent: "帖子内容",
  postPlaceholder: "今天想和树屋分享什么？",
  verifiedWithCredential: "通过 Aleo 私有凭证验证",
  proveAndPublish: "生成证明并发布",
  privacyMap: "ALEO 隐私图谱",
  privacyTitle: "你的秘密留在哪里？",
  staysHidden: "保持隐藏",
  hiddenDetails: "成员钱包地址、成员密钥、私有 Member record。",
  publiclyVerified: "公开验证",
  publicDetails: "帖子内容承诺、投票选择、总票数与防重复 nullifier。",
  privacyFootnote: "MVP 采用“身份隐私、选择公开”的设计。任何人能核验结果，但无法从投票记录还原成员身份。",
  onchainAdmin: "链上管理员",
  adminTitle: "成员管理",
  adminAddress: "链上管理员",
  credentialsIssued: "已发行凭证",
  memberAleoAddress: "成员 Aleo 地址",
  privateMemberRecord: "TESTNET · 私有 Member record",
  issueCredential: "签发成员凭证",
  adminFootnote: "当前合约仅公开凭证发行总数，不公开成员地址。重复地址会收到另一份独立凭证。",
  connectionInProgress: "钱包中已有未完成的连接请求。请打开钱包扩展完成或取消；若没有弹窗，请重载扩展和本页面后再试。",
  connectionCancelled: "你已取消钱包连接。",
  connectionFailed: "钱包连接失败，请检查扩展后重试。",
  extensionUnavailable: (name) => `${name} 扩展尚未安装或未被浏览器检测到。`,
  disconnectFailed: "断开钱包失败，请重试。",
  connecting: "连接中...",
  disconnecting: "断开中...",
  connectWallet: (name) => `连接 ${name}`,
  selectWallet: "选择钱包",
  changeWallet: "更换钱包",
  walletDialog: "Aleo 钱包",
  walletAccount: "钱包账户",
  selectAleoWallet: "选择 Aleo 钱包",
  closeWalletMenu: "关闭钱包菜单",
  disconnect: "断开连接",
  detected: "已检测到",
  notInstalled: "未安装"
};

const dictionaries: Record<Locale, Messages> = { en: english, zh: chinese };

type LanguageContextValue = {
  locale: Locale;
  messages: Messages;
  setLocale: (locale: Locale) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

const LOCALE_STORAGE_KEY = "cloakclub-locale";
const LOCALE_CHANGE_EVENT = "cloakclub-locale-change";

function getLocaleSnapshot(): Locale {
  const savedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  return savedLocale === "zh" ? "zh" : "en";
}

function subscribeToLocale(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(LOCALE_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(LOCALE_CHANGE_EVENT, onStoreChange);
  };
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore<Locale>(subscribeToLocale, getLocaleSnapshot, () => "en");

  useEffect(() => {
    document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    window.dispatchEvent(new Event(LOCALE_CHANGE_EVENT));
  }, []);

  const value = useMemo(() => ({ locale, messages: dictionaries[locale], setLocale }), [locale, setLocale]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
