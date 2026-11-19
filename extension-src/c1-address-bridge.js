/**
 * Isolated-world bridge. The page hook runs in MAIN and cannot read
 * extension storage, so this script forwards the saved address into it.
 * It is registered only while a Capital One session is armed.
 */
(function () {
  const KEY = "c1ForceAddress";
  const EVENT = "__ITIN_C1_ADDRESS_EVENT__";

  function publish(address) {
    if (!address || !address.line1) return;
    window.__ITIN_C1_ADDRESS__ = address;
    window.dispatchEvent(new CustomEvent(EVENT, { detail: address }));
  }

  function read() {
    try {
      chrome.storage.local.get([KEY], (res) => publish(res && res[KEY]));
    } catch (_) {}
  }

  read();
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local" && changes[KEY]) publish(changes[KEY].newValue);
    });
  } catch (_) {}
})();
