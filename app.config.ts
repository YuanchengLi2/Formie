import type { ConfigContext, ExpoConfig } from "expo/config";
import appJson from "./app.json";

export default ({ config }: ConfigContext): ExpoConfig => {
  const base = appJson.expo as ExpoConfig;
  const unique = <T,>(values: T[]): T[] => [...new Map(values.map((value) => [JSON.stringify(value), value])).values()];
  const plugins = unique([...(base.plugins ?? []), ...(config.plugins ?? [])]);
  return {
    ...base,
    ...config,
    plugins,
    ios: { ...base.ios, ...config.ios, associatedDomains: unique([...(base.ios?.associatedDomains ?? []), ...(config.ios?.associatedDomains ?? [])]) },
    android: {
      ...base.android,
      ...config.android,
      permissions: [...new Set([...(base.android?.permissions ?? []), ...(config.android?.permissions ?? [])])],
      intentFilters: unique([...(base.android?.intentFilters ?? []), ...(config.android?.intentFilters ?? [])]),
    },
    extra: { ...base.extra, ...config.extra },
  };
};
