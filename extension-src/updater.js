/**
 * Cross-platform unpacked-extension updater.
 * Read-only check against https://itin.nranote.com/api/extension/latest;
 * downloads the official zip only when the user clicks "立即更新".
 */
const UPDATE_API = "https://itin.nranote.com/api/extension/latest";
const DIRECTORY_DB = "itin-updater";
const DIRECTORY_KEY = "extension-directory";

function compareVersions(left, right) {
  const a = String(left || "").split(".").map((part) => parseInt(part, 10) || 0);
  const b = String(right || "").split(".").map((part) => parseInt(part, 10) || 0);
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    const diff = (a[i] || 0) - (b[i] || 0);
    if (diff) return diff;
  }
  return 0;
}

function openDirectoryDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DIRECTORY_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("handles");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readDirectoryHandle() {
  const db = await openDirectoryDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction("handles").objectStore("handles").get(DIRECTORY_KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function writeDirectoryHandle(handle) {
  const db = await openDirectoryDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction("handles", "readwrite").objectStore("handles").put(handle, DIRECTORY_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function ensurePermission(handle, requestPermission) {
  if (!handle || !handle.queryPermission) return false;
  const options = { mode: "readwrite" };
  if ((await handle.queryPermission(options)) === "granted") return true;
  if (!requestPermission || !handle.requestPermission) return false;
  return (await handle.requestPermission(options)) === "granted";
}

async function resolveDirectory(requestPermission) {
  let handle = await readDirectoryHandle();
  if (handle && await ensurePermission(handle, requestPermission)) return handle;
  if (!requestPermission) {
    const error = new Error("请点一次「立即更新」并选择插件目录，之后更新无需重复选择。");
    error.code = "DIRECTORY_REQUIRED";
    throw error;
  }
  handle = await window.showDirectoryPicker({ mode: "readwrite" });
  const manifestHandle = await handle.getFileHandle("manifest.json");
  const manifest = JSON.parse(await (await manifestHandle.getFile()).text());
  if (manifest.name !== "ITIN tools") throw new Error("请选择 ITIN tools 的插件根目录。");
  await writeDirectoryHandle(handle).catch(() => {});
  return handle;
}

async function removeEntry(directory, name) {
  await directory.removeEntry(name, { recursive: true });
}

async function writeFile(directory, relativePath, blob) {
  const parts = relativePath.split("/").filter(Boolean);
  let current = directory;
  for (const part of parts.slice(0, -1)) {
    current = await current.getDirectoryHandle(part, { create: true });
  }
  const file = await current.getFileHandle(parts[parts.length - 1], { create: true });
  const writable = await file.createWritable();
  await writable.write(blob);
  await writable.close();
}

async function downloadUpdate(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`更新包下载失败 (${response.status})`);
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength < 1000) throw new Error("更新包内容无效。");
  return buffer;
}

async function applyDirectoryUpdate({ requestPermission = false } = {}) {
  if (!window.showDirectoryPicker) {
    throw new Error("当前浏览器不支持目录写入，请使用 Chrome 或 Edge。");
  }
  if (typeof JSZip === "undefined") {
    throw new Error("缺少 JSZip 组件，无法解压更新包。");
  }
  const current = chrome.runtime.getManifest().version;
  const latestResponse = await fetch(UPDATE_API, { cache: "no-store" });
  if (!latestResponse.ok) throw new Error("无法获取最新版本。");
  const latest = await latestResponse.json();
  if (!latest.version || !latest.url || !latest.url.startsWith("https://itin.nranote.com/downloads/")) {
    throw new Error("更新信息无效。");
  }
  if (compareVersions(latest.version, current) <= 0) {
    return { ok: true, updated: false, version: current, message: "已是最新版本" };
  }

  const directory = await resolveDirectory(requestPermission);
  const zipBuffer = await downloadUpdate(latest.url);
  const zip = await JSZip.loadAsync(zipBuffer);
  const rootPrefix = Object.keys(zip.files).some((name) => name === "manifest.json")
    ? ""
    : (Object.keys(zip.files).find((name) => name.endsWith("/manifest.json")) || "").replace(/manifest\.json$/, "");
  if (!Object.keys(zip.files).some((name) => name === `${rootPrefix}manifest.json`)) {
    throw new Error("更新包缺少 manifest.json。");
  }

  const existing = [];
  for await (const [name] of directory.entries()) existing.push(name);
  for (const name of existing) await removeEntry(directory, name);

  const files = Object.values(zip.files).filter((entry) => !entry.dir && entry.name.startsWith(rootPrefix));
  for (const entry of files) {
    const relativePath = entry.name.slice(rootPrefix.length);
    if (!relativePath || relativePath.split("/").includes("..")) continue;
    await writeFile(directory, relativePath, await entry.async("blob"));
  }

  if (chrome?.runtime?.reload) {
    chrome.runtime.reload();
  }
  return { ok: true, updated: true, version: latest.version, message: "更新完成，正在重新加载" };
}

window.ITINUpdater = { applyDirectoryUpdate, compareVersions, UPDATE_API };
