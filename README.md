# ITIN tools (v2.2.0 · 纯本地开源免费版)

**ITIN tools** 是一款核心纯本地运行、永久免费开源的 Chrome / Edge 浏览器辅助扩展，专为仅有 **ITIN**（个人纳税人识别号）的美卡玩家打造。

- **开源仓库**：[https://github.com/mstscmsn/itin_tools](https://github.com/mstscmsn/itin_tools)
- **官方网站**：[https://itin.nranote.com](https://itin.nranote.com)
- **美卡交流 Telegram 群（免费）**：[https://t.me/uscloudnra](https://t.me/uscloudnra) (`@uscloudnra`)
- **美卡云居民 VIP 群（20 USD / 年）**：添加机器人 **[@uscloudvipbot](https://t.me/uscloudvipbot)** 自助加群，分享更多美卡实战经验、高阶骚操作与风控技巧

自 `v2.1.0` 起，本工具已彻底改为**纯本地、纯免费开源版本**；`v2.2.0` 新增**茶色有卡版网银注册（MITM + 弹窗提醒）**并恢复**只读一键在线更新**：
- **无授权/无指纹/无付费**：无任何授权校验、设备指纹采集、付费及云端额度接口。
- **零隐私泄露**：所有页面辅助钩子、MITM 请求改写与 Alliant 分析查询均在您的浏览器本地执行，不读取、不记录、不上传任何表单敏感信息或 Cookie。
- **只读在线一键更新**：服务端仅保留静态更新分发功能；打开插件仅发起只读版本检查，点击「立即更新」后在本地自动解压覆盖扩展目录并重载。
- **社区交流**：在每次运行辅助脚本前会友好弹窗推荐加入 Telegram 美卡交流群及 VIP 群（可按需勾选不再提示）。

---

## 核心功能（6 大本地通道 · 含茶色双模式网银注册）

1. **茶色网银在线注册（双模式：空网银 + 有卡版网银）** (`chase-boa-hook.js` + `content-chase-loader.js`)
   - 点击「开始注册 茶色 网银」后弹窗选择模式：
     - **空网银（现有功能）**：适合未持卡用户，0 Hard Pull 通过房贷通道建立网银 Profile，自动兼容 `9` 开头 ITIN 格式并放行相关跳过逻辑。
     - **有卡版网银（v2.2.0 新增）**：适合已持有 Chase 信用卡/借记卡用户，启动前弹窗提醒操作注意事项，跳转至 `https://secure.chase.com/web/auth/enrollment#/enroll/onlineEnrollment/gettingStarted/index?LOB=`，并在本地执行 MITM——当请求 URL 包含 `svc/wl/auth/public/v4/user/enrollment/form/list` 时自动执行 `body.replace("ssn", "tin")`，页面右上角同步展示实时状态提醒徽章。
2. **茶色信用卡 Pre-Approval** (`chase-boa-hook.js` + `content-chase-loader.js`)
   - 一键打开官方 Pre-Approval 页面，提交查询请求时本地将 `SSN` 类型字段转换为 `ITIN`。
3. **BOA 信用卡 Pre-Approval** (`chase-boa-hook.js`)
   - 内置 6 张 Bank of America 热门信用卡预审直达入口，在本地接管 `#ssnNumber` 校验监听，放行 `9` 开头 9 位 ITIN 输入。
4. **Credit.com ITIN 注册** (`credit-hook.js`)
   - 在 `app.credit.com/sign-up` 本地放行 `9` 开头 9 位数字检验，并在提交注册请求时将类型转换为 `itin`。
5. **Capital One 强制地址** (`c1-address-hook.js` + `c1-address-bridge.js`)
   - 在本地保存标准 USPS 地址（`chrome.storage.local`），在个人卡 / 企业卡预审提交时直接覆盖请求体内的地址字段，避免被 Google / Smarty / Lob 强行改写。
6. **Alliant CU 拒件分析与取消** (`alliant-local.js`)
   - 直接在您已登录的 `open.alliantcreditunion.com` 页面标签内发起本地 GraphQL 查询，解析风控评估标签（如 `SSN Warning`、`Denied Fraud`、`Address Warning` 等）与对应建议，并支持页内直接撤销申请。无限次免费使用，登录状态不会离开浏览器。

---

## 本地安装方法（Chrome / Edge）

### 方式一：直接下载离线压缩包
1. 前往 [GitHub Releases](https://github.com/mstscmsn/itin_tools/releases) 或官网 [https://itin.nranote.com](https://itin.nranote.com) 下载 `itin-tools.zip` 并解压。
2. 打开浏览器扩展管理页：`chrome://extensions/`（Edge 为 `edge://extensions/`）。
3. 开启右上角 **「开发者模式」**。
4. 点击 **「加载已解压的扩展程序」**，选择解压出来的文件夹即可使用。

### 方式二：从源码直接加载
1. 克隆本仓库：`git clone https://github.com/mstscmsn/itin_tools.git`
2. 在扩展管理页开启 **「开发者模式」**，直接加载仓库中的 `extension-src/` 目录即可。

### 在线一键更新（v2.2.0 起恢复）
- 打开插件弹窗时自动向官网 `https://itin.nranote.com/api/extension/latest` 发起只读版本检查；如有新版，顶部会出现黄色更新提示条。
- 点击 **「立即更新」** 并授权选择本插件根目录，插件会在本地下载官方 zip 并解压覆盖完成更新（之后同一浏览器的后续更新无需再次选目录）。

---

## 目录说明

- `extension-src/`：纯源码扩展目录（核心开源代码，未混淆、无加密）。
  - `manifest.json`：MV3 扩展配置（仅申请目标银行/信用站点权限）。
  - `background.js`：Service Worker，管理本地 DNR 去 CSP 规则与 5 分钟自动失效的内容脚本会话。
  - `popup.html` / `popup.css` / `popup.js`：扩展弹窗界面、茶色网银双模式与有卡版提醒弹窗、TG 推荐弹窗、在线更新提示条。
  - `updater.js` + `vendor/jszip.min.js`：跨平台未打包扩展目录在线一键更新模块（仅只读查询更新清单与下载官网离线包）。
  - `chase-boa-hook.js` / `content-chase-loader.js`：Chase & BOA 本地页面钩子与加载提示。
  - `credit-hook.js`：Credit.com 本地注册钩子。
  - `c1-address-hook.js` / `c1-address-bridge.js`：Capital One 本地强制地址注入与桥接。
  - `alliant-local.js`：Alliant CU 纯本地 GraphQL 分析与取消模块。
- `pack-extension.js`：语法校验、安全审计（确认无远程授权/上传代码）并打包生成 `itin-tools.zip` 与同步本地测试/分发目录。
- `server/public/`：纯静态官网介绍页（`index.html` 与图文预览素材）。

---

## 本地打包校验脚本

```bash
node pack-extension.js
```

执行后会校验 `extension-src/*.js` 语法、执行无远端请求/无指纹审计，并生成 `extension/` 目录及 `itin-tools.zip`。

---

## 社区与交流

- **美卡交流 Telegram 群（免费）**：[https://t.me/uscloudnra](https://t.me/uscloudnra) (`@uscloudnra`) — 开源插件日常讨论与基础答疑
- **美卡云居民 VIP 群（20 USD / 年）**：添加 Telegram 机器人 **[@uscloudvipbot](https://t.me/uscloudvipbot)** 自助加群 — 分享更多美卡实战经验、独家骚操作、下卡路子与风控应对技巧
- **作者 X**：[https://x.com/silence_3650](https://x.com/silence_3650)
- **美国租房合同生成器**：[https://lease.nranote.com](https://lease.nranote.com)

> **免责声明**：本工具为独立第三方开源客户端辅助脚本，与摩根大通、美国银行、Capital One、Credit.com 及 Alliant Credit Union 无任何关联。用户应确保所填写信息真实合法，本工具不对实际开户或审批结果作任何担保。
