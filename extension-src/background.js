/**
 * Background service worker (100% Local & Open-Source Edition).
 * All hooks (Chase mortgage/netbank, Chase pre, BOA pre, Credit.com signup,
 * Capital One force-address, and Alliant analysis/cancellation) run purely
 * locally inside the browser with zero backend server communication.
 */
const ACTIVE_RULE_IDS = [100, 101];
const LEGACY_REDIRECT_IDS = [1, 2, 3, 4, 5, 6, 7];

const SITE_CONFIG = {
  openUrl:
    "https://secure.chase.com/web/oao/application/retail?cfgCode=502002&sourceCode=WHMDEF&SourceCode=WHMDEF#/origination/gettingStarted/gettingStarted/initiate",
  preUrl:
    "https://secure.chase.com/web/oao/application/card?cfgCode=PREAPPROVEDCONCC&flowVersion=REACT#/origination/preapproved/index/index;cellCode=63D5",
  c1PreUrl: "https://www.capitalone.com/apply/credit-cards/preapprove/",
  c1BusinessUrl: "https://www.capitalone.com/apply/small-business/preapprove/all/",
  creditSignupUrl: "https://app.credit.com/sign-up",
  cspRule: {
    id: 100,
    priority: 10,
    action: {
      type: "modifyHeaders",
      responseHeaders: [
        { header: "content-security-policy", operation: "remove" },
        { header: "content-security-policy-report-only", operation: "remove" }
      ]
    },
    condition: {
      urlFilter: "||chase.com/",
      resourceTypes: ["main_frame", "sub_frame", "script", "xmlhttprequest"]
    }
  },
  bofaCspRule: {
    id: 101,
    priority: 10,
    action: {
      type: "modifyHeaders",
      responseHeaders: [
        { header: "content-security-policy", operation: "remove" },
        { header: "content-security-policy-report-only", operation: "remove" }
      ]
    },
    condition: {
      urlFilter: "||secure.bankofamerica.com/",
      resourceTypes: ["main_frame", "sub_frame", "script", "xmlhttprequest"]
    }
  },
  bofaCards: [
    {
      id: 1,
      name: "Bank of America® Customized Cash Rewards Credit Card",
      desc: "3% 选定类别返现 · 无年费",
      url:
        "https://secure.bankofamerica.com/apply-now-services/cards-prequal/initialize-prequal?requesttype=CCAPQ&campaignid=4079537&productoffercode=8H&appflow=USA&locale=en_US&lobchannelcode=BPCSPP",
      image: "cards/bofa-1.png"
    },
    {
      id: 2,
      name: "Bank of America® Unlimited Cash Rewards Credit Card",
      desc: "1.5% 无限返现 · 限时 Offer · 无年费",
      url:
        "https://secure.bankofamerica.com/apply-now-services/cards-prequal/initialize-prequal?requesttype=CCAPQ&campaignid=4082058&productoffercode=6E&appflow=USA&locale=en_US&lobchannelcode=BPCSPP",
      image: "cards/bofa-2.png"
    },
    {
      id: 3,
      name: "BankAmericard® Credit Card",
      desc: "长达 18 个月 0% Intro APR · 无年费",
      url:
        "https://secure.bankofamerica.com/apply-now-services/cards-prequal/initialize-prequal?requesttype=CCAPQ&campaignid=4079405&productoffercode=5F&appflow=USA&locale=en_US&lobchannelcode=BPCSPP",
      image: "cards/bofa-3.png"
    },
    {
      id: 4,
      name: "Bank of America® Travel Rewards Credit Card",
      desc: "1.5x 旅行消费积分 · 无年费 · 0 FTF",
      url:
        "https://secure.bankofamerica.com/apply-now-services/cards-prequal/initialize-prequal?requesttype=CCAPQ&campaignid=4079332&productoffercode=92&appflow=USA&locale=en_US&lobchannelcode=BPCSPP",
      image: "cards/bofa-4.png"
    },
    {
      id: 5,
      name: "Bank of America® Premium Rewards® Credit Card",
      desc: "2x 旅行/餐饮 · $100 航空杂费报销",
      url:
        "https://secure.bankofamerica.com/apply-now-services/cards-prequal/initialize-prequal?requesttype=CCAPQ&campaignid=4079484&productoffercode=D9&appflow=USA&locale=en_US&lobchannelcode=BPCSPP",
      image: "cards/bofa-5.png"
    },
    {
      id: 6,
      name: "Bank of America® Premium Rewards® Elite Credit Card",
      desc: "高端商旅权益 · $300 报销 · 机场休息室",
      url:
        "https://secure.bankofamerica.com/apply-now-services/cards-prequal/initialize-prequal?requesttype=CCAPQ&campaignid=4079322&productoffercode=R9&appflow=USA&locale=en_US&lobchannelcode=BPCSPP",
      image: "cards/bofa-6.png"
    }
  ]
};

