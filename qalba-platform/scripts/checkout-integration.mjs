import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
const database = await PGlite.create(); const port = 57000 + Math.floor(Math.random() * 1000);
const socket = new PGLiteSocketServer({ db: database, host: "127.0.0.1", port }); await socket.start();
const env = { ...process.env, DATABASE_URL: `postgresql://postgres:postgres@127.0.0.1:${port}/postgres?sslmode=disable`, DATABASE_POOL_MAX: "1", AUTH_RATE_LIMIT_SECRET: randomBytes(32).toString("hex"),
  SEED_ADMIN_EMAIL: "admin@example.test", SEED_ADMIN_PASSWORD: "checkout-admin-password-123", SEED_USER_EMAIL: "player@example.test", SEED_USER_PASSWORD: "checkout-player-password-123" };
function run(bin, args) { return new Promise((resolve, reject) => { const child = spawn(bin, args, { env }); let output = ""; child.stdout.on("data", d => output += d); child.stderr.on("data", d => output += d); child.on("exit", code => code === 0 ? resolve(output) : reject(new Error(output.slice(-3000)))); }); }
try { await run("./node_modules/.bin/prisma", ["migrate", "deploy"]); await run("npm", ["run", "db:seed"]); console.log(await run("node", ["--import", "tsx", "scripts/checkout-probe.ts"])); }
finally { await socket.stop(); await database.close(); }
