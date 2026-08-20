import { readFile } from "node:fs/promises";

import type postgres from "postgres";

const migrations = [
  { source: new URL("../migrations/0001_initial.sql", import.meta.url), version: "0001_initial" },
  {
    source: new URL("../migrations/0002_public_trial.sql", import.meta.url),
    version: "0002_public_trial",
  },
];

export async function runMigrations(sql: postgres.Sql): Promise<void> {
  await sql`create table if not exists schema_migrations (
    version text primary key,
    applied_at timestamptz not null default now()
  )`;

  for (const migration of migrations) {
    const [existing] = await sql<{ version: string }[]>`
      select version from schema_migrations where version = ${migration.version}
    `;
    if (existing !== undefined) continue;

    const source = await readFile(migration.source, "utf8");
    await sql.begin(async (transaction) => {
      const [lockedExisting] = await transaction<{ version: string }[]>`
        select version from schema_migrations where version = ${migration.version} for update
      `;
      if (lockedExisting !== undefined) return;
      await transaction.unsafe(source);
      await transaction`
        insert into schema_migrations (version) values (${migration.version})
        on conflict (version) do nothing
      `;
    });
  }
}
