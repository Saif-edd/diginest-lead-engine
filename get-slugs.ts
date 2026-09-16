import { createClient } from "@libsql/client";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL!,
  authToken: process.env.TURSO_AUTH_TOKEN!,
});

async function main() {
  const res = await db.execute("SELECT slug, config_json FROM previews");
  for (const row of res.rows) {
    console.log(row.slug);
  }
}

main().catch(console.error);
