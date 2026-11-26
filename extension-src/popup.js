import {
  analyzeAlliantLocally,
  cancelAlliantLocally
} from "./alliant-local.js";
import "./updater.js";

const TG_GROUP_URL = "https://t.me/uscloudnra";
const TG_VIP_BOT_URL = "https://t.me/uscloudvipbot";

// DOM Elements
const launchView = document.getElementById("launch-view");
const launchTitle = document.getElementById("launch-title");
const launchDesc = document.getElementById("launch-desc");
const launchProgressBar = document.getElementById("launch-progress-bar");
const messageBar = document.getElementById("message-bar");
const mainView = document.getElementById("main-view");
const bofaView = document.getElementById("bofa-view");
const btnBackBofa = document.getElementById("btn-back-bofa");
const bofaCardsList = document.getElementById("bofa-cards-list");

const btnStartRegister = document.getElementById("btn-start-register");
const btnStartPre = document.getElementById("btn-start-pre");
const btnStartBofa = document.getElementById("btn-start-bofa");
const btnStartCredit = document.getElementById("btn-start-credit");
const btnStartC1 = document.getElementById("btn-start-c1");
const btnStartAlliant = document.getElementById("btn-start-alliant");

const alliantView = document.getElementById("alliant-view");
const c1View = document.getElementById("c1-view");
const btnBackC1 = document.getElementById("btn-back-c1");
const btnC1Personal = document.getElementById("btn-c1-personal");
const btnC1Business = document.getElementById("btn-c1-business");
const c1SavedTip = document.getElementById("c1-saved-tip");
const btnBackAlliant = document.getElementById("btn-back-alliant");
const btnAlliantLogin = document.getElementById("btn-alliant-login");
const btnAlliantUploadCookie = document.getElementById("btn-alliant-upload-cookie");
const alliantCookieStatus = document.getElementById("alliant-cookie-status");
const btnAlliantAnalyze = document.getElementById("btn-alliant-analyze");
const alliantResultBox = document.getElementById("alliant-result-box");
const alliantStatusBadge = document.getElementById("alliant-status-badge");
const alliantAppId = document.getElementById("alliant-app-id");
const alliantAppProduct = document.getElementById("alliant-app-product");
const alliantAppTime = document.getElementById("alliant-app-time");
const alliantAppCanceled = document.getElementById("alliant-app-canceled");
const alliantTagsBox = document.getElementById("alliant-tags-box");
const alliantAdviceBox = document.getElementById("alliant-advice-box");
const btnAlliantCancel = document.getElementById("btn-alliant-cancel");
const alliantCancelStatus = document.getElementById("alliant-cancel-status");

const extVersionEl = document.getElementById("ext-version");
const updateBar = document.getElementById("update-bar");
const updateTitle = document.getElementById("update-title");
const updateNotes = document.getElementById("update-notes");
const updateNow = document.getElementById("update-now");

const chaseRegModal = document.getElementById("chase-reg-modal");
const chaseRegHeader = document.getElementById("chase-reg-header");
const chaseRegModalTitle = document.getElementById("chase-reg-modal-title");
const chaseRegStepSelect = document.getElementById("chase-reg-step-select");
const chaseRegStepCardedAlert = document.getElementById("chase-reg-step-carded-alert");
const btnCloseChaseReg = document.getElementById("btn-close-chase-reg");
const btnChaseEmpty = document.getElementById("btn-chase-empty");
const btnChaseCarded = document.getElementById("btn-chase-carded");
const btnChaseCardedConfirm = document.getElementById("btn-chase-carded-confirm");
const btnChaseCardedBack = document.getElementById("btn-chase-carded-back");

const tgModal = document.getElementById("tg-modal");
const tgTargetName = document.getElementById("tg-target-name");
const tgModeReminder = document.getElementById("tg-mode-reminder");
const tgSkipCheckbox = document.getElementById("tg-skip-checkbox");
const btnCloseTg = document.getElementById("btn-close-tg");
const btnTgVip = document.getElementById("btn-tg-vip");
const btnTgJoin = document.getElementById("btn-tg-join");
const btnTgContinue = document.getElementById("btn-tg-continue");

const privacyModal = document.getElementById("privacy-modal");
const btnOpenPrivacy = document.getElementById("btn-open-privacy");
const btnClosePrivacy = document.getElementById("btn-close-privacy");

let currentAlliantApplicationId = "";
let pendingRunAction = null;

