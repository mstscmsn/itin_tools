(function () {
  if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) return;

  chrome.storage.session.get(["hookSession"], (res) => {
    const session = res && res.hookSession;
    if (!session || (session.feature !== "chaseopen" && session.feature !== "chasepre")) return;
    if (!session.expiresAt || session.expiresAt <= Date.now()) return;
    showLoadingOverlay();
  });

  function showLoadingOverlay() {
    if (document.getElementById("chase-reg-helper-loader-host")) return;

    const isPreCard = window.location.pathname.includes("/application/card");
    const titleText = isPreCard
      ? "正在加载 茶色 信用卡 Pre-Approval 页面"
      : "正在加载 茶色 网银注册页面";
    const descHtml = isPreCard
      ? "正在初始化 ITIN 信用卡 Pre 预审组件资源，预计需要 <strong>6~8 秒</strong> 加载完成，请耐心等待..."
      : "正在初始化注册环境与组件资源，预计需要 <strong>7~8 秒</strong> 跳转到注册页面，请耐心等待...";
    const stepInitText = isPreCard
      ? "正在加载 ITIN 信用卡 Pre 预审模块..."
      : "正在加载核心注册模块...";
    const stepMidText = isPreCard
      ? "正在渲染信用卡 Pre-Approval 表单..."
      : "正在渲染网银注册表单...";

    const host = document.createElement("div");
    host.id = "chase-reg-helper-loader-host";
    const shadow = host.attachShadow({ mode: "closed" });

    shadow.innerHTML = `
      <style>
        .overlay {
          position: fixed;
          inset: 0;
          z-index: 2147483647;
          background: rgba(15, 23, 42, 0.55);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif;
          transition: opacity 0.35s ease;
        }
        .overlay.fade-out {
          opacity: 0;
          pointer-events: none;
        }
        .card {
          background: #ffffff;
          width: 380px;
          max-width: 90vw;
          border-radius: 14px;
          padding: 26px 24px 22px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.22);
          text-align: center;
          color: #0f172a;
        }
        .spinner-wrap {
          position: relative;
          width: 54px;
          height: 54px;
          margin: 0 auto 14px;
        }
        .spinner {
          width: 54px;
          height: 54px;
          border: 4px solid #e2e8f0;
          border-top-color: #117aca;
          border-right-color: #117aca;
          border-radius: 50%;
          animation: spin 0.9s linear infinite;
          box-sizing: border-box;
        }
        .countdown {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 700;
          color: #117aca;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .title {
          font-size: 16px;
          font-weight: 700;
          margin: 0 0 8px;
          color: #0f172a;
        }
        .desc {
          font-size: 13px;
          color: #475569;
          line-height: 1.55;
          margin: 0 0 16px;
        }
        .desc strong {
          color: #117aca;
        }
        .progress-track {
          width: 100%;
          height: 7px;
          background: #e2e8f0;
          border-radius: 999px;
          overflow: hidden;
          margin-bottom: 12px;
        }
        .progress-bar {
          height: 100%;
          width: 4%;
          background: linear-gradient(90deg, #117aca 0%, #059669 100%);
          border-radius: 999px;
          transition: width 0.25s linear;
        }
        .sub-hint {
          font-size: 11.5px;
          color: #94a3b8;
        }
      </style>
      <div class="overlay" id="loader-overlay">
        <div class="card">
          <div class="spinner-wrap">
            <div class="spinner"></div>
            <div class="countdown" id="loader-sec">8s</div>
          </div>
          <h3 class="title">${titleText}</h3>
          <p class="desc">
            ${descHtml}
          </p>
          <div class="progress-track">
            <div class="progress-bar" id="loader-bar"></div>
          </div>
          <div class="sub-hint" id="loader-step">${stepInitText}</div>
        </div>
      </div>
    `;

    const mount = () => {
      if (document.documentElement) {
        document.documentElement.appendChild(host);
      }
    };
    mount();

    const overlayEl = shadow.getElementById("loader-overlay");
    const secEl = shadow.getElementById("loader-sec");
    const barEl = shadow.getElementById("loader-bar");
    const stepEl = shadow.getElementById("loader-step");

    const totalMs = 8000;
    const startTime = Date.now();
    let closed = false;

    function dismiss() {
      if (closed) return;
      closed = true;
      clearInterval(timer);
      if (overlayEl) {
        overlayEl.classList.add("fade-out");
      }
      setTimeout(() => {
        host.remove();
      }, 400);
    }

    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / totalMs) * 100));
      const remainSec = Math.max(1, Math.ceil((totalMs - elapsed) / 1000));

      if (barEl) barEl.style.width = `${pct}%`;
      if (secEl) secEl.textContent = `${remainSec}s`;

      if (elapsed > 5000 && stepEl) {
        stepEl.textContent = "即将完成加载，请稍候...";
      } else if (elapsed > 2500 && stepEl) {
        stepEl.textContent = stepMidText;
      }

      // If page form is already rendered after at least 4.5s, or 8s elapsed, dismiss
      const hasRenderedForm =
        elapsed > 4500 &&
        document.body &&
        document.querySelector(
          "input, button[type='submit'], form, mds-text-input, mds-text-input-secure, mds-button"
        ) !== null;

      if (elapsed >= totalMs || hasRenderedForm) {
        if (barEl) barEl.style.width = "100%";
        if (secEl) secEl.textContent = "✓";
        dismiss();
      }
    }, 200);
  }
})();
