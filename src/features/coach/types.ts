export type CoachMessage = {
  id: string;
  threadId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type CoachThread = {
  id: string;
  userId: string;
  sessionId: string;
  targetIntent: string | null;
};

export type CoachConversation = { thread: CoachThread | null; messages: CoachMessage[] };
