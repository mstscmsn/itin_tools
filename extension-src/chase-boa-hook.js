/**
 * Plain in-page hooks for the local Chase/BOA flows (100% local & open source).
 * Installed only while the extension has armed a session.
 */
(function () {
  const FLAG = "__ITIN_LOCAL_HOOKS__";
  if (window[FLAG]) return;
  window[FLAG] = 1;

  const host = location.hostname || "";
  const path = location.pathname || "";
  const query = location.search || "";
  const href = location.href || "";
  const isChase = host.endsWith("chase.com");
  const isBofa = host.endsWith("bankofamerica.com");
  if (!isChase && !isBofa) return;

  const isEnroll = path.includes("/web/auth/enrollment") || /onlineEnrollment/i.test(href);
  const isCard = /cfgCode=PREAPPROVEDCONCC/i.test(query) || path.includes("/application/card");
  const isMortgage =
    !isEnroll && (/cfgCode=502002/i.test(query) || /homelending|origination\/gettingStarted/i.test(href));

  function installRequestRewrite(urlPart, transformBody, onRewrite) {
    const matches = (input) => String(input || "").includes(urlPart);
    const applyTransform = (raw, url) => {
      const next = transformBody(raw, url);
      if (next !== raw && typeof onRewrite === "function") {
        try {
          onRewrite(url);
        } catch (_) {}
      }
      return next;
    };
    const rewrite = (body, url) => {
      if (typeof body === "string") return applyTransform(body, url);
      if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) {
        const raw = body.toString();
        const next = applyTransform(raw, url);
        return next !== raw ? new URLSearchParams(next) : body;
      }
      return body;
    };

    const origFetch = window.fetch;
    window.fetch = function (input, init) {
      try {
        const url = typeof input === "string" ? input : input && input.url;
        if (matches(url)) {
          if (
            init &&
            init.body != null &&
            (typeof init.body === "string" ||
              (typeof URLSearchParams !== "undefined" && init.body instanceof URLSearchParams))
          ) {
            const nextInit = Object.assign({}, init, { body: rewrite(init.body, url) });
            return origFetch.call(this, input, nextInit);
          }
          if (typeof Request !== "undefined" && input instanceof Request && (!init || init.body == null)) {
            return input
              .clone()
              .text()
              .then((rawBody) => {
                const nextBody = applyTransform(rawBody, url);
                const headers = new Headers(input.headers);
                if (init && init.headers) {
                  new Headers(init.headers).forEach((v, k) => headers.set(k, v));
                }
                const nextInit = Object.assign({}, init || {}, {
                  method: (init && init.method) || input.method,
                  headers,
                  body: nextBody,
                  credentials: (init && init.credentials) || input.credentials,
                  mode: (init && init.mode) || input.mode
                });
                return origFetch.call(this, url, nextInit);
              });
          }
        }
      } catch (_) {}
      return origFetch.apply(this, arguments);
    };

    const origSend = XMLHttpRequest.prototype.send;
    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
      this.__itinMethod = method;
      this.__itinUrl = url;
      return origOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function (body) {
      try {
        if (matches(this.__itinUrl)) body = rewrite(body, this.__itinUrl);
      } catch (_) {}
      return origSend.call(this, body);
    };
  }

  let badgeStatusUpdater = null;

  function installChase() {
    installRequestRewrite(
      "/svc/wr/oao/public/application/capture/ccb/originations/capture-inquiry/app-capture-api/v2/applications",
      (body) => body.replaceAll("SSN", "ITIN")
    );
    const origParseInt = window.parseInt;
    window.parseInt = function (value, radix) {
      const text = typeof value === "string" ? value : String(value == null ? "" : value);
      if (/^9\d{2}$/.test(text)) return 888;
      return origParseInt.apply(this, arguments);
    };

    if (isMortgage) {
      try {
        Object.defineProperty(Function.prototype, "shouldSkip", {
          configurable: true,
          enumerable: false,
          get() {
            return this.__itinSkip;
          },
          set(fn) {
            const owner = this;
            if (typeof fn !== "function") {
              this.__itinSkip = fn;
              return;
            }
            const source = Function.prototype.toString.call(owner);
            const wrapped = function (event, ctx) {
              const route = ctx && ctx.route ? String(ctx.route) : "";
              if (/Authorizations|applicantAccountHolderRelationshipTypeCode/i.test(route + "\n" + source)) {
                return true;
              }
              return fn.apply(this, arguments);
            };
            this.__itinSkip = wrapped;
          }
        });
      } catch (_) {}
    }
  }

  function modifyEnrollRequestBody(args) {
    const { body } = args;
    return body.replace("ssn", "tin");
  }

  function installChaseEnroll() {
    installRequestRewrite(
      "svc/wl/auth/public/v4/user/enrollment/form/list",
      (body, url) => modifyEnrollRequestBody({ url, body }),
      () => {
        if (typeof badgeStatusUpdater === "function") {
          badgeStatusUpdater("intercepted", "✅ 已拦截 form/list，成功将 ssn 替换为 tin！");
        } else {
          window.__ITIN_ENROLL_INTERCEPTED__ = true;
        }
      }
    );
  }

  function installBofa() {
    const SELECTOR_ID = "ssnNumber";
    const MARK = "__bofaItinChangeWrapped";
    const origAdd = EventTarget.prototype.addEventListener;
    const origRemove = EventTarget.prototype.removeEventListener;
    const wrappers = new WeakMap();

    function isSsnInput(el) {
      if (!el) return false;
      const id = el.id || (el.getAttribute && el.getAttribute("id"));
      return id === SELECTOR_ID;
    }

    function wrapValidator(original) {
      if (wrappers.has(original)) return wrappers.get(original);
      function wrapped(event) {
        const input = this;
        const raw = String((input && input.value) || "");
        const digits = raw.replace(/\D/g, "");
        if (!(digits.length === 9 && digits.startsWith("9"))) {
          return original.call(this, event);
        }
        const fake = String(raw).replace(/\d/, "8");
        const targetProxy = new Proxy(event.target || input, {
          get(target, property, receiver) {
            if (property === "value") return fake;
            const value = Reflect.get(target, property, receiver);
            return typeof value === "function" ? value.bind(target) : value;
          }
        });
        const eventProxy = new Proxy(event, {
          get(target, property, receiver) {
            if (property === "target" || property === "currentTarget" || property === "srcElement") {
              return targetProxy;
            }
            const value = Reflect.get(target, property, receiver);
            return typeof value === "function" ? value.bind(target) : value;
          }
        });
        return original.call(this, eventProxy);
      }
      wrappers.set(original, wrapped);
      wrappers.set(wrapped, wrapped);
      return wrapped;
    }

    EventTarget.prototype.addEventListener = function (type, listener, options) {
      if (
        type === "change" &&
        isSsnInput(this) &&
        typeof listener === "function" &&
        Function.prototype.toString.call(listener).includes("validateSocialSecurityNumber")
      ) {
        this[MARK] = true;
        return origAdd.call(this, type, wrapValidator(listener), options);
      }
      return origAdd.call(this, type, listener, options);
    };

    EventTarget.prototype.removeEventListener = function (type, listener, options) {
      const wrapped = wrappers.get(listener);
      if (type === "change" && wrapped && wrapped !== listener) {
        return origRemove.call(this, type, wrapped, options);
      }
      return origRemove.call(this, type, listener, options);
    };
  }

  if (isChase && isEnroll) {
    installChaseEnroll();
  } else if (isChase && (isMortgage || isCard || path.includes("/oao/application/"))) {
    installChase();
  }
  if (isBofa) installBofa();

  if (isEnroll) {
    showEnrollHookBadge();
  } else {
    const badge = isBofa
      ? ["BOA 信用卡 Pre hook 正在生效", "ITIN 校验已接管，请在 5 分钟内完成操作。"]
      : isCard
        ? ["茶色信用卡 Pre hook 正在生效", "ITIN 校验已接管，请在 5 分钟内完成操作。"]
        : ["茶色空网银注册 hook 正在生效", "辅助已接管，请在 5 分钟内完成操作。"];
    showHookBadge(badge[0], badge[1]);
  }

  function showHookBadge(title, hint) {
    if (window.top !== window) return;
    const paint = () => {
      if (!document.body || document.getElementById("itin-hook-badge")) return;
      const host = document.createElement("div");
      host.id = "itin-hook-badge";
      const shadow = host.attachShadow({ mode: "closed" });
      shadow.innerHTML = `
        <style>
          .card { position: fixed; top: 16px; right: 16px; z-index: 2147483647; width: 260px; padding: 12px 14px; border-radius: 12px; background: #0f172a; color: #f8fafc; font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; box-shadow: 0 12px 32px rgba(15,23,42,.35); }
          .title { font-weight: 700; color: #86efac; margin-bottom: 4px; }
          .hint { color: #94a3b8; font-size: 11px; }
        </style>
        <div class="card"><div class="title"></div><div class="hint"></div></div>`;
      shadow.querySelector(".title").textContent = title;
      shadow.querySelector(".hint").textContent = hint;
      document.documentElement.appendChild(host);
    };
    if (document.body) paint();
    else document.addEventListener("DOMContentLoaded", paint, { once: true });
  }

  function showEnrollHookBadge() {
    if (window.top !== window) return;
    const paint = () => {
      if (!document.body || document.getElementById("itin-hook-badge")) return;
      const host = document.createElement("div");
      host.id = "itin-hook-badge";
      host.dataset.mitmStatus = window.__ITIN_ENROLL_INTERCEPTED__ ? "intercepted" : "listening";
      const shadow = host.attachShadow({ mode: "closed" });
      shadow.innerHTML = `
        <style>
          .card { position: fixed; top: 16px; right: 16px; z-index: 2147483647; width: 296px; padding: 12px 14px; border-radius: 12px; background: #0f172a; color: #f8fafc; border: 1px solid rgba(134,239,172,.35); font: 12.5px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", sans-serif; box-shadow: 0 14px 34px rgba(15,23,42,.42); }
          .card.min .body, .card.min .status { display: none; }
          .top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
          .title { font-weight: 700; color: #86efac; font-size: 13px; }
          .close { border: 0; background: rgba(255,255,255,.1); color: #cbd5e1; border-radius: 6px; padding: 1px 6px; font-size: 11px; cursor: pointer; }
          .close:hover { background: rgba(255,255,255,.2); color: #fff; }
          .body { margin-top: 6px; padding: 7px 9px; border-radius: 8px; background: rgba(245,158,11,.14); border: 1px solid rgba(251,191,36,.35); color: #fef3c7; font-size: 11px; line-height: 1.5; }
          .body code { background: rgba(15,23,42,.55); color: #93c5fd; padding: 0 4px; border-radius: 4px; font-family: ui-monospace, monospace; }
          .status { margin-top: 7px; padding: 5px 8px; border-radius: 7px; background: rgba(56,189,248,.14); color: #bae6fd; font-size: 11px; font-weight: 600; }
          .status.done { background: rgba(16,185,129,.22); color: #86efac; }
        </style>
        <div class="card">
          <div class="top">
            <div class="title">🟢 茶色有卡版网银 MITM 已生效</div>
            <button class="close" type="button" title="收起/关闭提醒">✕</button>
          </div>
          <div class="body">
            <div>• 仅限<strong>已持有 Chase 卡</strong>用户使用</div>
            <div>• 在 SSN 栏直接填入 <strong>9 位 ITIN</strong></div>
            <div>• 提交 <code>form/list</code> 时自动将 <code>ssn → tin</code>（5 分钟内有效）</div>
          </div>
          <div class="status" id="enroll-status">⏳ 正在监听 .../enrollment/form/list</div>
        </div>`;

      const cardEl = shadow.querySelector(".card");
      const closeBtn = shadow.querySelector(".close");
      const statusEl = shadow.getElementById("enroll-status");
      if (closeBtn && cardEl) {
        closeBtn.addEventListener("click", () => {
          cardEl.classList.toggle("min");
          closeBtn.textContent = cardEl.classList.contains("min") ? "展开" : "✕";
        });
      }

      badgeStatusUpdater = (state, msg) => {
        host.dataset.mitmStatus = state;
        if (statusEl) {
          statusEl.textContent = msg;
          if (state === "intercepted") statusEl.classList.add("done");
        }
      };

      if (window.__ITIN_ENROLL_INTERCEPTED__) {
        badgeStatusUpdater("intercepted", "✅ 已拦截 form/list，成功将 ssn 替换为 tin！");
      }

      document.documentElement.appendChild(host);
    };
    if (document.body) paint();
    else document.addEventListener("DOMContentLoaded", paint, { once: true });
  }
})();
