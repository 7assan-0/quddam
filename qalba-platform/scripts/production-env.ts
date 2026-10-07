import { loadEnvConfig } from "@next/env";
import { productionEnvironment } from "../src/lib/operations/environment";
Object.assign(process.env, { NODE_ENV: "production" });
loadEnvConfig(process.cwd(), false);
const result = productionEnvironment(process.env);
console.log(JSON.stringify(result, null, 2));
process.exitCode = result.valid ? 0 : 1;
