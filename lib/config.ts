function requiredPublicEnv(name: string, value: string | undefined): string {
  void name;
  return value ?? "";
}

export const ALEO_CONFIG = {
  network: "testnet" as const,
  programId: requiredPublicEnv(
    "NEXT_PUBLIC_ALEO_PROGRAM_ID",
    process.env.NEXT_PUBLIC_ALEO_PROGRAM_ID
  ),
  apiUrl:
    process.env.NEXT_PUBLIC_ALEO_API_URL ??
    "https://api.explorer.provable.com/v1",
  explorerUrl:
    process.env.NEXT_PUBLIC_ALEO_EXPLORER_URL ??
    "https://testnet.aleo.info",
  fee: Number(process.env.NEXT_PUBLIC_ALEO_TX_FEE ?? "0.1")
} as const;

export const APP_CONFIG = {
  communityId: requiredPublicEnv(
    "NEXT_PUBLIC_COMMUNITY_ID",
    process.env.NEXT_PUBLIC_COMMUNITY_ID
  ),
  proposalId: requiredPublicEnv(
    "NEXT_PUBLIC_PROPOSAL_ID",
    process.env.NEXT_PUBLIC_PROPOSAL_ID
  ),
  supabaseUrl: requiredPublicEnv(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL
  ),
  supabaseAnonKey: requiredPublicEnv(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )
} as const;

export function validatePublicConfig(): string[] {
  const missing: string[] = [];
  if (!ALEO_CONFIG.programId) missing.push("NEXT_PUBLIC_ALEO_PROGRAM_ID");
  if (!APP_CONFIG.communityId) missing.push("NEXT_PUBLIC_COMMUNITY_ID");
  if (!APP_CONFIG.proposalId) missing.push("NEXT_PUBLIC_PROPOSAL_ID");
  if (!APP_CONFIG.supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!APP_CONFIG.supabaseAnonKey) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!Number.isFinite(ALEO_CONFIG.fee) || ALEO_CONFIG.fee <= 0) {
    missing.push("NEXT_PUBLIC_ALEO_TX_FEE (必须是正数)");
  }
  return missing;
}
