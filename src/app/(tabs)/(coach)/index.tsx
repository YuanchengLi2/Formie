import { useCallback } from "react";
import { useLocalSearchParams } from "expo-router";

import { getAccessToken } from "@/features/auth/access-token";
import { getCoachConversation, sendCoachMessage } from "@/features/coach/api";
import { useAnalysisHistory } from "@/features/progress/use-analysis-history";
import { CoachScreen } from "@/screens/coach";

export default function CoachRoute() {
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();
  const history = useAnalysisHistory();
  const loadConversation = useCallback(async (selectedSessionId: string) => getCoachConversation({ accessToken: await getAccessToken(), sessionId: selectedSessionId }), []);
  const sendMessage = useCallback(async (input: { sessionId: string; message: string; targetIntent?: string }) => sendCoachMessage({ accessToken: await getAccessToken(), ...input }), []);
  return <CoachScreen videos={(history.data ?? []).filter((item) => item.status === "complete" || item.status === "partial")} initialSessionId={typeof sessionId === "string" ? sessionId : null} loadConversation={loadConversation} sendMessage={sendMessage} />;
}
