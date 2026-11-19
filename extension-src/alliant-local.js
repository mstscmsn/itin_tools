/**
 * Alliant Credit Union local client.
 * The logged-in page makes the GraphQL calls. Cookies never leave the browser.
 */
const ALLIANT_ORIGIN = "https://open.alliantcreditunion.com";
const ALLIANT_APPLICATIONS_QUERY = `query GetApplications {
  applications {
    id
    reviewStatus
    executionStatus
    createdAt
    updatedAt
    canceledAt
    failedEligibilityCheck
    personKycEvaluationTags
    personKycSnapshot {
      tags
    }
    products {
      id
      name
      type
    }
  }
  user {
    id
    firstName
    lastName
  }
}`;

const ALLIANT_CANCEL_MUTATION = `mutation CancelApplication($applicationId: ID!) {
  cancelApplication(applicationId: $applicationId) {
    applicationId
  }
}`;

const TAG_DEFINITIONS = {
  "Denied Fraud": {
    label: "欺诈硬拒绝 (Denied Fraud)",
    desc: "触发机构高风险欺诈拦截模型，系统自动拦截并拒绝申请。",
    severity: "danger",
    advice: "该记录已进入风控拒件名单。建议先取消当前申请，排查所用 IP、地址或设备环境后再重新尝试。"
  },
  "SSN Warning": {
    label: "社会安全号预警 (SSN Warning)",
    desc: "SSN / ITIN 校验异常，信用局档案未匹配或记录较薄弱。",
    severity: "danger",
    advice: "若使用 ITIN 申请，部分信用局数据库因无足够历史信贷记录会抛出警告。建议确保填报的个人姓名与生日格式完全一致。"
  },
  "Address Warning": {
    label: "地址核验预警 (Address Warning)",
    desc: "填写的住宅地址被识别为商业地址、CMRA 转运仓、虚拟地址或与公共记录不符。",
    severity: "warning",
    advice: "建议更换为真实的美国私人住宅地址（非商业地址/非常见租房转运地址）。"
  },
  "Fraud Warning": {
    label: "综合欺诈预警 (Fraud Warning)",
    desc: "申请行为、IP 代理或填报数据偏离正常用户基线。",
    severity: "danger",
    advice: "检查申请时是否开启了数据中心代理、机房 VPN 或非原生家宽环境。"
  },
  "Email Warning": {
    label: "邮箱风险预警 (Email Warning)",
    desc: "申请邮箱域名评级异常、新建临时邮箱或存在不良反欺诈评级。",
    severity: "warning",
    advice: "建议使用历史久、常用的大厂主邮箱（如 Gmail、Outlook），避免使用冷门小众域名邮箱。"
  },
  "Fraud Review": {
    label: "人工欺诈复核 (Fraud Review)",
    desc: "自动化风控系统未能直接放行，需转交人工风控审核。",
    severity: "info",
    advice: "若未补充所需证明材料或人工审核判定不通过，系统将直接转为 rejected。"
  },
  "KYC Address Match": {
    label: "KYC 地址核实通过 (KYC Address Match)",
    desc: "地址在公共数据源中已核实。",
    severity: "success",
    advice: "该单项核验通过。"
  },
  "Phone Warning": {
    label: "手机号核验预警 (Phone Warning)",
    desc: "手机号被识别为 VoIP 虚拟号（如 Google Voice）、临时卡或机主姓名与申请人不匹配。",
    severity: "warning",
    advice: "建议使用美国主流实体运营商（如 T-Mobile、AT&T、Verizon）后付费手机号。"
  },
  "DOB Warning": {
    label: "生日信息预警 (DOB Warning)",
    desc: "填报的出生年月日与信用局或官方身份库记录不吻合。",
    severity: "danger",
    advice: "请核对填写的生日（月/日/年）是否准确无误。"
  },
  "Name Warning": {
    label: "姓名拼写预警 (Name Warning)",
    desc: "姓名拼音或格式与已有公共记录或信用档案存在差异。",
    severity: "warning",
    advice: "请确保姓（Last Name）与名（First Name）未填反，且与税表或护照保持一致。"
  },
  "Device Warning": {
    label: "设备环境异常 (Device Warning)",
    desc: "申请设备指纹偏离真实用户特征。",
    severity: "warning",
    advice: "建议使用常规官方 Google Chrome 浏览器原生环境申请。"
  },
  "IP Warning": {
    label: "IP/网络环境预警 (IP Warning)",
    desc: "申请 IP 处于高风险黑名单、数据中心机房或存在欺诈滥用历史。",
    severity: "danger",
    advice: "请切换至干净的美国原生家庭宽带住宅 IP 重新尝试。"
  },
  "ChexSystems Warning": {
    label: "ChexSystems 信用预警 (ChexSystems Warning)",
    desc: "在 ChexSystems 银行开户信用局中查询到风险记录或近期开户查询过频。",
    severity: "danger",
    advice: "建议先申请 ChexSystems 个人报告排查是否存在历史遗留争议或过多 Hard Inquiry。"
  },
  "EWS Warning": {
    label: "Early Warning 风险预警 (EWS Warning)",
    desc: "Early Warning Services 报告中存在其他金融机构的不良记录。",
    severity: "danger",
    advice: "建议核实个人 Early Warning 报告中是否有被银行关闭账户的历史记录。"
  }
};

