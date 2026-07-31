import { requireNativeModule } from "expo";

export type FormVideoNormalizerModule = {
  normalizeVideoAsync(localUri: string): Promise<string>;
  normalizePrivacySafeUpperBodyAsync(localUri: string): Promise<string>;
};

export default requireNativeModule<FormVideoNormalizerModule>("FormVideoNormalizer");
