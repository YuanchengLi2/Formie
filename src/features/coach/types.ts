export type CoachGrounding = {
  scope: "whole_set" | "focused_window" | "insufficient";
  startMs: number | null;
  endMs: number | null;
  citations: { timeMs: number; label: string }[];
};

export type CoachMessage = {
  id: string;
  threadId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  grounding?: CoachGrounding | null;
};

export type CoachThread = {
  id: string;
  userId: string;
  sessionId: string;
  title: string | null;
  targetIntent: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CoachConversation = { thread: CoachThread | null; messages: CoachMessage[] };

export type CoachEvidenceAttachment = {
  findingId: string;
  peakMs: number;
  title: string;
  repNumber: number | null;
  phase: string | null;
};
