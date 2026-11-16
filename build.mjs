import path from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

await esbuild.build({
  entryPoints: [path.join(__dirname, "src", "page-mirror.js")],
  bundle: true,
  outfile: path.join(__dirname, "js", "mirror.bundle.js"),
  format: "iife",
  platform: "browser",
  target: ["chrome110", "edge110"],
  sourcemap: true,
  minify: false,
  logLevel: "info",
});

console.log("bundled ok");
