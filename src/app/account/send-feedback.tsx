import { useRef } from "react";
import { useRouter } from "expo-router";

import { getAccessToken } from "@/features/auth/access-token";
import { sendFeedback } from "@/features/feedback/api";
import { getFeedbackDiagnostics } from "@/features/feedback/diagnostics";
import { FeedbackScreen } from "@/screens/feedback";

function createRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") return globalThis.crypto.randomUUID();
  return `feedback-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export default function SendFeedbackRoute() {
  const router = useRouter();
  const requestId = useRef(createRequestId());
  return (
    <FeedbackScreen
      onBack={() => router.back()}
      onSubmit={async ({ category, message }) => {
        const response = await sendFeedback({
          accessToken: await getAccessToken(),
          clientRequestId: requestId.current,
          category,
          message,
          diagnostics: getFeedbackDiagnostics(),
        });
        requestId.current = createRequestId();
        return response;
      }}
    />
  );
}