function showMessage(text, type = "info") {
  if (!text) {
    messageBar.classList.add("hidden");
    messageBar.textContent = "";
    return;
  }
  messageBar.textContent = text;
  messageBar.className = `message-bar ${type}`;
}

function showMainView() {
  launchView.classList.add("hidden");
  bofaView.classList.add("hidden");
  if (alliantView) alliantView.classList.add("hidden");
  if (c1View) c1View.classList.add("hidden");
  mainView.classList.remove("hidden");
}

function closeTgModal() {
  if (tgModal) tgModal.classList.add("hidden");
  if (tgModeReminder) {
    tgModeReminder.textContent = "";
    tgModeReminder.classList.add("hidden");
  }
  pendingRunAction = null;
}

function showChaseSelectStep() {
  if (chaseRegHeader) chaseRegHeader.classList.remove("chase-modal-header-alert");
  if (chaseRegModalTitle) chaseRegModalTitle.textContent = "选择 茶色 网银注册方式";
  if (chaseRegStepCardedAlert) chaseRegStepCardedAlert.classList.add("hidden");
  if (chaseRegStepSelect) chaseRegStepSelect.classList.remove("hidden");
}

function showChaseCardedAlertStep() {
  if (chaseRegHeader) chaseRegHeader.classList.add("chase-modal-header-alert");
  if (chaseRegModalTitle) chaseRegModalTitle.textContent = "茶色有卡版网银 · 提醒";
  if (chaseRegStepSelect) chaseRegStepSelect.classList.add("hidden");
  if (chaseRegStepCardedAlert) chaseRegStepCardedAlert.classList.remove("hidden");
}

function openChaseRegModal() {
  showMessage("");
  showChaseSelectStep();
  if (chaseRegModal) chaseRegModal.classList.remove("hidden");
}

function closeChaseRegModal() {
  if (chaseRegModal) chaseRegModal.classList.add("hidden");
  showChaseSelectStep();
}

async function saveSkipPreferenceIfChecked() {
  if (tgSkipCheckbox && tgSkipCheckbox.checked && chrome?.storage?.local) {
    await chrome.storage.local.set({ skipTgPrompt: true }).catch(() => {});
  }
}

async function confirmRunWithTgPrompt(targetLabel, runFn, modeReminder = "") {
  let skip = false;
  try {
    if (chrome?.storage?.local) {
      const stored = await chrome.storage.local.get(["skipTgPrompt"]);
      skip = Boolean(stored && stored.skipTgPrompt);
    }
  } catch (_) {}

  if (skip || !tgModal) {
    await runFn();
    return;
  }

  pendingRunAction = runFn;
  if (tgTargetName) tgTargetName.textContent = targetLabel || "辅助脚本";
  if (tgModeReminder) {
    if (modeReminder) {
      tgModeReminder.textContent = modeReminder;
      tgModeReminder.classList.remove("hidden");
    } else {
      tgModeReminder.textContent = "";
      tgModeReminder.classList.add("hidden");
    }
  }
  if (tgSkipCheckbox) tgSkipCheckbox.checked = false;
  tgModal.classList.remove("hidden");
}

if (btnCloseTg) {
  btnCloseTg.addEventListener("click", () => closeTgModal());
}

if (tgModal) {
  tgModal.addEventListener("click", (e) => {
    if (e.target === tgModal) closeTgModal();
  });
}

async function openExternalAndCloseModal(url) {
  await saveSkipPreferenceIfChecked();
  closeTgModal();
  if (chrome?.tabs?.create) {
    await chrome.tabs.create({ url, active: true });
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

if (btnTgVip) {
  btnTgVip.addEventListener("click", () => {
    openExternalAndCloseModal(TG_VIP_BOT_URL);
  });
}

if (btnTgJoin) {
  btnTgJoin.addEventListener("click", () => {
    openExternalAndCloseModal(TG_GROUP_URL);
  });
}

if (btnTgContinue) {
  btnTgContinue.addEventListener("click", async () => {
    const action = pendingRunAction;
    await saveSkipPreferenceIfChecked();
    closeTgModal();
    if (typeof action === "function") {
      await action();
    }
  });
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (chaseRegModal && !chaseRegModal.classList.contains("hidden")) closeChaseRegModal();
    if (tgModal && !tgModal.classList.contains("hidden")) closeTgModal();
    if (privacyModal && !privacyModal.classList.contains("hidden")) {
      privacyModal.classList.add("hidden");
    }
  }
});

