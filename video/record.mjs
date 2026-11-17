import { connect, sleep } from "./cdp.mjs";
import fs from "fs";
const c = await connect();
await c.send("Page.enable");
await c.send("Emulation.setDeviceMetricsOverride", { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
await c.send("Page.navigate", { url: "http://localhost:8765/recorder.html" }); await sleep(1500);
console.log(await c.evalJS("window.run()"));
for (const k of ["webm"]) {
  const len = await c.evalJS(`window.outB64.${k}.length`); const parts = [];
  for (let i = 0; i < len; i += 4_000_000) parts.push(await c.evalJS(`window.outB64.${k}.slice(${i}, ${i + 4_000_000})`));
  fs.writeFileSync(`garth-tour.${k}`, Buffer.from(parts.join(""), "base64"));
}
process.exit(0);