function parseApplication(app) {
  if (!app) return null;
  const tags = [];
  if (Array.isArray(app.personKycEvaluationTags)) {
    for (const tag of app.personKycEvaluationTags) {
      if (tag && !tags.includes(tag)) tags.push(tag);
    }
  }
  const snapshots = Array.isArray(app.personKycSnapshot) ? app.personKycSnapshot : [];
  for (const snap of snapshots) {
    for (const tag of (snap && snap.tags) || []) {
      if (tag && !tags.includes(tag)) tags.push(tag);
    }
  }
  const tagDetails = tags.map((tag) => ({
    tag,
    ...(TAG_DEFINITIONS[tag] || {
      label: tag,
      desc: "系统评估预警标签",
      severity: "warning",
      advice: "请核查该项信息准确性。"
    })
  }));
  const reviewStatus = app.reviewStatus || "unknown";
  const canceledAt = app.canceledAt || null;
  const isCanceled = !!canceledAt;
  let primaryConclusion = `申请当前状态为：${reviewStatus}。`;
  if (isCanceled) primaryConclusion = `申请已于 ${canceledAt} 取消。`;
  else if (reviewStatus === "rejected" && tags.includes("Denied Fraud")) {
    primaryConclusion = "申请被系统判定为高风险欺诈（Denied Fraud）拒绝。建议取消后更换合规环境重新申请。";
  } else if (reviewStatus === "rejected" && tags.includes("SSN Warning")) {
    primaryConclusion = "申请因身份核验（SSN Warning）未通过。建议核对姓名、生日与税表是否一致。";
  } else if (reviewStatus === "rejected" && tags.includes("Address Warning")) {
    primaryConclusion = "申请因地址核验（Address Warning）未通过。建议使用真实住宅地址。";
  } else if (reviewStatus === "rejected") {
    primaryConclusion = "申请审核未通过（Rejected）。请参考下方标签逐项排查。";
  } else if (reviewStatus === "incomplete") {
    primaryConclusion = "当前申请尚未完成，还未生成最终决策。";
  } else if (reviewStatus === "approved") {
    primaryConclusion = "开户申请已通过审核（Approved）。";
  }
  return {
    id: app.id || "",
    reviewStatus,
    executionStatus: app.executionStatus || "",
    createdAt: app.createdAt || "",
    updatedAt: app.updatedAt || "",
    canceledAt,
    isCanceled,
    products: (app.products || []).map((p) => ({
      id: p.id,
      name: p.name || p.id,
      type: p.type || "checking"
    })),
    tags,
    tagDetails,
    primaryConclusion,
    failedEligibilityCheck: !!app.failedEligibilityCheck
  };
}

function interpretGraphql(json) {
  if (!json || typeof json !== "object") {
    return { ok: false, status: 502, error: "INVALID_JSON", message: "Alliant 页面返回了无法解析的结果。" };
  }
  if (Array.isArray(json.errors)) {
    const unauth = json.errors.some((e) =>
      (e.extensions && e.extensions.code === "UNAUTHENTICATED") ||
      (e.message && /not logged in/i.test(e.message))
    );
    if (unauth) {
      return {
        ok: false,
        status: 401,
        error: "UNAUTHENTICATED",
        message: "Alliant CU 登录已过期。请回到官网重新登录后再分析。"
      };
    }
    return {
      ok: false,
      status: 400,
      error: "GRAPHQL_ERROR",
      message: "Alliant 接口提示: " + json.errors.map((e) => e.message).filter(Boolean).join("; ")
    };
  }
  return { ok: true, data: json.data || {} };
}

