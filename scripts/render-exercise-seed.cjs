const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const babel = require("@babel/core");

const root = resolve(__dirname, "..");
const catalogPath = resolve(root, "src/features/exercises/catalog.ts");
const source = readFileSync(catalogPath, "utf8")
  .replace("export const EXERCISES", "const EXERCISES")
  .replace(/export function findExercise[\s\S]*$/, "module.exports = { EXERCISES };\n");
const compiled = babel.transformSync(source, {
  babelrc: false,
  configFile: false,
  filename: catalogPath,
  presets: ["babel-preset-expo"],
}).code;
const evaluated = { exports: {} };
new Function("module", "exports", "require", compiled)(evaluated, evaluated.exports, require);
const catalog = evaluated.exports.EXERCISES;
// Keep the checked-in seed compact so command output and migration tooling do not
// truncate the canonical 50-profile snapshot.
const serialized = JSON.stringify(catalog);

const output = `create temporary table form_seed_catalog (exercise jsonb) on commit drop;

insert into form_seed_catalog (exercise)
select value
from jsonb_array_elements($profiles$${serialized}$profiles$::jsonb);

insert into public.exercises (id, slug, name, category, equipment, aliases, is_active)
select
  (exercise ->> 'id')::integer,
  exercise ->> 'slug',
  exercise ->> 'name',
  exercise ->> 'category',
  array(select jsonb_array_elements_text(exercise -> 'equipment')),
  array(select jsonb_array_elements_text(exercise -> 'aliases')),
  true
from form_seed_catalog
on conflict (id) do update set
  slug = excluded.slug,
  name = excluded.name,
  category = excluded.category,
  equipment = excluded.equipment,
  aliases = excluded.aliases,
  is_active = true;

insert into public.exercise_profiles (exercise_id, version, profile, is_active)
select
  (exercise ->> 'id')::integer,
  1,
  exercise -> 'profile',
  true
from form_seed_catalog
on conflict (exercise_id, version) do update set
  profile = excluded.profile,
  is_active = true;
`;

const start = Number.parseInt(process.argv[2] ?? "0", 10);
const length = Number.parseInt(process.argv[3] ?? `${output.length}`, 10);
process.stdout.write(output.slice(start, start + length));
