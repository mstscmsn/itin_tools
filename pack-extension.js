#!/usr/bin/env node
/**
 * ITIN Tools Extension Packager - Pure Local Open-Source Edition
 * 
 * Features:
 * 1. Synchronizes extension-src/ directly to extension/.
 * 2. Verifies syntax of all JavaScript files.
 * 3. Audits that zero remote auth/payment/fingerprint patterns remain in client code.
 * 4. Packages clean, pure source extension into itin-tools.zip.
 * 5. Copies package to server/public/downloads/ for distribution.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const ROOT_DIR = __dirname;
const SRC_DIR = path.join(ROOT_DIR, "extension-src");
const DIST_DIR = path.join(ROOT_DIR, "extension");
const ZIP_PATH = path.join(ROOT_DIR, "itin-tools.zip");
const SERVER_DOWNLOADS_DIR = path.join(ROOT_DIR, "server", "public", "downloads");

function logStep(step, message) {
  console.log(`\n[\x1b[34mSTEP ${step}\x1b[0m] ${message}`);
}

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach((childItemName) => {
      if (childItemName === ".DS_Store") return;
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

function listFilesRecursive(dir, baseDir = dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".DS_Store") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFilesRecursive(full, baseDir));
    } else {
      results.push(path.relative(baseDir, full));
    }
  }
  return results;
}

async function main() {
  console.log("============================================================");
  console.log("🚀 ITIN Tools 插件打包流水线 (纯本地开源免费版)");
  console.log("============================================================");

  // 1. Verify and check syntax of source files
  logStep(1, "检测并校验 extension-src/ 纯源码语法完整性...");
  const allSrcFiles = listFilesRecursive(SRC_DIR);
  const jsFiles = allSrcFiles.filter((f) => f.endsWith(".js"));
  for (const jsFile of jsFiles) {
    const fullPath = path.join(SRC_DIR, jsFile);
    execSync(`node -c "${fullPath}"`);
    console.log(`  ✓ 语法正确: ${jsFile}`);
  }

  // Security audit: ensure zero remote auth/payment/credential upload patterns exist.
  // Read-only online update checks strictly permit /api/extension/latest and /downloads/.
  logStep("1b", "安全审计：确认无远端授权/支付/凭证上传，且在线更新仅限只读白名单接口...");
  const forbiddenPatterns = [
    "cookie: currentAlliantCookie",
    "/api/alliant/",
    "/api/auth/",
    "/api/checkout",
    "/api/pay/",
    "/api/stripe/",
    "/api/feature/",
    "chase.nranote.com",
    "hwFingerprint",
    "browserFingerprint"
  ];
  const allowedUpdateUrls = [
    /^https:\/\/itin\.nranote\.com\/api\/extension\/latest$/,
    /^https:\/\/itin\.nranote\.com\/downloads\/[A-Za-z0-9._-]*$/,
    /^https:\/\/itin\.nranote\.com\/\*$/
  ];
  const auditTargets = allSrcFiles.filter(
    (f) => !f.startsWith("vendor/") && (f.endsWith(".js") || f.endsWith(".html") || f === "manifest.json")
  );
  for (const file of auditTargets) {
    const fullPath = path.join(SRC_DIR, file);
    const content = fs.readFileSync(fullPath, "utf8");
    for (const pat of forbiddenPatterns) {
      if (content.includes(pat)) {
        throw new Error(`[Security Violation] Client file ${file} contains forbidden remote/auth pattern: "${pat}"!`);
      }
    }
    const urls = content.match(/https?:\/\/itin\.nranote\.com[^\s"'`<>);]*/g) || [];
    for (const url of urls) {
      if (!allowedUpdateUrls.some((rx) => rx.test(url))) {
        throw new Error(`[Security Violation] Client file ${file} contains non-whitelisted update server URL: "${url}"!`);
      }
    }
  }
  console.log("  ✓ 审计通过：零远端授权、零支付接口、零指纹上传，在线更新严格限定只读接口。");

  // 2. Synchronize to extension/ distribution directory
  logStep(2, "同步纯源码至 extension/ 目录 (无混淆、无加密)...");
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(DIST_DIR, { recursive: true });
  copyRecursiveSync(SRC_DIR, DIST_DIR);

  // Remove any obsolete binary / encrypted files if present
  const obsoleteFiles = ["assets.enc", "core_guard.wasm", "core_bridge.wasm", "wasm-bridge.js", "page-hook.js", "patch-runtime.js", "antiai.txt"];
  for (const obs of obsoleteFiles) {
    const p1 = path.join(SRC_DIR, obs);
    const p2 = path.join(DIST_DIR, obs);
    if (fs.existsSync(p1)) fs.unlinkSync(p1);
    if (fs.existsSync(p2)) fs.unlinkSync(p2);
  }
  console.log("  ✓ 同步完成，确认无任何混淆/加密文件残留。");

  // 3. Package extension into itin-tools.zip
  logStep(3, "打包生成纯源码插件扩展包 (itin-tools.zip)...");
  if (fs.existsSync(ZIP_PATH)) {
    fs.unlinkSync(ZIP_PATH);
  }
  execSync(`cd "${DIST_DIR}" && zip -r -FS -q "${ZIP_PATH}" . -x "*.DS_Store*"`, { stdio: "inherit" });
  const zipSize = fs.statSync(ZIP_PATH).size;
  console.log(`  ✓ 扩展包打包成功: itin-tools.zip (${(zipSize / 1024 / 1024).toFixed(2)} MB, ${zipSize} 字节)`);

  // 4. Sync to local server downloads directory
  logStep(4, "同步至 server/public/downloads/...");
  if (!fs.existsSync(SERVER_DOWNLOADS_DIR)) {
    fs.mkdirSync(SERVER_DOWNLOADS_DIR, { recursive: true });
  }
  const targets = [
    "itin-tools.zip",
    "chase-extension.zip",
    "chase-override-extension.zip"
  ];
  for (const t of targets) {
    fs.copyFileSync(ZIP_PATH, path.join(SERVER_DOWNLOADS_DIR, t));
    console.log(`  ✓ 同步: server/public/downloads/${t}`);
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(SRC_DIR, "manifest.json"), "utf8"));
  if (!/^\d+\.\d+\.\d+(?:\.\d+)?$/.test(manifest.version || "")) {
    throw new Error("manifest.json version 必须是 x.y.z");
  }
  const updateManifest = {
    version: manifest.version,
    url: "https://itin.nranote.com/downloads/itin-tools.zip",
    notes: "v2.2.0：新增茶色有卡版网银注册（form/list 请求 MITM 将 ssn 替换为 tin + 双重弹窗提醒），并恢复一键在线更新。",
    publishedAt: new Date().toISOString()
  };
  fs.writeFileSync(
    path.join(SERVER_DOWNLOADS_DIR, "extension-latest.json"),
    JSON.stringify(updateManifest, null, 2) + "\n"
  );
  console.log(`  ✓ 发布版本清单: v${manifest.version}`);

  console.log(`\n🎉 v${manifest.version} 纯本地开源免费版扩展已就绪！可在 Chrome 中直接加载 extension/ 目录进行测试。`);
}

main().catch((err) => {
  console.error("❌ 打包失败:", err);
  process.exit(1);
});