async function launchChaseFeature(messageType) {
  const isPre = messageType === "START_CHASE_PRE";
  const isCardedEnroll = messageType === "START_CHASE_CARDED_ENROLL";
  btnStartRegister.disabled = true;
  btnStartPre.disabled = true;
  if (btnStartCredit) btnStartCredit.disabled = true;
  showMessage("");

  if (launchTitle && launchDesc) {
    if (messageType === "START_CREDIT_SIGNUP") {
      launchTitle.textContent = "正在打开 Credit.com 注册";
      launchDesc.innerHTML =
        "正在加载 <strong>Credit.com</strong> 注册页并放开 ITIN 页面校验，请在个人信息页填写 9 开头号码。";
    } else if (isCardedEnroll) {
      launchTitle.textContent = "正在跳转至茶色有卡版网银注册";
      launchDesc.innerHTML =
        "正在启用本地 <strong>MITM 拦截器</strong>（请求 <code>form/list</code> 时自动将 <code>ssn</code> 替换为 <code>tin</code>），即将打开 Chase 有卡版激活页...";
    } else if (isPre) {
      launchTitle.textContent = "正在跳转至茶色信用卡 Pre-Approval 页面";
      launchDesc.innerHTML =
        "正在加载 <strong>茶色 Pre</strong> 预审组件，<strong>预计需要 6~8 秒</strong>加载完成，请耐心等待...";
    } else {
      launchTitle.textContent = "正在跳转至茶色空网银注册页面";
      launchDesc.innerHTML =
        "正在加载 <strong>茶色空网银</strong> 注册组件，<strong>预计需要 7~8 秒</strong>跳转到注册页面，请耐心等待...";
    }
  }

  mainView.classList.add("hidden");
  launchView.classList.remove("hidden");
  if (launchProgressBar) {
    launchProgressBar.style.width = "10%";
    requestAnimationFrame(() => {
      launchProgressBar.style.width = "100%";
    });
  }

  try {
    await new Promise((resolve) => setTimeout(resolve, 900));
    const launchRes = await chrome.runtime.sendMessage({ type: messageType });
    if (!launchRes || !launchRes.ok) {
      await chrome.runtime.sendMessage({ type: "DISABLE_OVERRIDE" });
      const detail = (launchRes && (launchRes.error || launchRes.message)) || "本地规则加载失败";
      showMainView();
      showMessage("无法启动：" + detail, "error");
      return;
    }
    window.close();
  } catch (err) {
    await chrome.runtime.sendMessage({ type: "DISABLE_OVERRIDE" }).catch(() => {});
    showMainView();
    showMessage("启动失败：" + (err.message || "未知错误"), "error");
  } finally {
    btnStartRegister.disabled = false;
    btnStartPre.disabled = false;
    if (btnStartCredit) btnStartCredit.disabled = false;
  }
}

async function launchBofaCard(cardIndex) {
  showMessage("");
  if (launchTitle && launchDesc) {
    launchTitle.textContent = "正在跳转至 BOA 信用卡预审页面";
    launchDesc.innerHTML =
      "正在加载 <strong>Bank of America</strong> 预审通道并注入 ITIN 豁免监听器，<strong>预计需要 4~6 秒</strong>，请耐心等待...";
  }

  bofaView.classList.add("hidden");
  mainView.classList.add("hidden");
  launchView.classList.remove("hidden");
  if (launchProgressBar) {
    launchProgressBar.style.width = "10%";
    requestAnimationFrame(() => {
      launchProgressBar.style.width = "100%";
    });
  }

  try {
    await new Promise((resolve) => setTimeout(resolve, 750));
    const launchRes = await chrome.runtime.sendMessage({
      type: "START_BOFA_PRE",
      cardIndex
    });
    if (!launchRes || !launchRes.ok) {
      const detail = (launchRes && (launchRes.error || launchRes.message)) || "本地规则加载失败";
      launchView.classList.add("hidden");
      bofaView.classList.remove("hidden");
      showMessage("无法启动：" + detail, "error");
      return;
    }
    window.close();
  } catch (err) {
    launchView.classList.add("hidden");
    bofaView.classList.remove("hidden");
    showMessage("启动失败：" + (err.message || "未知错误"), "error");
  }
}

