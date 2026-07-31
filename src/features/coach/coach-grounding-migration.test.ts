import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("coach grounding persistence migration", () => {
  it("adds assistant grounding and an atomic service-role exchange function", () => {
    const sql = readFileSync(resolve(__dirname, "../../../supabase/migrations/202607230031_reliable_video_coach.sql"), "utf8");
    expect(sql).toMatch(/add column if not exists grounding jsonb/i);
    expect(sql).toMatch(/create or replace function public\.append_coach_exchange/i);
    expect(sql).toMatch(/insert into public\.coach_messages[\s\S]*'user'/i);
    expect(sql).toMatch(/insert into public\.coach_messages[\s\S]*'assistant'/i);
    expect(sql).toMatch(/update public\.coach_threads[\s\S]*updated_at = now\(\)/i);
    expect(sql).toMatch(/grant execute[\s\S]*to service_role/i);
    expect(sql).toMatch(/revoke all[\s\S]*from public, anon, authenticated/i);
  });
});
