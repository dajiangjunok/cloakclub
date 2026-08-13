import { ALEO_CONFIG, APP_CONFIG } from "./config";

function apiPath(path: string): string {
  return `${ALEO_CONFIG.apiUrl.replace(/\/$/, "")}/${ALEO_CONFIG.network}/${path}`;
}

export async function getMappingValue(mapping: string, key: string): Promise<string | null> {
  const response = await fetch(
    apiPath(`program/${encodeURIComponent(ALEO_CONFIG.programId)}/mapping/${mapping}/${encodeURIComponent(key)}`),
    { cache: "no-store" }
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`读取 Aleo mapping ${mapping} 失败 (${response.status})`);
  return (await response.json()) as string;
}

function parseU64(value: string | null): number {
  if (!value) return 0;
  const parsed = Number(value.replace(/u64$/, "").replaceAll('"', ""));
  return Number.isSafeInteger(parsed) ? parsed : 0;
}

function parseBool(value: string | null): boolean {
  return value?.replaceAll('"', "") === "true";
}

function parseString(value: string | null): string | null {
  return value?.replaceAll('"', "") || null;
}

export async function loadChainState() {
  const [yes, no, isOpen, memberCount, communityAdmin] = await Promise.all([
    getMappingValue("yes_votes", APP_CONFIG.proposalId),
    getMappingValue("no_votes", APP_CONFIG.proposalId),
    getMappingValue("proposal_open", APP_CONFIG.proposalId),
    getMappingValue("member_count", APP_CONFIG.communityId),
    getMappingValue("community_admin", APP_CONFIG.communityId)
  ]);
  return {
    yes: parseU64(yes),
    no: parseU64(no),
    isOpen: parseBool(isOpen),
    memberCount: parseU64(memberCount),
    communityAdmin: parseString(communityAdmin)
  };
}