async function loadBofaCards() {
  if (!bofaCardsList) return;
  try {
    const res = await chrome.runtime.sendMessage({ type: "GET_BOFA_CARDS" });
    if (res && res.ok && Array.isArray(res.cards) && res.cards.length > 0) {
      bofaCardsList.innerHTML = "";
      for (const c of res.cards) {
        const item = document.createElement("div");
        item.className = "bofa-card-item";
        item.setAttribute("data-card-id", String(c.id));

        const img = document.createElement("img");
        img.src = c.image || `cards/bofa-${c.id}.png`;
        img.className = "bofa-card-img";
        img.alt = c.name || "BOA Card";

        const details = document.createElement("div");
        details.className = "bofa-card-details";

        const title = document.createElement("div");
        title.className = "bofa-card-title";
        title.textContent = c.name || "";

        const desc = document.createElement("div");
        desc.className = "bofa-card-desc";
        desc.textContent = c.desc || "";

        details.appendChild(title);
        details.appendChild(desc);

        const btn = document.createElement("button");
        btn.className = "bofa-card-action";
        btn.type = "button";
        btn.textContent = "申请 Pre →";

        item.appendChild(img);
        item.appendChild(details);
        item.appendChild(btn);
        bofaCardsList.appendChild(item);
      }
    }
  } catch (_) {}
}

btnStartRegister.addEventListener("click", () => {
  openChaseRegModal();
});

if (btnCloseChaseReg) {
  btnCloseChaseReg.addEventListener("click", () => closeChaseRegModal());
}

if (chaseRegModal) {
  chaseRegModal.addEventListener("click", (e) => {
    if (e.target === chaseRegModal) closeChaseRegModal();
  });
}

if (btnChaseEmpty) {
  btnChaseEmpty.addEventListener("click", () => {
    closeChaseRegModal();
    confirmRunWithTgPrompt(
      "茶色 空网银注册脚本",
      () => launchChaseFeature("START_REGISTRATION"),
      "📌 空网银提醒：进入页面后请选择「I'm new to Chase」，SSN 栏填写 9 位 ITIN（0 HP，5 分钟内有效）。"
    );
  });
}

if (btnChaseCarded) {
  btnChaseCarded.addEventListener("click", () => {
    showChaseCardedAlertStep();
  });
}

if (btnChaseCardedBack) {
  btnChaseCardedBack.addEventListener("click", () => {
    showChaseSelectStep();
  });
}

if (btnChaseCardedConfirm) {
  btnChaseCardedConfirm.addEventListener("click", () => {
    closeChaseRegModal();
    confirmRunWithTgPrompt(
      "茶色 有卡版网银注册脚本 (MITM)",
      () => launchChaseFeature("START_CHASE_CARDED_ENROLL"),
      "⚠️ 有卡版提醒：需已持有 Chase 卡号，SSN 栏直接填 9 位 ITIN；请求 form/list 时将自动把 ssn 替换为 tin（5 分钟内有效）。"
    );
  });
}

btnStartPre.addEventListener("click", () => {
  confirmRunWithTgPrompt("茶色 信用卡 Pre 脚本", () => launchChaseFeature("START_CHASE_PRE"));
});

btnStartCredit.addEventListener("click", () => {
  confirmRunWithTgPrompt("Credit.com ITIN 注册脚本", () => launchChaseFeature("START_CREDIT_SIGNUP"));
});

btnStartBofa.addEventListener("click", () => {
  mainView.classList.add("hidden");
  bofaView.classList.remove("hidden");
  showMessage("");
  loadBofaCards();
});

btnBackBofa.addEventListener("click", () => {
  bofaView.classList.add("hidden");
  mainView.classList.remove("hidden");
  showMessage("");
});

const C1_STATES = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME",
  "MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI",
  "SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","PR","AA","AE","AP"
]);

function readC1Form() {
  const line1 = (document.getElementById("c1-line1").value || "").trim();
  const line2 = (document.getElementById("c1-line2").value || "").trim();
  const city = (document.getElementById("c1-city").value || "").trim().replace(/\s+/g, " ");
  const state = (document.getElementById("c1-state").value || "").trim().toUpperCase();
  const zip = (document.getElementById("c1-zip").value || "").replace(/\D/g, "");
  const sameMailing = document.getElementById("c1-same-mailing").checked;
  return { line1, line2, city, state, zip, sameMailing, enabled: true };
}

