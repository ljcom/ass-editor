import { createServer } from "vite";
import { spawn } from "node:child_process";
import electron from "electron";
await import("./build-electron.mjs");
const server = await createServer();
await server.listen();
const childEnv = {
  ...process.env,
  VITE_DEV_SERVER_URL: "http://127.0.0.1:5173",
};
delete childEnv.ELECTRON_RUN_AS_NODE;
const child = spawn(electron, ["."], {
  stdio: "inherit",
  env: childEnv,
});
const stop = async () => {
  child.kill();
  await server.close();
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
child.on("exit", async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