async function findAlliantTab() {
  const tabs = await chrome.tabs.query({ url: `${ALLIANT_ORIGIN}/*` });
  return tabs.find((tab) => tab.id && tab.url && !tab.url.includes("/login")) || tabs.find((tab) => tab.id) || null;
}

async function runInAlliantPage(operation) {
  const tab = await findAlliantTab();
  if (!tab) {
    return {
      ok: false,
      status: 400,
      error: "NO_LOGIN_TAB",
      message: "请先打开并登录 open.alliantcreditunion.com，再回到插件操作。"
    };
  }
  const query = operation.action === "cancel"
    ? ALLIANT_CANCEL_MUTATION
    : ALLIANT_APPLICATIONS_QUERY;
  let injected;
  try {
    injected = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      injectImmediately: true,
      args: [operation, query],
      func: async (op, documentText) => {
        const body = op.action === "cancel"
          ? {
              operationName: "CancelApplication",
              variables: { applicationId: op.applicationId },
              query: documentText
            }
          : {
              operationName: "GetApplications",
              query: documentText
            };
        const response = await fetch("/graphql", {
          method: "POST",
          credentials: "include",
          headers: {
            "content-type": "application/json",
            accept: "application/json",
            "apollo-require-preflight": "true"
          },
          body: JSON.stringify(body)
        });
        const text = await response.text();
        let json = null;
        try { json = JSON.parse(text); } catch (_) {}
        return {
          httpStatus: response.status,
          json,
          preview: json ? "" : text.slice(0, 180)
        };
      }
    });
  } catch (err) {
    return { ok: false, status: 500, error: "PAGE_INJECT_FAILED", message: "无法在 Alliant 页面执行请求: " + err.message };
  }
  const result = injected && injected[0] && injected[0].result;
  if (!result) return { ok: false, status: 502, error: "EMPTY_PAGE_RESULT", message: "Alliant 页面没有返回结果。" };
  if (!result.json) {
    if (/just a moment|cf-mitigated/i.test(result.preview || "")) {
      return { ok: false, status: 403, error: "CLOUDFLARE_BLOCKED", message: "页面触发了人机验证。请在官网标签页完成验证后重试。" };
    }
    return { ok: false, status: 502, error: "INVALID_JSON", message: "Alliant 页面返回非 JSON 响应。" };
  }
  const parsed = interpretGraphql(result.json);
  if (!parsed.ok) return parsed;
  if (operation.action === "cancel") {
    const message = JSON.stringify(result.json.errors || result.json);
    if (/canceled application/i.test(message)) {
      return {
        ok: true,
        alreadyCanceled: true,
        applicationId: operation.applicationId,
        message: "该申请此前已经取消，无需再次取消。"
      };
    }
    const applicationId = parsed.data.cancelApplication && parsed.data.cancelApplication.applicationId;
    if (!applicationId) {
      return { ok: false, status: 400, error: "CANCEL_FAILED", message: "Alliant CU 未返回取消确认。" };
    }
    return { ok: true, applicationId, message: "申请单已成功撤销关闭！" };
  }
  const apps = (parsed.data.applications || []).map(parseApplication).filter(Boolean);
  const user = parsed.data.user || null;
  return {
    ok: true,
    applications: apps,
    accountKey: user && user.id ? `user:${user.id}` : (apps[0] && apps[0].id ? `app:${apps[0].id}` : ""),
    user: user ? { id: user.id, name: `${user.firstName || ""} ${user.lastName || ""}`.trim() } : null,
    message: apps.length ? "" : "当前账号下未查询到任何开户申请单。"
  };
}

export async function analyzeAlliantLocally() {
  return runInAlliantPage({ action: "query" });
}

export async function cancelAlliantLocally(applicationId) {
  if (!applicationId) return { ok: false, status: 400, error: "MISSING_APP_ID", message: "缺少申请单 ID，请先分析。" };
  return runInAlliantPage({ action: "cancel", applicationId });
}