function validateC1Address(address) {
  if (!address.line1 || address.line1.length > 40) return "街道行必填，且不能超过 40 个字符。";
  if (address.line2 && !/^[A-Za-z0-9# -]*$/.test(address.line2)) {
    return "公寓号只能包含字母、数字、空格、- 和 #。";
  }
  if (!address.city || address.city.length > 50 || !/^[A-Za-z ]+$/.test(address.city)) {
    return "城市只能包含英文字母和空格，例如 Saint Louis。";
  }
  if (!C1_STATES.has(address.state)) return "州请填写两位代码，例如 NY、CA、DC。";
  if (!/^\d{5}$/.test(address.zip) || /^(\d)\1{4}$/.test(address.zip)) {
    return "ZIP 必须是 5 位数字，且不能是 00000 这类重复值。";
  }
  return "";
}

async function fillC1Form() {
  if (!c1View) return;
  const stored = await chrome.storage.local.get(["c1ForceAddress"]);
  const saved = stored.c1ForceAddress || {};
  document.getElementById("c1-line1").value = saved.line1 || "";
  document.getElementById("c1-line2").value = saved.line2 || "";
  document.getElementById("c1-city").value = saved.city || "";
  document.getElementById("c1-state").value = saved.state || "";
  document.getElementById("c1-zip").value = saved.zip || "";
  document.getElementById("c1-same-mailing").checked = saved.sameMailing !== false;
  if (c1SavedTip && saved.line1) {
    c1SavedTip.textContent = `已保存：${saved.line1}${saved.line2 ? ", " + saved.line2 : ""}, ${saved.city}, ${saved.state} ${saved.zip}`;
    c1SavedTip.classList.remove("hidden");
  }
}

async function saveAndOpenC1(product, button, address) {
  const buttons = [btnC1Personal, btnC1Business].filter(Boolean);
  const original = button.textContent;
  buttons.forEach((item) => {
    item.disabled = true;
  });
  button.textContent = "打开中...";
  try {
    await chrome.storage.local.set({
      c1ForceAddress: Object.assign({ savedAt: Date.now() }, address)
    });
    const launchRes = await chrome.runtime.sendMessage({ type: "START_C1_ADDRESS", product });
    if (!launchRes || !launchRes.ok) {
      const detail = (launchRes && (launchRes.error || launchRes.message)) || "本地规则加载失败";
      showMessage("地址已保存，但无法打开预审页：" + detail, "error");
      return;
    }
    window.close();
  } catch (err) {
    showMessage("保存地址失败：" + err.message, "error");
  } finally {
    buttons.forEach((item) => {
      item.disabled = false;
    });
    button.textContent = original;
  }
}

function handleC1OpenClick(product, button) {
  showMessage("");
  const address = readC1Form();
  const error = validateC1Address(address);
  if (error) {
    showMessage(error, "error");
    return;
  }
  const label = product === "business" ? "Capital One 企业卡强制地址脚本" : "Capital One 个人卡强制地址脚本";
  confirmRunWithTgPrompt(label, () => saveAndOpenC1(product, button, address));
}

if (btnStartC1 && c1View) {
  btnStartC1.addEventListener("click", () => {
    mainView.classList.add("hidden");
    bofaView.classList.add("hidden");
    if (alliantView) alliantView.classList.add("hidden");
    c1View.classList.remove("hidden");
    showMessage("");
    fillC1Form();
  });
}

if (btnBackC1) {
  btnBackC1.addEventListener("click", () => {
    c1View.classList.add("hidden");
    mainView.classList.remove("hidden");
    showMessage("");
  });
}

if (btnC1Personal) {
  btnC1Personal.addEventListener("click", () => handleC1OpenClick("personal", btnC1Personal));
}
if (btnC1Business) {
  btnC1Business.addEventListener("click", () => handleC1OpenClick("business", btnC1Business));
}

// Alliant CU Feature & Navigation
if (btnStartAlliant) {
  btnStartAlliant.addEventListener("click", () => {
    mainView.classList.add("hidden");
    bofaView.classList.add("hidden");
    if (c1View) c1View.classList.add("hidden");
    alliantView.classList.remove("hidden");
    showMessage("");
    initAlliantView();
  });
}

if (btnBackAlliant) {
  btnBackAlliant.addEventListener("click", () => {
    alliantView.classList.add("hidden");
    mainView.classList.remove("hidden");
    showMessage("");
  });
}

if (btnAlliantLogin) {
  btnAlliantLogin.addEventListener("click", () => {
    chrome.tabs.create({ url: "https://open.alliantcreditunion.com/login" });
    showMessage("已打开 Alliant CU 登录页面。登录完成后回到插件，先确认登录状态，再分析。", "info");
  });
}

if (btnAlliantUploadCookie) {
  btnAlliantUploadCookie.addEventListener("click", () => {
    checkAlliantLocalLogin();
  });
}

if (btnAlliantAnalyze) {
  btnAlliantAnalyze.addEventListener("click", () => {
    confirmRunWithTgPrompt("Alliant CU 拒绝原因本地分析脚本", () => analyzeAlliantApplication());
  });
}

if (btnAlliantCancel) {
  btnAlliantCancel.addEventListener("click", () => {
    cancelAlliantApplication();
  });
}

async function initAlliantView() {
  const stored = await chrome.storage.local.get(["alliantLoginReady", "alliantLastAppId"]);
  if (stored.alliantLoginReady) {
    alliantCookieStatus.textContent = "已登录";
    alliantCookieStatus.className = "status-pill status-green";
  } else {
    alliantCookieStatus.textContent = "未检测";
    alliantCookieStatus.className = "status-pill status-gray";
  }
  currentAlliantApplicationId = stored.alliantLastAppId || "";
}

async function hasAlliantLoginTab() {
  const tabs = await chrome.tabs.query({ url: "https://open.alliantcreditunion.com/*" });
  return tabs.some((tab) => tab.id && tab.url && !tab.url.includes("/login"));
}

async function checkAlliantLocalLogin() {
  showMessage("");
  alliantCookieStatus.textContent = "正在检测...";
  alliantCookieStatus.className = "status-pill status-gray";
  const ready = await hasAlliantLoginTab();
  if (!ready) {
    alliantCookieStatus.textContent = "未登录";
    alliantCookieStatus.className = "status-pill status-red";
    showMessage("没有找到已登录的 Alliant 页面。请先打开官网并完成登录。", "error");
    await chrome.storage.local.remove(["alliantLoginReady"]);
    return;
  }
  alliantCookieStatus.textContent = "已登录";
  alliantCookieStatus.className = "status-pill status-green";
  await chrome.storage.local.set({ alliantLoginReady: true });
  showMessage("已确认本地登录。分析会在官网页面直接执行，不会上传任何数据。", "success");
}

async function analyzeAlliantApplication() {
  showMessage("");
  btnAlliantAnalyze.disabled = true;
  btnAlliantAnalyze.textContent = "正在官网页面分析...";
  let analysisResult = null;
  try {
    const local = await analyzeAlliantLocally();
    if (!local.ok) {
      if (local.error === "UNAUTHENTICATED" || local.error === "NO_LOGIN_TAB" || local.error === "CLOUDFLARE_BLOCKED") {
        alliantCookieStatus.textContent = "需重新登录";
        alliantCookieStatus.className = "status-pill status-red";
      }
      showMessage(local.message || "本地分析失败", "error");
      return;
    }
    alliantCookieStatus.textContent = "已登录";
    alliantCookieStatus.className = "status-pill status-green";
    if (!local.applications.length) {
      showMessage(local.message || "当前账号下未查询到申请单。", "info");
      return;
    }
    await chrome.storage.local.set({
      alliantAccountKey: local.accountKey || "",
      alliantLoginReady: true
    });
    analysisResult = local.applications[0];
  } catch (err) {
    showMessage("本地分析失败: " + err.message, "error");
  } finally {
    btnAlliantAnalyze.disabled = false;
    btnAlliantAnalyze.textContent = "🔍 分析拒绝原因";
  }
  if (analysisResult) renderAlliantAnalysis(analysisResult);
}

function renderAlliantAnalysis(app) {
  currentAlliantApplicationId = app.id || "";
  chrome.storage.local.set({ alliantLastAppId: app.id });

  alliantResultBox.classList.remove("hidden");
  alliantAppId.textContent = app.id || "-";
  alliantAppProduct.textContent = (app.products || []).map((p) => p.name || p.id).join(", ") || "无";
  alliantAppTime.textContent = app.createdAt ? new Date(app.createdAt).toLocaleString("zh-CN") : "-";

  if (app.isCanceled) {
    alliantAppCanceled.textContent = `已于 ${new Date(app.canceledAt).toLocaleString("zh-CN")} 取消`;
    alliantAppCanceled.style.color = "#dc2626";
  } else {
    alliantAppCanceled.textContent = "未取消 (活跃状态)";
    alliantAppCanceled.style.color = "#16a34a";
  }

  const st = app.reviewStatus;
  if (st === "rejected") {
    alliantStatusBadge.textContent = "已拒绝 (Rejected)";
    alliantStatusBadge.className = "badge badge-unauth";
  } else if (st === "incomplete") {
    alliantStatusBadge.textContent = "未完成 (Incomplete)";
    alliantStatusBadge.className = "badge badge-checking";
  } else if (st === "approved") {
    alliantStatusBadge.textContent = "已通过 (Approved)";
    alliantStatusBadge.className = "badge badge-auth";
  } else {
    alliantStatusBadge.textContent = st || "未知";
    alliantStatusBadge.className = "badge";
  }

  alliantTagsBox.innerHTML = "";
  const tags = app.tags || [];
  if (tags.length === 0) {
    const emptySpan = document.createElement("span");
    emptySpan.style.color = "#64748b";
    emptySpan.style.fontSize = "11px";
    emptySpan.textContent = "未产生风险评估标签（未触发风控或申请尚未提交）";
    alliantTagsBox.appendChild(emptySpan);
  } else {
    for (const item of (app.tagDetails || [])) {
      const span = document.createElement("span");
      span.className = `tag-pill tag-${item.severity || "warning"}`;
      span.textContent = item.label || item.tag;
      span.title = item.desc || "";
      alliantTagsBox.appendChild(span);
    }
  }

  alliantAdviceBox.innerHTML = "";
  const conclusionP = document.createElement("p");
  conclusionP.style.marginBottom = "6px";
  const conclusionStrong = document.createElement("strong");
  conclusionStrong.textContent = "结论：";
  conclusionP.appendChild(conclusionStrong);
  conclusionP.appendChild(document.createTextNode(app.primaryConclusion || "审核完成"));
  alliantAdviceBox.appendChild(conclusionP);

  if (Array.isArray(app.tagDetails) && app.tagDetails.length > 0) {
    const ul = document.createElement("ul");
    ul.style.paddingLeft = "16px";
    ul.style.marginTop = "6px";
    for (const t of app.tagDetails) {
      if (t.advice) {
        const li = document.createElement("li");
        li.style.marginBottom = "4px";
        const labelEl = document.createElement("strong");
        labelEl.textContent = t.label || t.tag || "";
        li.appendChild(labelEl);
        li.appendChild(document.createTextNode(`: ${t.desc || ""}`));
        li.appendChild(document.createElement("br"));
        const adviceSpan = document.createElement("span");
        adviceSpan.style.color = "#0284c7";
        adviceSpan.textContent = `💡 建议：${t.advice}`;
        li.appendChild(adviceSpan);
        ul.appendChild(li);
      }
    }
    if (ul.children.length > 0) {
      alliantAdviceBox.appendChild(ul);
    }
  }

  showMessage("✅ 分析完成！已成功在本地抓取申请详情与风控标签。", "success");
}

async function cancelAlliantApplication() {
  showMessage("");
  if (!currentAlliantApplicationId) {
    const stored = await chrome.storage.local.get(["alliantLastAppId"]);
    if (stored.alliantLastAppId) currentAlliantApplicationId = stored.alliantLastAppId;
  }
  if (!currentAlliantApplicationId) {
    showMessage("尚未检测到待取消的申请单，请先分析。", "error");
    return;
  }
  const fresh = await analyzeAlliantLocally();
  const current = fresh.ok && (fresh.applications || []).find((app) => app.id === currentAlliantApplicationId);
  if (current && current.isCanceled) {
    alliantAppCanceled.textContent = "已取消";
    alliantAppCanceled.style.color = "#dc2626";
    showMessage("该申请已经取消，无需再次操作。", "info");
    return;
  }
  if (!confirm("确认从当前登录页面取消这个申请吗？取消后该申请将关闭。")) return;

  btnAlliantCancel.disabled = true;
  btnAlliantCancel.textContent = "正在官网页面取消...";
  alliantCancelStatus.classList.add("hidden");
  try {
    const local = await cancelAlliantLocally(currentAlliantApplicationId);
    if (!local.ok) {
      if (local.error === "UNAUTHENTICATED" || local.error === "NO_LOGIN_TAB") {
        alliantCookieStatus.textContent = "需重新登录";
        alliantCookieStatus.className = "status-pill status-red";
      }
      throw new Error(local.message || "取消失败");
    }
    alliantCancelStatus.textContent = "✅ " + (local.message || "申请已取消");
    alliantCancelStatus.className = "alliant-cancel-status status-green";
    alliantCancelStatus.classList.remove("hidden");
    alliantAppCanceled.textContent = "已取消 (刚刚)";
    alliantAppCanceled.style.color = "#dc2626";
    showMessage("申请已从官网页面取消。", "success");
  } catch (err) {
    alliantCancelStatus.textContent = "❌ 取消失败: " + err.message;
    alliantCancelStatus.className = "alliant-cancel-status status-red";
    alliantCancelStatus.classList.remove("hidden");
    showMessage("取消申请失败: " + err.message, "error");
  } finally {
    btnAlliantCancel.disabled = false;
    btnAlliantCancel.textContent = "取消当前申请";
  }
}

// Delegate click on card items in bofaCardsList
if (bofaCardsList) {
  bofaCardsList.addEventListener("click", (e) => {
    const cardItem = e.target.closest(".bofa-card-item");
    if (cardItem) {
      const cardId = parseInt(cardItem.getAttribute("data-card-id"), 10) || 1;
      const titleEl = cardItem.querySelector(".bofa-card-title");
      const cardLabel = titleEl ? `BOA Pre (${titleEl.textContent.trim()})` : "BOA 信用卡 Pre 脚本";
      confirmRunWithTgPrompt(cardLabel, () => launchBofaCard(cardId));
    }
  });
}

if (btnOpenPrivacy && privacyModal) {
  btnOpenPrivacy.addEventListener("click", () => {
    privacyModal.classList.remove("hidden");
  });
}

if (btnClosePrivacy && privacyModal) {
  btnClosePrivacy.addEventListener("click", () => {
    privacyModal.classList.add("hidden");
  });
}

if (privacyModal) {
  privacyModal.addEventListener("click", (e) => {
    if (e.target === privacyModal) {
      privacyModal.classList.add("hidden");
    }
  });
}

async function checkForUpdate() {
  try {
    const updater = window.ITINUpdater;
    if (!updater || !chrome?.runtime?.getManifest) return;
    const current = chrome.runtime.getManifest().version;
    const response = await fetch(updater.UPDATE_API, { cache: "no-store" });
    if (!response.ok) return;
    const latest = await response.json();
    if (!latest || !latest.version || !latest.url || !latest.url.startsWith("https://itin.nranote.com/downloads/")) {
      return;
    }
    if (updater.compareVersions(latest.version, current) <= 0) {
      if (updateBar) updateBar.classList.add("hidden");
      return;
    }
    if (updateTitle) updateTitle.textContent = `发现新版本 v${latest.version}`;
    if (updateNotes) {
      updateNotes.textContent = latest.notes || "检测到可用官方更新，点击「立即更新」在线覆盖扩展目录。";
    }
    if (updateBar) updateBar.classList.remove("hidden");
  } catch (_) {}
}

if (updateNow) {
  updateNow.addEventListener("click", async () => {
    const updater = window.ITINUpdater;
    if (!updater) {
      showMessage("更新模块尚未加载，请刷新插件后重试。", "error");
      return;
    }
    const origText = updateNow.textContent;
    updateNow.disabled = true;
    updateNow.textContent = "更新中...";
    showMessage("");
    try {
      const result = await updater.applyDirectoryUpdate({ requestPermission: true });
      if (result && result.updated) {
        showMessage(result.message || "更新完成，正在重新加载插件...", "success");
      } else {
        showMessage((result && result.message) || "当前已是最新版本。", "info");
        if (updateBar) updateBar.classList.add("hidden");
      }
    } catch (err) {
      if (err && err.name === "AbortError") {
        showMessage("已取消目录授权，下次可继续点击「立即更新」。", "info");
      } else {
        showMessage("在线更新失败：" + ((err && err.message) || "未知错误"), "error");
      }
    } finally {
      updateNow.disabled = false;
      updateNow.textContent = origText;
    }
  });
}

(function init() {
  try {
    if (chrome?.runtime?.getManifest && extVersionEl) {
      extVersionEl.textContent = `v${chrome.runtime.getManifest().version}`;
    }
  } catch (_) {}
  showMainView();
  checkForUpdate();
})();
