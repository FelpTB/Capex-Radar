const fs = require("node:fs/promises");
const path = require("node:path");
const { Client } = require("pg");
const { getConfig } = require("../src/config");

async function main() {
  const config = getConfig();
  const sqlDirectory = path.join(process.cwd(), "sql");
  const files = (await fs.readdir(sqlDirectory))
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const client = new Client({
    connectionString: config.databaseUrl,
    ssl: config.databaseUrl.includes("localhost")
      ? false
      : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    for (const file of files) {
      const sql = await fs.readFile(path.join(sqlDirectory, file), "utf8");
      await client.query(sql);
      console.log(`${file} aplicada com sucesso.`);
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`Falha na migration: ${error.message}`);
  process.exitCode = 1;
});
