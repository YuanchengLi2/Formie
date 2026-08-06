export type AcquisitionSheetRow = {
  id: string;
  created_at: string;
  user_id: string;
  source: string;
  other_detail: string | null;
  platform: string;
  onboarding_version: string;
};

export type AcquisitionSheetSyncDependencies = {
  authenticate: (request: Request) => Promise<void>;
  claimRows: () => Promise<AcquisitionSheetRow[]>;
  existingResponseIds: () => Promise<Set<string>>;
  appendRows: (values: string[][]) => Promise<void>;
  markSynced: (ids: string[]) => Promise<void>;
  releaseRows: (ids: string[], error: string) => Promise<void>;
};

export async function handleAcquisitionSheetSync(
  request: Request,
  dependencies: AcquisitionSheetSyncDependencies,
  config: { configured: boolean },
): Promise<Response> {
  try {
    await dependencies.authenticate(request);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!config.configured) return Response.json({ status: "queued", reason: "sheet_not_configured" }, { status: 202 });

  let claimed: AcquisitionSheetRow[] = [];
  try {
    claimed = await dependencies.claimRows();
    if (!claimed.length) return Response.json({ status: "synced", exported: 0 });
    const existing = await dependencies.existingResponseIds();
    const missing = claimed.filter((response) => !existing.has(response.id));
    if (missing.length) {
      await dependencies.appendRows(missing.map((response) => [
        response.id,
        response.created_at,
        response.user_id,
        response.source,
        response.other_detail ?? "",
        response.platform,
        response.onboarding_version,
      ]));
    }
    await dependencies.markSynced(claimed.map((response) => response.id));
    return Response.json({ status: "synced", exported: missing.length });
  } catch (failure) {
    const message = failure instanceof Error ? failure.message : "Sheet synchronization failed";
    if (claimed.length) await dependencies.releaseRows(claimed.map((response) => response.id), message).catch(() => undefined);
    return Response.json({ error: "Sheet synchronization failed" }, { status: 502 });
  }
}
