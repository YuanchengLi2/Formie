import { Directory, File, Paths } from "expo-file-system";
import * as SecureStore from "expo-secure-store";

import type { AnalyticsStorage } from "./analytics-storage";

const IDENTITY_KEY = "formie.analytics.identity.v3";
const directory = new Directory(Paths.document, "formie-analytics");
const queueFile = new File(directory, "queue-v3.json");
const ensureDirectory = () => directory.create({ idempotent: true, intermediates: true });

export const analyticsStorage: AnalyticsStorage = {
  readIdentity: () => SecureStore.getItemAsync(IDENTITY_KEY),
  writeIdentity: (value) => SecureStore.setItemAsync(IDENTITY_KEY, value),
  readQueue: async () => {
    ensureDirectory();
    return queueFile.exists ? queueFile.text() : null;
  },
  writeQueue: async (value) => {
    ensureDirectory();
    if (!queueFile.exists) queueFile.create({ intermediates: true });
    queueFile.write(value);
  },
};