const HOOK_TTL_MS = 5 * 60 * 1000;
const SCRIPT_IDS = {
  chaseopen: "itin-chase",
  chasepre: "itin-chase",
  bofapre: "itin-bofa",
  c1address: "itin-c1",
  creditsignup: "itin-credit"
};
const armedTabs = new Set();

async function clearStaleRedirects() {
  const [dynamicRules, sessionRules] = await Promise.all([
    chrome.declarativeNetRequest.getDynamicRules(),
    chrome.declarativeNetRequest.getSessionRules()
  ]);
  const isStale = (rule) => {
    const redirect = rule.action && rule.action.redirect;
    const target = redirect ? redirect.extensionPath || redirect.url || "" : "";
    return LEGACY_REDIRECT_IDS.includes(rule.id) || /chaseopen|chasepre/i.test(String(target));
  };
  const dynamicIds = dynamicRules.filter(isStale).map((rule) => rule.id);
  const sessionIds = sessionRules.filter(isStale).map((rule) => rule.id);
  if (dynamicIds.length) {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: dynamicIds });
  }
  if (sessionIds.length) {
    await chrome.declarativeNetRequest.updateSessionRules({ removeRuleIds: sessionIds });
  }
}

async function clearChaseCache() {
  try {
    await chrome.browsingData.removeCache({
      origins: ["https://asset.chase.com", "https://secure.chase.com"]
    });
  } catch (_) {}
}

async function enableSiteRules() {
  await clearStaleRedirects();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: ACTIVE_RULE_IDS,
    addRules: [SITE_CONFIG.cspRule, SITE_CONFIG.bofaCspRule]
  });
  await chrome.action.setBadgeText({ text: "ON" });
  await chrome.action.setBadgeBackgroundColor({ color: "#10b981" });
}

async function disableSiteRules() {
  await clearStaleRedirects();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: ACTIVE_RULE_IDS,
    addRules: []
  });
  await chrome.action.setBadgeText({ text: "" });
  armedTabs.clear();
}

async function openFeature(feature, url) {
  await enableSiteRules();
  if (feature === "chaseopen" || feature === "chasepre") {
    await clearChaseCache();
  }
  await armHook(feature);
  const tab = await chrome.tabs.create({ url, active: true });
  if (tab && tab.id) armedTabs.add(tab.id);
  return { ok: true };
}

let hookTimer = null;

function hostMatches(feature, url) {
  try {
    const parsed = new URL(url);
    if (feature === "c1address") return parsed.hostname.endsWith("capitalone.com");
    if (feature === "creditsignup") return parsed.hostname === "app.credit.com" || parsed.hostname.endsWith(".credit.com");
    if (feature === "bofapre") return parsed.hostname.endsWith("bankofamerica.com");
    return parsed.hostname.endsWith("chase.com");
  } catch (_) {
    return false;
  }
}

async function currentHookSession() {
  const stored = await chrome.storage.session.get(["hookSession"]);
  const session = stored.hookSession;
  if (!session || !session.expiresAt || session.expiresAt <= Date.now()) return null;
  return session;
}

async function armHook(feature) {
  const session = { feature, expiresAt: Date.now() + HOOK_TTL_MS };
  await chrome.storage.session.set({ hookSession: session });
  await registerHook(feature);
  if (hookTimer) clearTimeout(hookTimer);
  hookTimer = setTimeout(() => {
    disarmHook().catch(() => {});
  }, HOOK_TTL_MS);
  return session;
}

async function registerHook(feature) {
  const id = SCRIPT_IDS[feature];
  if (!id) return;
  await clearRegisteredHooks();
  if (feature === "creditsignup") {
    await chrome.scripting.registerContentScripts([
      {
        id,
        matches: ["https://app.credit.com/*"],
        js: ["credit-hook.js"],
        runAt: "document_start",
        world: "MAIN",
        allFrames: false
      }
    ]);
    return;
  }
  if (feature === "c1address") {
    await chrome.scripting.registerContentScripts([
      {
        id,
        matches: ["https://*.capitalone.com/*"],
        js: ["c1-address-hook.js"],
        runAt: "document_start",
        world: "MAIN",
        allFrames: true
      },
      {
        id: id + "-bridge",
        matches: ["https://*.capitalone.com/*"],
        js: ["c1-address-bridge.js"],
        runAt: "document_start",
        allFrames: true
      }
    ]);
    return;
  }
  await chrome.scripting.registerContentScripts([
    {
      id,
      matches: feature === "bofapre" ? ["https://*.bankofamerica.com/*"] : ["https://*.chase.com/*"],
      js: ["chase-boa-hook.js"],
      runAt: "document_start",
      world: "MAIN",
      allFrames: true
    }
  ]);
}

