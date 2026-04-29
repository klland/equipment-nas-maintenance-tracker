const STORAGE_KEY = "maintenance-tracker-records";

const seedRecords = [
  {
    id: crypto.randomUUID(),
    asset: "NAS-01",
    type: "硬碟/儲存",
    priority: "高",
    summary: "夜間備份失敗，系統提示儲存池容量不足。",
    downtime: 2,
    status: "處理中",
    action: "檢查容量使用率，清理舊版備份，重新規劃保留週期。",
    createdAt: "2026-04-20",
  },
  {
    id: crypto.randomUUID(),
    asset: "Router-01",
    type: "網路連線",
    priority: "中",
    summary: "部分裝置連線不穩，Ping 延遲偶爾升高。",
    downtime: 1,
    status: "已完成",
    action: "調整 Wi-Fi 頻道，重啟 DHCP 租約，確認延遲恢復正常。",
    createdAt: "2026-04-22",
  },
  {
    id: crypto.randomUUID(),
    asset: "NAS-01",
    type: "參數調整",
    priority: "中",
    summary: "大量照片同步時讀寫速度低於預期。",
    downtime: 0.5,
    status: "待處理",
    action: "預計分批測試 SMB 設定、備份排程與網路傳輸瓶頸。",
    createdAt: "2026-04-27",
  },
];

let records = loadRecords();

const form = document.querySelector("#incidentForm");
const list = document.querySelector("#incidentList");
const filterStatus = document.querySelector("#filterStatus");
const typeChart = document.querySelector("#typeChart");

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const data = new FormData(form);
  const record = {
    id: crypto.randomUUID(),
    asset: data.get("asset"),
    type: data.get("type"),
    priority: data.get("priority"),
    summary: data.get("summary").trim(),
    downtime: Number(data.get("downtime")),
    status: data.get("status"),
    action: data.get("action").trim(),
    createdAt: new Date().toISOString().slice(0, 10),
  };

  records = [record, ...records];
  persist();
  form.reset();
  render();
});

filterStatus.addEventListener("change", render);

function loadRecords() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return seedRecords;

  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : seedRecords;
  } catch {
    return seedRecords;
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function render() {
  renderMetrics();
  renderList();
  renderChart();
}

function renderMetrics() {
  const openRecords = records.filter((record) => record.status !== "已完成");
  const doneRecords = records.filter((record) => record.status === "已完成");
  const highPriority = records.filter((record) => record.priority === "高");
  const avgDowntime = records.length
    ? records.reduce((sum, record) => sum + record.downtime, 0) / records.length
    : 0;

  document.querySelector("#openCount").textContent = openRecords.length;
  document.querySelector("#avgDowntime").textContent = `${formatNumber(avgDowntime)}h`;
  document.querySelector("#doneCount").textContent = doneRecords.length;
  document.querySelector("#highPriorityCount").textContent = highPriority.length;
}

function renderList() {
  const selectedStatus = filterStatus.value;
  const visibleRecords =
    selectedStatus === "全部"
      ? records
      : records.filter((record) => record.status === selectedStatus);

  if (visibleRecords.length === 0) {
    list.innerHTML = `<p class="incident-action">目前沒有符合條件的紀錄。</p>`;
    return;
  }

  list.innerHTML = visibleRecords.map(renderIncidentCard).join("");

  document.querySelectorAll("[data-status-id]").forEach((button) => {
    button.addEventListener("click", () => {
      updateStatus(button.dataset.statusId, button.dataset.nextStatus);
    });
  });
}

function renderIncidentCard(record) {
  const priorityClass = record.priority === "高" ? "high" : record.priority === "中" ? "medium" : "";
  const statusClass = record.status === "已完成" ? "done" : "";

  return `
    <article class="incident-card">
      <div class="incident-top">
        <div>
          <p class="asset-name">${escapeHtml(record.asset)}</p>
          <p class="incident-summary">${escapeHtml(record.summary)}</p>
        </div>
        <span class="tag ${statusClass}">${escapeHtml(record.status)}</span>
      </div>
      <div class="incident-meta">
        <span class="tag">${escapeHtml(record.type)}</span>
        <span class="tag ${priorityClass}">優先級 ${escapeHtml(record.priority)}</span>
        <span class="tag">停機 ${formatNumber(record.downtime)}h</span>
        <span class="tag">${escapeHtml(record.createdAt)}</span>
      </div>
      <p class="incident-action">${escapeHtml(record.action)}</p>
      <div class="status-actions" aria-label="更新狀態">
        ${["待處理", "處理中", "已完成"]
          .map(
            (status) => `
              <button class="status-button ${record.status === status ? "active" : ""}" type="button" data-status-id="${record.id}" data-next-status="${status}">
                ${status}
              </button>
            `,
          )
          .join("")}
      </div>
    </article>
  `;
}

function updateStatus(id, nextStatus) {
  records = records.map((record) =>
    record.id === id ? { ...record, status: nextStatus } : record,
  );
  persist();
  render();
}

function renderChart() {
  const counts = records.reduce((result, record) => {
    result[record.type] = (result[record.type] || 0) + 1;
    return result;
  }, {});
  const max = Math.max(...Object.values(counts), 1);

  typeChart.innerHTML = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => {
      const width = Math.round((count / max) * 100);
      return `
        <div class="bar-row">
          <div class="bar-label">
            <span>${escapeHtml(type)}</span>
            <span>${count} 件</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width: ${width}%"></div>
          </div>
        </div>
      `;
    })
    .join("");
}

function formatNumber(value) {
  return Number.isInteger(value) ? value : value.toFixed(1);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

render();
