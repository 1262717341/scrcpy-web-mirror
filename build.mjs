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
  // 生产包不带 sourcemap（避免源码结构随静态目录暴露）；保持未压缩以兼容测试脚本对函数名/字符串的断言
  sourcemap: false,
  minify: false,
  logLevel: "info",
});

console.log("bundled ok");
