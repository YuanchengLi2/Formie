import { Platform } from "react-native";

import { purchasesClient as nativePurchasesClient } from "./purchases.native";
import { purchasesClient as webPurchasesClient } from "./purchases.web";

// Native and web bundles use their platform-specific RevenueCat clients. The
// explicit branch keeps the browser sandbox independent from native modules.
export const purchasesClient = Platform.OS === "web" ? webPurchasesClient : nativePurchasesClient;
