chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
  // Side panel behavior is unavailable on unsupported browser versions.
});
