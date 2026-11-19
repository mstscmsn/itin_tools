/**
 * Capital One pre-approval address force-submit hook.
 *
 * The pre-approval page validates a combined address through Google / Smarty /
 * Lob, then writes the (often rewritten or rejected) result into both the
 * step collector and the final application body. This hook leaves the page
 * flow intact and, at send time, replaces those address fields with the
 * address saved in the extension.
 */
(function () {
  const FLAG = "__ITIN_C1_ADDRESS_HOOK__";
  if (window[FLAG]) return;
  window[FLAG] = 1;

  const EVENT = "__ITIN_C1_ADDRESS_EVENT__";
  const SUBMIT_PATH = "/credit-cards/decision-servicing/submit-application";
  const COLLECT_PATH = "/prospects/collect-prospect-engagement";

  const PHYSICAL = {
    line1: "applicantPhysicalAddressLine1",
    line2: "applicantPhysicalAddressLine2",
    city: "applicantPhysicalAddressCity",
    state: "applicantPhysicalAddressFederatedStateCode",
    zip: "applicantPhysicalAddressPostalCode",
    country: "applicantPhysicalAddressAlpha3CountryCode",
    validated: "isApplicantPhysicalAddressValidatedByProcessingClient"
  };
  const MAILING = {
    line1: "applicantMailingAddressLine1",
    line2: "applicantMailingAddressLine2",
    city: "applicantMailingAddressCity",
    state: "applicantMailingAddressFederatedStateCode",
    zip: "applicantMailingAddressPostalCode",
    country: "applicantMailingAddressAlpha3CountryCode",
    validated: "isApplicantMailingAddressValidatedByProcessingClient"
  };
  const PROSPECT = {
    line1: "prospectAddressLine1",
    line2: "prospectAddressLine2",
    city: "prospectCity",
    state: "prospectStateCode",
    zip: "prospectPostalCode",
    validated: "prospectAddressValidated"
  };
  const BUSINESS_COLLECT = {
    line1: "businessAddressLine1",
    line2: "businessAddressLine2",
    city: "businessCity",
    state: "businessStateCode",
    zip: "businessPostalCode"
  };
  const BUSINESS_PHYSICAL = {
    line1: "businessApplicantPhysicalAddressLine1",
    line2: "businessApplicantPhysicalAddressLine2",
    city: "businessApplicantPhysicalAddressCity",
    state: "businessApplicantPhysicalAddressFederatedStateCode",
    zip: "businessApplicantPhysicalAddressPostalCode",
    country: "businessApplicantPhysicalAddressAlpha3CountryCode",
    validated: "isBusinessApplicantPhysicalAddressValidatedByProcessingClient"
  };
  const BUSINESS_MAILING = {
    line1: "businessApplicantMailingAddressLine1",
    line2: "businessApplicantMailingAddressLine2",
    city: "businessApplicantMailingAddressCity",
    state: "businessApplicantMailingAddressFederatedStateCode",
    zip: "businessApplicantMailingAddressPostalCode",
    country: "businessApplicantMailingAddressAlpha3CountryCode"
  };

  let saved = window.__ITIN_C1_ADDRESS__ || null;
  let ready = !!saved;
  const waiting = [];

  function accept(next) {
    if (next && next.enabled !== false && next.line1) {
      saved = next;
      ready = true;
      while (waiting.length) waiting.shift()();
      const address = normalize(saved);
      try {
        if (document.body) showBadge(address);
        else document.addEventListener("DOMContentLoaded", () => showBadge(address), { once: true });
      } catch (_) {}
    }
  }

  accept(saved);
  window.addEventListener(EVENT, (event) => {
    accept(event && event.detail);
  });

  function whenReady() {
    if (ready || saved) return Promise.resolve();
    return new Promise((resolve) => {
      waiting.push(resolve);
      setTimeout(resolve, 1500);
    });
  }

  function urlOf(input) {
    if (typeof input === "string") return input;
    if (input && typeof input.url === "string") return input.url;
    return "";
  }

  function isTarget(url) {
    return url.indexOf(SUBMIT_PATH) !== -1 || url.indexOf(COLLECT_PATH) !== -1;
  }

  function normalize(raw) {
    if (!raw || typeof raw !== "object") return null;
    const line1 = String(raw.line1 || "").trim().slice(0, 40);
    const line2 = String(raw.line2 || "").trim().slice(0, 40);
    const city = String(raw.city || "")
      .replace(/[^a-zA-Z ]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 50);
    const state = String(raw.state || "")
      .trim()
      .toUpperCase()
      .slice(0, 2);
    const zip = String(raw.zip || "").replace(/\D/g, "").slice(0, 5);
    if (!line1 || !city || !/^[A-Z]{2}$/.test(state) || !/^\d{5}$/.test(zip)) return null;
    return {
      line1,
      line2,
      city,
      state,
      zip,
      sameMailing: raw.sameMailing !== false
    };
  }

  function fillBlock(block, keys, address, forceValidated) {
    if (!block || typeof block !== "object" || !address) return false;
    const hasAddress =
      keys.line1 in block ||
      keys.city in block ||
      keys.state in block ||
      keys.zip in block ||
      keys.validated in block;
    if (!hasAddress && !forceValidated) return false;
    block[keys.line1] = address.line1;
    if (keys.line2) block[keys.line2] = address.line2 || "";
    block[keys.city] = address.city;
    block[keys.state] = address.state;
    block[keys.zip] = address.zip;
    if (keys.country) block[keys.country] = "USA";
    if (keys.validated) block[keys.validated] = true;
    return true;
  }

  function patchBody(text, url) {
    const address = normalize(saved);
    if (!address || typeof text !== "string" || !text) return text;
    let body;
    try {
      body = JSON.parse(text);
    } catch (_) {
      return text;
    }
    if (!body || typeof body !== "object") return text;

    let changed = false;
    if (url.indexOf(COLLECT_PATH) !== -1) {
      changed = fillBlock(body, PROSPECT, address, true) || changed;
      changed = fillBlock(body, BUSINESS_COLLECT, address, true) || changed;
    }

    const applicant = body.applicant && typeof body.applicant === "object" ? body.applicant : null;
    if (applicant) {
      if (fillBlock(applicant.physicalAddress, PHYSICAL, address, url.indexOf(SUBMIT_PATH) !== -1)) {
        changed = true;
      }
      const mailing = applicant.mailingAddress;
      const mailingEmpty =
        !mailing ||
        !mailing.applicantMailingAddressLine1 ||
        address.sameMailing;
      if (mailingEmpty && (mailing || url.indexOf(SUBMIT_PATH) !== -1)) {
        if (!applicant.mailingAddress || typeof applicant.mailingAddress !== "object") {
          applicant.mailingAddress = {};
        }
        if (fillBlock(applicant.mailingAddress, MAILING, address, true)) changed = true;
      }
    }

    // Contract field paths can be nested differently across releases. Walk any
    // object that already carries the known address keys.
    const stack = [body];
    const seen = new Set();
    while (stack.length) {
      const node = stack.pop();
      if (!node || typeof node !== "object" || seen.has(node)) continue;
      seen.add(node);
      if (Array.isArray(node)) {
        for (let i = 0; i < node.length; i++) stack.push(node[i]);
        continue;
      }
      if (fillBlock(node, PHYSICAL, address, false)) changed = true;
      if (address.sameMailing && fillBlock(node, MAILING, address, false)) changed = true;
      if (fillBlock(node, PROSPECT, address, false)) changed = true;
      if (fillBlock(node, BUSINESS_COLLECT, address, false)) changed = true;
      if (fillBlock(node, BUSINESS_PHYSICAL, address, false)) changed = true;
      if (address.sameMailing && fillBlock(node, BUSINESS_MAILING, address, false)) changed = true;
      const names = Object.keys(node);
      for (let i = 0; i < names.length; i++) {
        const value = node[names[i]];
        if (value && typeof value === "object") stack.push(value);
      }
    }

    return changed ? JSON.stringify(body) : text;
  }

  function bodyText(body) {
    if (typeof body === "string") return body;
    if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) return body.toString();
    if (typeof Blob !== "undefined" && body instanceof Blob) return null;
    return null;
  }

  function patchInit(init, url) {
    if (!init || typeof init !== "object" || init.body == null) return init;
    const text = bodyText(init.body);
    if (text == null) return init;
    const next = patchBody(text, url);
    if (next === text) return init;
    return Object.assign({}, init, { body: next });
  }

  function showBadge(address) {
    try {
      if (!address || !document.body || document.getElementById("itin-c1-address-badge")) return;
    const host = document.createElement("div");
    host.id = "itin-c1-address-badge";
    host.setAttribute("translate", "no");
    const shadow = host.attachShadow({ mode: "closed" });
    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        .card {
          position: fixed;
          top: 16px;
          right: 16px;
          z-index: 2147483647;
          width: 280px;
          box-sizing: border-box;
          padding: 12px 14px;
          border-radius: 12px;
          background: #0f172a;
          color: #f8fafc;
          font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          box-shadow: 0 12px 32px rgba(15, 23, 42, .35);
        }
        .title { font-weight: 700; color: #86efac; margin-bottom: 4px; }
        .addr { color: #e2e8f0; word-break: break-word; }
        .hint { margin-top: 6px; color: #94a3b8; font-size: 11px; }
      </style>
      <div class="card">
        <div class="title">C1 强制地址 hook 正在生效</div>
        <div class="addr"></div>
        <div class="hint">请在 5 分钟内完成操作。</div>
      </div>`;
    shadow.querySelector(".addr").textContent = [address.line1, address.line2, address.city, address.state, address.zip]
      .filter(Boolean)
      .join(", ");
    (document.documentElement || document.body).appendChild(host);
    } catch (_) {}
  }

  const origFetch = window.fetch;
  if (typeof origFetch === "function") {
    window.fetch = function (input, init) {
      const run = () => {
        try {
          const url = urlOf(input);
          if (isTarget(url)) {
            if (typeof Request !== "undefined" && input instanceof Request) {
              const headers = new Headers(input.headers);
              const method = (init && init.method) || input.method || "GET";
              if (String(method).toUpperCase() !== "GET" && String(method).toUpperCase() !== "HEAD") {
                return input
                  .clone()
                  .text()
                  .then((text) => {
                    const body = patchBody(text, url);
                    const nextInit = Object.assign({}, init || {}, {
                      method,
                      headers,
                      body,
                      credentials: (init && init.credentials) || input.credentials,
                      mode: (init && init.mode) || input.mode,
                      cache: (init && init.cache) || input.cache,
                      redirect: (init && init.redirect) || input.redirect,
                      referrer: (init && init.referrer) || input.referrer,
                      integrity: (init && init.integrity) || input.integrity
                    });
                    return origFetch.call(this, url, nextInit);
                  })
                  .catch(() => origFetch.call(this, input, patchInit(init, url)));
              }
            }
            if (init) init = patchInit(init, url);
          }
        } catch (_) {}
        return origFetch.call(this, input, init);
      };
      try {
        if (isTarget(urlOf(input)) && !saved) return whenReady().then(run);
      } catch (_) {}
      return run();
    };
  }

  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url) {
    try {
      this.__c1Url = String(url || "");
      this.__c1Method = String(method || "GET");
    } catch (_) {}
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function (body) {
    const sendNow = () => {
      let next = body;
      try {
        const url = this.__c1Url || "";
        const method = (this.__c1Method || "GET").toUpperCase();
        if (method !== "GET" && method !== "HEAD" && isTarget(url) && typeof next === "string") {
          next = patchBody(next, url);
        }
      } catch (_) {}
      return origSend.call(this, next);
    };
    try {
      const url = this.__c1Url || "";
      if (isTarget(url) && !saved && typeof body === "string") {
        const xhr = this;
        whenReady().then(() => sendNow.call(xhr));
        return;
      }
    } catch (_) {}
    return sendNow();
  };

  const origSendBeacon = navigator.sendBeacon;
  if (typeof origSendBeacon === "function") {
    navigator.sendBeacon = function (url, data) {
      try {
        const target = String(url || "");
        if (isTarget(target) && typeof data === "string") {
          data = patchBody(data, target);
        }
      } catch (_) {}
      return origSendBeacon.call(this, url, data);
    };
  }
})();
