import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";
import "dotenv/config";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl?.startsWith("file:")) {
  throw new Error('DATABASE_URL must be a SQLite file URL such as "file:./dev.db".');
}

const rawPath = databaseUrl.slice("file:".length);
const dbPath = isAbsolute(rawPath) ? rawPath : resolve(process.cwd(), "prisma", rawPath);
const migrationsRoot = resolve(process.cwd(), "prisma", "migrations");

function sqlite(sql) {
  return execFileSync("sqlite3", [dbPath, sql], { encoding: "utf8" }).trim();
}

function tableExists(name) {
  if (!existsSync(dbPath)) {
    return false;
  }

  return sqlite(`select name from sqlite_master where type='table' and name='${name}';`) === name;
}

execFileSync("mkdir", ["-p", dirname(dbPath)]);

const userTableExists = tableExists("User");

if (userTableExists && !tableExists("_local_migrations")) {
  sqlite("create table if not exists _local_migrations (name text primary key, appliedAt datetime not null default current_timestamp);");
  sqlite("insert or ignore into _local_migrations (name) values ('20260901184500_init');");
}

if (!tableExists("_local_migrations")) {
  sqlite("create table if not exists _local_migrations (name text primary key, appliedAt datetime not null default current_timestamp);");
}

const applied = new Set(
  sqlite("select name from _local_migrations order by name;")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
);

const migrations = readdirSync(migrationsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

for (const migration of migrations) {
  if (applied.has(migration)) {
    continue;
  }

  const migrationSql = readFileSync(join(migrationsRoot, migration, "migration.sql"), "utf8");
  execFileSync("sqlite3", [dbPath], { input: migrationSql });
  sqlite(`insert into _local_migrations (name) values ('${migration}');`);
  console.log(`Applied migration: ${migration}`);
}

console.log(`SQLite database ready: ${dbPath}`);
