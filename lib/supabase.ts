import { createClient } from "@supabase/supabase-js";
import { APP_CONFIG } from "./config";
import type { Community, Post, Proposal } from "./types";

type CommunityRow = {
  community_id: string;
  name: string;
  description: string;
};

type ProposalRow = {
  proposal_id: string;
  title: string;
  description: string;
  yes_label: string;
  no_label: string;
  ends_at: string | null;
};

type PostRow = {
  id: string;
  body: string;
  commitment: string;
  transaction_id: string;
  reaction_count: number;
  created_at: string;
};

function client() {
  return createClient(APP_CONFIG.supabaseUrl, APP_CONFIG.supabaseAnonKey);
}

export async function loadCommunity(): Promise<Community> {
  const { data, error } = await client()
    .from("communities")
    .select("community_id,name,description")
    .eq("community_id", APP_CONFIG.communityId)
    .single<CommunityRow>();
  if (error) throw error;
  return { id: data.community_id, name: data.name, description: data.description };
}

export async function loadProposalMetadata(): Promise<Omit<Proposal, "yes" | "no" | "isOpen">> {
  const { data, error } = await client()
    .from("proposals")
    .select("proposal_id,title,description,yes_label,no_label,ends_at")
    .eq("proposal_id", APP_CONFIG.proposalId)
    .eq("community_id", APP_CONFIG.communityId)
    .single<ProposalRow>();
  if (error) throw error;
  return {
    id: data.proposal_id,
    title: data.title,
    description: data.description,
    yesLabel: data.yes_label,
    noLabel: data.no_label,
    endsAt: data.ends_at
  };
}

export async function loadPosts(): Promise<Post[]> {
  const { data, error } = await client()
    .from("posts")
    .select("id,body,commitment,transaction_id,reaction_count,created_at")
    .eq("community_id", APP_CONFIG.communityId)
    .order("created_at", { ascending: false })
    .returns<PostRow[]>();
  if (error) throw error;
  return (data ?? []).map((post) => ({
    id: post.id,
    body: post.body,
    commitment: post.commitment,
    transactionId: post.transaction_id,
    reactions: post.reaction_count,
    createdAt: post.created_at
  }));
}

export async function publishVerifiedPost(payload: {
  body: string;
  commitment: string;
  transactionId: string;
}): Promise<void> {
  const { error } = await client().functions.invoke("verify-post", {
    body: { ...payload, communityId: APP_CONFIG.communityId }
  });
  if (error) throw error;
}

export async function addPostReaction(postId: string): Promise<void> {
  const { error } = await client().rpc("add_post_reaction", { target_post_id: postId });
  if (error) throw error;
}
