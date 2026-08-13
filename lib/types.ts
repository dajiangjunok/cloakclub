export type Post = {
  id: string;
  body: string;
  commitment: string;
  createdAt: string;
  reactions: number;
  transactionId: string;
};

export type Community = {
  id: string;
  name: string;
  description: string;
};

export type Proposal = {
  id: string;
  title: string;
  description: string;
  yesLabel: string;
  noLabel: string;
  yes: number;
  no: number;
  endsAt: string | null;
  isOpen: boolean;
};

export type ActionState = {
  phase: "idle" | "proving" | "submitted" | "confirmed" | "error";
  message: string;
  transactionId?: string;
};
