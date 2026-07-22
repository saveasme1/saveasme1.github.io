(() => {
  "use strict";

  const API = "https://app.0-1.co.kr/api/handmade/v1";
  const DOWNLOAD_URL = `${API}/portfolio/pdf`;
  const downloadButton = document.getElementById("portfolioDownload");
  const status = document.getElementById("portfolioStatus");
  const progressPanel = document.getElementById("portfolioProgress");
  const progressBar = document.getElementById("portfolioBar");
  const progressPercent = document.getElementById("portfolioPercent");

  if (!downloadButton) return;

  function showStarted() {
    if (progressPanel) {
      progressPanel.hidden = false;
      progressPanel.classList.remove("is-active", "is-background");
    }
    if (progressBar) progressBar.style.width = "100%";
    if (progressPercent) progressPercent.textContent = "↓";
    if (status) status.textContent = "시스템 다운로드를 시작했습니다. 알림창에서 진행 상태를 확인하세요.";
  }

  function startSystemDownload() {
    let frame = document.getElementById("portfolioDownloadFrame");
    if (!frame) {
      frame = document.createElement("iframe");
      frame.id = "portfolioDownloadFrame";
      frame.name = "portfolioDownloadFrame";
      frame.hidden = true;
      frame.setAttribute("aria-hidden", "true");
      document.body.appendChild(frame);
    }
    const link = document.createElement("a");
    link.href = `${DOWNLOAD_URL}?_=${Date.now()}`;
    link.target = frame.name;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    showStarted();
  }

  downloadButton.addEventListener("click", startSystemDownload);
})();