async function clearRegisteredHooks() {
  const ids = ["itin-chase", "itin-bofa", "itin-c1", "itin-c1-bridge", "itin-credit"];
  const existing = await chrome.scripting.getRegisteredContentScripts().catch(() => []);
  const remove = existing.map((script) => script.id).filter((id) => ids.includes(id));
  if (remove.length) await chrome.scripting.unregisterContentScripts({ ids: remove });
}

async function disarmHook() {
  if (hookTimer) clearTimeout(hookTimer);
  hookTimer = null;
  await chrome.storage.session.remove("hookSession");
  await clearRegisteredHooks();
  await disableSiteRules();
}

async function injectC1Address(tabId, address) {
  const payload = JSON.stringify(address);
  await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    injectImmediately: true,
    func: (json) => {
      try {
        window.__ITIN_C1_ADDRESS__ = JSON.parse(json);
      } catch (_) {}
    },
    args: [payload]
  });
}

chrome.tabs.onRemoved.addListener((tabId) => {
  armedTabs.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (!tab || !tab.url || info.status !== "complete") return;
  currentHookSession().then(async (session) => {
    if (!session || !hostMatches(session.feature, tab.url)) return;
    if (session.feature === "c1address") {
      const stored = await chrome.storage.local.get(["c1ForceAddress"]);
      if (stored.c1ForceAddress) await injectC1Address(tabId, stored.c1ForceAddress);
    }
  }).catch(() => {});
});

const KEEP_LOCAL_KEYS = new Set([
  "c1ForceAddress",
  "skipTgPrompt",
  "alliantLoginReady",
  "alliantLastAppId",
  "alliantAccountKey"
]);

chrome.runtime.onInstalled.addListener(() => {
  disarmHook().catch(() => {});
  chrome.storage.local.get(null, (all) => {
    const staleKeys = Object.keys(all || {}).filter((key) => !KEEP_LOCAL_KEYS.has(key));
    if (staleKeys.length) {
      chrome.storage.local.remove(staleKeys).catch(() => {});
    }
  });
});

clearStaleRedirects().catch(() => {});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || !message.type) return false;

  if (message.type === "DISABLE_OVERRIDE") {
    (async () => {
      await disableSiteRules();
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (message.type === "START_REGISTRATION") {
    (async () => {
      sendResponse(await openFeature("chaseopen", SITE_CONFIG.openUrl));
    })();
    return true;
  }

  if (message.type === "START_CHASE_PRE") {
    (async () => {
      sendResponse(await openFeature("chasepre", SITE_CONFIG.preUrl));
    })();
    return true;
  }

  if (message.type === "GET_BOFA_CARDS") {
    sendResponse({ ok: true, cards: SITE_CONFIG.bofaCards });
    return false;
  }

  if (message.type === "START_C1_ADDRESS") {
    (async () => {
      const stored = await chrome.storage.local.get(["c1ForceAddress"]);
      const address = stored.c1ForceAddress;
      if (!address || !address.line1) {
        sendResponse({ ok: false, error: "请先保存地址。" });
        return;
      }
      const target = message.product === "business" ? SITE_CONFIG.c1BusinessUrl : SITE_CONFIG.c1PreUrl;
      sendResponse(await openFeature("c1address", target));
    })();
    return true;
  }

  if (message.type === "START_CREDIT_SIGNUP") {
    (async () => {
      sendResponse(await openFeature("creditsignup", SITE_CONFIG.creditSignupUrl));
    })();
    return true;
  }

  if (message.type === "START_BOFA_PRE") {
    (async () => {
      const cardUrl =
        (typeof message.cardIndex === "number" && SITE_CONFIG.bofaCards[message.cardIndex - 1] && SITE_CONFIG.bofaCards[message.cardIndex - 1].url) ||
        (SITE_CONFIG.bofaCards[0] && SITE_CONFIG.bofaCards[0].url);
      if (!cardUrl) {
        sendResponse({ ok: false, error: "Invalid card URL" });
        return;
      }
      sendResponse(await openFeature("bofapre", cardUrl));
    })();
    return true;
  }

  return false;
});
