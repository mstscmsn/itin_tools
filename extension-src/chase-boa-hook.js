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
  const isChase = host.endsWith("chase.com");
  const isBofa = host.endsWith("bankofamerica.com");
  if (!isChase && !isBofa) return;

  const isMortgage = /cfgCode=502002/i.test(query) || /homelending|gettingStarted/i.test(location.href);
  const isCard = /cfgCode=PREAPPROVEDCONCC/i.test(query) || path.includes("/application/card");

  function installRequestRewrite(urlPart, from, to) {
    const matches = (input) => String(input || "").includes(urlPart);
    const rewrite = (body) => (typeof body === "string" ? body.replaceAll(from, to) : body);
    const origFetch = window.fetch;
    window.fetch = function (input, init) {
      try {
        const url = typeof input === "string" ? input : input && input.url;
        if (matches(url) && init && typeof init.body === "string") init = Object.assign({}, init, { body: rewrite(init.body) });
      } catch (_) {}
      return origFetch.apply(this, arguments);
    };
    const origSend = XMLHttpRequest.prototype.send;
    const origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (method, url) {
      this.__itinUrl = url;
      return origOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function (body) {
      if (matches(this.__itinUrl)) body = rewrite(body);
      return origSend.call(this, body);
    };
  }

  function installChase() {
    installRequestRewrite(
      "/svc/wr/oao/public/application/capture/ccb/originations/capture-inquiry/app-capture-api/v2/applications",
      "SSN",
      "ITIN"
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

  if (isChase && (isMortgage || isCard || path.includes("/oao/application/"))) installChase();
  if (isBofa) installBofa();

  const badge = isBofa
    ? ["BOA 信用卡 Pre hook 正在生效", "ITIN 校验已接管，请在 5 分钟内完成操作。"]
    : isCard
      ? ["茶色信用卡 Pre hook 正在生效", "ITIN 校验已接管，请在 5 分钟内完成操作。"]
      : ["茶色网银注册 hook 正在生效", "辅助已接管，请在 5 分钟内完成操作。"];
  showHookBadge(badge[0], badge[1]);

  function showHookBadge(title, hint) {
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
})();
