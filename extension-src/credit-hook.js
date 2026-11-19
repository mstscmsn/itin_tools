/**
 * Credit.com signup hook.
 * Injected only after the popup button arms a 5-minute session.
 * The page validator rejects a 9-digit value when startsWith("9") is true.
 */
(function () {
  if (window.__ITIN_CREDIT_HOOK__) return;
  window.__ITIN_CREDIT_HOOK__ = 1;
  if (location.hostname !== "app.credit.com") return;

  const origFetch = window.fetch;
  window.fetch = function (input, init) {
    try {
      const url = typeof input === "string" ? input : input && input.url;
      if (String(url || "").includes("/marketing-services/signup/v3/customer") && init && typeof init.body === "string") {
        init = Object.assign({}, init, { body: init.body.replaceAll("ssn", "itin") });
      }
    } catch (_) {}
    return origFetch.apply(this, arguments);
  };
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__itinUrl = url;
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function (body) {
    if (String(this.__itinUrl || "").includes("/marketing-services/signup/v3/customer") && typeof body === "string") {
      body = body.replaceAll("ssn", "itin");
    }
    return origSend.call(this, body);
  };

  const orig = String.prototype.startsWith;
  function startsWith(search) {
    const value = typeof this === "string" ? this : String(this == null ? "" : this);
    if (search === "9" && value.length === 9 && value.charAt(0) === "9" && /^\d{9}$/.test(value)) {
      return false;
    }
    return orig.apply(this, arguments);
  }
  startsWith.__itin = true;
  String.prototype.startsWith = startsWith;

  function hide() {
    String.prototype.startsWith = orig;
    window.__ITIN_CREDIT_HOOK__ = 0;
    const badge = document.getElementById("itin-credit-badge");
    if (badge) badge.remove();
  }

  function paint() {
    if (!document.documentElement || document.getElementById("itin-credit-badge")) return;
    const el = document.createElement("div");
    el.id = "itin-credit-badge";
    const shadow = el.attachShadow({ mode: "closed" });
    shadow.innerHTML = '<style>.c{position:fixed;top:16px;right:16px;z-index:2147483647;width:260px;padding:12px;border-radius:12px;background:#0f172a;color:#f8fafc;font:13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.t{font-weight:700;color:#86efac}.d{color:#94a3b8;font-size:11px;margin-top:4px}</style><div class="c"><div class="t">Credit.com ITIN hook 已生效</div><div class="d">5 分钟内有效，到期后自动关闭。</div></div>';
    document.documentElement.appendChild(el);
  }
  if (document.body) paint();
  else document.addEventListener("DOMContentLoaded", paint, { once: true });
  setTimeout(hide, 5 * 60 * 1000);
})();
