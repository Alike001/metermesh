import { readFile } from "node:fs/promises";

import type postgres from "postgres";

const initialMigration = new URL("../migrations/0001_initial.sql", import.meta.url);

export async function runMigrations(sql: postgres.Sql): Promise<void> {
  await sql`create table if not exists schema_migrations (
    version text primary key,
    applied_at timestamptz not null default now()
  )`;

  const version = "0001_initial";
  const [existing] = await sql<{ version: string }[]>`
    select version from schema_migrations where version = ${version}
  `;
  if (existing !== undefined) return;

  const source = await readFile(initialMigration, "utf8");
  await sql.begin(async (transaction) => {
    const [lockedExisting] = await transaction<{ version: string }[]>`
      select version from schema_migrations where version = ${version} for update
    `;
    if (lockedExisting !== undefined) return;
    await transaction.unsafe(source);
    await transaction`
      insert into schema_migrations (version) values (${version})
      on conflict (version) do nothing
    `;
  });
}
