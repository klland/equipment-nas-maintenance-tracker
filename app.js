const STORAGE_KEY = "nas-network-maintenance-v2";

const state = loadState();

const sopTemplates = [
  {
    title: "NAS 無法登入",
    steps: ["確認電源與網路燈號", "嘗試開啟管理頁", "確認 IP 是否變更", "檢查 Router DHCP 清單", "記錄原因並安排復歸確認"],
  },
  {
    title: "備份失敗",
    steps: ["確認備份排程時間", "檢查容量使用率", "確認目標資料夾權限", "重新執行一次備份", "記錄是否需要調整保留週期"],
  },
  {
    title: "硬碟 / RAID 警告",
    steps: ["登入 NAS 管理頁", "查看 SMART / RAID 狀態", "確認是否有壞軌或降級", "備份重要資料", "規劃更換硬碟與復歸驗證"],
  },
  {
    title: "Wi-Fi / Router 不穩",
    steps: ["確認是否單一設備或全部設備受影響", "檢查 WAN / LAN 燈號", "確認頻道與干擾", "重啟服務或設備", "記錄復發時間與可能根因"],
  },
];

const elements = {
  deviceCount: document.querySelector("#deviceCount"),
  attentionCount: document.querySelector("#attentionCount"),
  openIssueCount: document.querySelector("#openIssueCount"),
  lastInspection: document.querySelector("#lastInspection"),
  probeList: document.querySelector("#probeList"),
  riskList: document.querySelector("#riskList"),
  recentInspections: document.querySelector("#recentInspections"),
  issueChart: document.querySelector("#issueChart"),
  deviceForm: document.querySelector("#deviceForm"),
  deviceFormTitle: document.querySelector("#deviceFormTitle"),
  cancelEditDevice: document.querySelector("#cancelEditDevice"),
  quickInspectionForm: document.querySelector("#quickInspectionForm"),
  quickInspectionDevice: document.querySelector("#quickInspectionDevice"),
  deviceList: document.querySelector("#deviceList"),
  deviceFilter: document.querySelector("#deviceFilter"),
  inspectionForm: document.querySelector("#inspectionForm"),
  inspectionDevice: document.querySelector("#inspectionDevice"),
  inspectionTable: document.querySelector("#inspectionTable"),
  issueForm: document.querySelector("#issueForm"),
  issueDevice: document.querySelector("#issueDevice"),
  issueList: document.querySelector("#issueList"),
  issueFilter: document.querySelector("#issueFilter"),
  sopList: document.querySelector("#sopList"),
  checkAll: document.querySelector("#checkAll"),
  exportData: document.querySelector("#exportData"),
  importData: document.querySelector("#importData"),
};

document.querySelectorAll("[data-tab]").forEach((button) => {
  button.addEventListener("click", () => setActiveTab(button.dataset.tab));
});

elements.deviceForm.addEventListener("submit", saveDevice);
elements.cancelEditDevice.addEventListener("click", resetDeviceForm);
elements.quickInspectionForm.addEventListener("submit", saveQuickInspection);
elements.deviceFilter.addEventListener("change", render);
elements.inspectionForm.addEventListener("submit", saveInspection);
elements.issueForm.addEventListener("submit", saveIssue);
elements.issueFilter.addEventListener("change", render);
elements.checkAll.addEventListener("click", checkAllDevices);
elements.exportData.addEventListener("click", exportData);
elements.importData.addEventListener("change", importData);

function defaultState() {
  return {
    devices: [
      {
        id: createId(),
        name: "NAS-01",
        type: "NAS",
        criticality: "高",
        ip: "192.168.1.10",
        location: "書房",
        url: "http://192.168.1.10:5000",
        note: "照片備份、Time Machine、檔案共享",
        status: "注意",
        lastProbe: null,
      },
      {
        id: createId(),
        name: "Router-01",
        type: "Router",
        criticality: "高",
        ip: "192.168.1.1",
        location: "客廳弱電箱",
        url: "http://192.168.1.1",
        note: "主要網路出口與 DHCP",
        status: "未巡檢",
        lastProbe: null,
      },
      {
        id: createId(),
        name: "UPS-01",
        type: "UPS",
        criticality: "中",
        ip: "-",
        location: "書房",
        url: "",
        note: "NAS 與 Router 備援電源，需手動確認電池狀態",
        status: "未巡檢",
        lastProbe: null,
      },
    ],
    inspections: [
      {
        id: createId(),
        deviceId: "",
        date: "2026-04-29",
        capacity: 78,
        temperature: 41,
        backupStatus: "成功",
        diskStatus: "正常",
        checks: ["管理頁可登入", "電源/線材正常", "備份排程確認"],
        result: "注意",
        note: "容量接近 80%，先調整備份保留週期，下週追蹤。",
      },
    ],
    issues: [],
  };
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return hydrateDefault();
  try {
    const parsed = JSON.parse(saved);
    return normalizeState(parsed);
  } catch {
    return hydrateDefault();
  }
}

function hydrateDefault() {
  const data = defaultState();
  data.inspections[0].deviceId = data.devices[0].id;
  data.issues = [
    {
      id: createId(),
      deviceId: data.devices[0].id,
      title: "NAS 容量偏高，可能影響備份",
      type: "容量",
      priority: "中",
      status: "處理中",
      cause: "備份保留版本過多，容量使用率接近警戒值。",
      action: "調整保留週期，完成後觀察下一次備份是否正常。",
      createdAt: "2026-04-29",
    },
  ];
  return data;
}

function normalizeState(data) {
  return {
    devices: Array.isArray(data.devices) ? data.devices : [],
    inspections: Array.isArray(data.inspections) ? data.inspections : [],
    issues: Array.isArray(data.issues) ? data.issues : [],
  };
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function saveDevice(event) {
  event.preventDefault();
  const form = new FormData(elements.deviceForm);
  const id = form.get("id") || createId();
  const existing = state.devices.find((device) => device.id === id);
  const device = {
    id,
    name: text(form.get("name")),
    type: text(form.get("type")),
    criticality: text(form.get("criticality")),
    ip: text(form.get("ip")),
    location: text(form.get("location")),
    url: text(form.get("url")),
    note: text(form.get("note")),
    status: existing?.status || "未巡檢",
    lastProbe: existing?.lastProbe || null,
  };

  if (!isValidIpOrDash(device.ip)) {
    alert("IP 格式請填 IPv4，例如 192.168.1.10；若無 IP 可填 -");
    return;
  }

  state.devices = existing
    ? state.devices.map((item) => (item.id === id ? device : item))
    : [device, ...state.devices];
  persist();
  resetDeviceForm();
  render();
}

function editDevice(id) {
  const device = findDevice(id);
  if (!device) return;
  elements.deviceForm.id.value = device.id;
  elements.deviceForm.name.value = device.name;
  elements.deviceForm.type.value = device.type;
  elements.deviceForm.criticality.value = device.criticality;
  elements.deviceForm.ip.value = device.ip;
  elements.deviceForm.location.value = device.location;
  elements.deviceForm.url.value = device.url;
  elements.deviceForm.note.value = device.note;
  elements.deviceFormTitle.textContent = "編輯設備";
  elements.cancelEditDevice.classList.remove("hidden");
  setActiveTab("devices");
}

function deleteDevice(id) {
  if (!confirm("確定刪除這台設備？相關巡檢與異常紀錄也會一起移除。")) return;
  state.devices = state.devices.filter((device) => device.id !== id);
  state.inspections = state.inspections.filter((inspection) => inspection.deviceId !== id);
  state.issues = state.issues.filter((issue) => issue.deviceId !== id);
  persist();
  render();
}

function resetDeviceForm() {
  elements.deviceForm.reset();
  elements.deviceForm.id.value = "";
  elements.deviceFormTitle.textContent = "新增設備";
  elements.cancelEditDevice.classList.add("hidden");
}

function saveInspection(event) {
  event.preventDefault();
  const form = new FormData(elements.inspectionForm);
  const inspection = createInspection(form, text(form.get("result")));
  applyInspection(inspection);
  elements.inspectionForm.reset();
  render();
}

function saveQuickInspection(event) {
  event.preventDefault();
  const form = new FormData(elements.quickInspectionForm);
  const inspection = createInspection(form);
  applyInspection(inspection);
  elements.quickInspectionForm.reset();
  render();
}

function createInspection(form, explicitResult) {
  const inspection = {
    id: createId(),
    deviceId: text(form.get("deviceId")),
    date: today(),
    capacity: Number(form.get("capacity")),
    temperature: Number(form.get("temperature")),
    backupStatus: text(form.get("backupStatus")),
    diskStatus: text(form.get("diskStatus")),
    checks: form.getAll("checks").map(text),
    result: explicitResult || deriveInspectionResult(form),
    note: text(form.get("note")),
  };
  return inspection;
}

function applyInspection(inspection) {
  if (!inspection.deviceId) return;
  state.inspections = [inspection, ...state.inspections];
  state.devices = state.devices.map((device) =>
    device.id === inspection.deviceId ? { ...device, status: inspection.result } : device,
  );
  persist();
}

function saveIssue(event) {
  event.preventDefault();
  const form = new FormData(elements.issueForm);
  const issue = {
    id: createId(),
    deviceId: text(form.get("deviceId")),
    title: text(form.get("title")),
    type: text(form.get("type")),
    priority: text(form.get("priority")),
    status: "待處理",
    cause: text(form.get("cause")),
    action: text(form.get("action")),
    createdAt: today(),
  };
  state.issues = [issue, ...state.issues];
  state.devices = state.devices.map((device) =>
    device.id === issue.deviceId && device.status === "正常" ? { ...device, status: "注意" } : device,
  );
  persist();
  elements.issueForm.reset();
  render();
}

function updateIssueStatus(id, status) {
  state.issues = state.issues.map((issue) => (issue.id === id ? { ...issue, status } : issue));
  persist();
  render();
}

async function checkAllDevices() {
  elements.checkAll.disabled = true;
  elements.checkAll.textContent = "檢查中";
  for (const device of state.devices) {
    await probeDevice(device.id);
  }
  elements.checkAll.disabled = false;
  elements.checkAll.textContent = "檢查全部";
}

async function probeDevice(id) {
  const device = findDevice(id);
  if (!device) return;
  const startedAt = performance.now();
  let result;

  if (!device.url) {
    result = {
      level: "manual",
      label: "需手動確認",
      detail: "未設定 HTTP/HTTPS 管理頁，請看設備燈號或登入原廠工具。",
      checkedAt: nowLabel(),
    };
  } else {
    try {
      await fetchWithTimeout(cacheBust(device.url), 4500);
      result = {
        level: "ok",
        label: "可能可連線",
        detail: `瀏覽器完成連線探測，約 ${Math.round(performance.now() - startedAt)} ms。`,
        checkedAt: nowLabel(),
      };
    } catch (error) {
      result = {
        level: "unknown",
        label: "無法由瀏覽器確認",
        detail: "可能是離線、CORS、自簽憑證、HTTP/HTTPS 混用或設備不接受瀏覽器探測。",
        checkedAt: nowLabel(),
      };
    }
  }

  state.devices = state.devices.map((item) => (item.id === id ? { ...item, lastProbe: result } : item));
  persist();
  render();
}

function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, {
    mode: "no-cors",
    cache: "no-store",
    signal: controller.signal,
  }).finally(() => clearTimeout(timer));
}

function cacheBust(url) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("_check", Date.now());
    return parsed.toString();
  } catch {
    return url;
  }
}

function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `maintenance-tracker-${today()}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = normalizeState(JSON.parse(reader.result));
      state.devices = imported.devices;
      state.inspections = imported.inspections;
      state.issues = imported.issues;
      persist();
      render();
      alert("匯入完成");
    } catch {
      alert("匯入失敗，請確認 JSON 格式。");
    }
    event.target.value = "";
  };
  reader.readAsText(file);
}

function render() {
  renderMetrics();
  renderSelectors();
  renderProbeList();
  renderRiskList();
  renderRecentInspections();
  renderIssueChart();
  renderDeviceList();
  renderInspectionTable();
  renderIssueList();
  renderSop();
}

function renderMetrics() {
  const attention = state.devices.filter((device) => ["注意", "異常"].includes(device.status)).length;
  const openIssues = state.issues.filter((issue) => issue.status !== "已完成").length;
  const last = state.inspections[0]?.date || "-";
  elements.deviceCount.textContent = state.devices.length;
  elements.attentionCount.textContent = attention;
  elements.openIssueCount.textContent = openIssues;
  elements.lastInspection.textContent = last;
}

function renderSelectors() {
  const options = state.devices
    .map((device) => `<option value="${device.id}">${escapeHtml(device.name)} - ${escapeHtml(device.ip)}</option>`)
    .join("");
  const empty = `<option value="">請先新增設備</option>`;
  elements.inspectionDevice.innerHTML = options || empty;
  elements.quickInspectionDevice.innerHTML = options || empty;
  elements.issueDevice.innerHTML = options || empty;
}

function renderProbeList() {
  if (state.devices.length === 0) {
    elements.probeList.innerHTML = emptyState("目前沒有設備，先到設備頁新增 NAS 或 Router。");
    return;
  }
  elements.probeList.innerHTML = state.devices.map(renderProbeCard).join("");
  bind("[data-probe]", (button) => probeDevice(button.dataset.probe));
}

function renderProbeCard(device) {
  const probe = device.lastProbe;
  const tagClass = probe?.level === "ok" ? "ok" : probe?.level === "manual" ? "warn" : "info";
  return `
    <article class="card">
      <div class="card-top">
        <div>
          <p class="card-title">${escapeHtml(device.name)}</p>
          <p class="card-subtitle">${escapeHtml(device.type)} · ${escapeHtml(device.ip)} · ${escapeHtml(device.location)}</p>
        </div>
        <span class="tag ${tagClass}">${escapeHtml(probe?.label || "尚未檢查")}</span>
      </div>
      <div class="meta-row">
        <span class="tag">重要度 ${escapeHtml(device.criticality)}</span>
        <span class="tag">${escapeHtml(device.url || "無管理 URL")}</span>
      </div>
      <p class="muted">${escapeHtml(probe?.detail || "按下連線探測後，會嘗試由瀏覽器連到管理頁。")}</p>
      <div class="card-actions">
        <button class="small-button" type="button" data-probe="${device.id}">連線探測</button>
        ${device.url ? `<a class="small-button" href="${escapeAttribute(device.url)}" target="_blank" rel="noreferrer">開啟管理頁</a>` : ""}
      </div>
    </article>
  `;
}

function renderRiskList() {
  const risky = state.devices.filter((device) => ["注意", "異常", "未巡檢"].includes(device.status));
  if (risky.length === 0) {
    elements.riskList.innerHTML = emptyState("目前沒有需注意設備。");
    return;
  }
  elements.riskList.innerHTML = risky
    .map((device) => {
      const latest = latestInspection(device.id);
      return `
        <article class="card">
          <div class="card-top">
            <div>
              <p class="card-title">${escapeHtml(device.name)}</p>
              <p class="card-subtitle">${escapeHtml(device.note || "未填備註")}</p>
            </div>
            <span class="tag ${statusClass(device.status)}">${escapeHtml(device.status)}</span>
          </div>
          <div class="meta-row">
            <span class="tag">最近巡檢 ${escapeHtml(latest?.date || "無")}</span>
            <span class="tag">備份 ${escapeHtml(latest?.backupStatus || "未記錄")}</span>
            <span class="tag">硬碟 ${escapeHtml(latest?.diskStatus || "未記錄")}</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderRecentInspections() {
  if (state.inspections.length === 0) {
    elements.recentInspections.innerHTML = emptyState("尚未建立巡檢紀錄。");
    return;
  }
  elements.recentInspections.innerHTML = state.inspections
    .slice(0, 5)
    .map((inspection) => {
      const device = findDevice(inspection.deviceId);
      return `
        <article class="card">
          <div class="card-top">
            <div>
              <p class="card-title">${escapeHtml(device?.name || "未知設備")}</p>
              <p class="card-subtitle">${escapeHtml(inspection.note || "未填處理紀錄")}</p>
            </div>
            <span class="tag ${statusClass(inspection.result)}">${escapeHtml(inspection.result)}</span>
          </div>
          <div class="meta-row">
            <span class="tag">${escapeHtml(inspection.date)}</span>
            <span class="tag">容量 ${inspection.capacity}%</span>
            <span class="tag">溫度 ${inspection.temperature}°C</span>
            <span class="tag">備份 ${escapeHtml(inspection.backupStatus)}</span>
            <span class="tag">硬碟 ${escapeHtml(inspection.diskStatus)}</span>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderIssueChart() {
  const statuses = ["待處理", "處理中", "已完成"];
  const counts = Object.fromEntries(statuses.map((status) => [status, state.issues.filter((issue) => issue.status === status).length]));
  const max = Math.max(...Object.values(counts), 1);
  elements.issueChart.innerHTML = statuses
    .map((status) => {
      const count = counts[status];
      return `
        <div class="bar-row">
          <div class="bar-label"><span>${status}</span><span>${count} 件</span></div>
          <div class="bar-track"><div class="bar-fill" style="width: ${Math.round((count / max) * 100)}%"></div></div>
        </div>
      `;
    })
    .join("");
}

function renderDeviceList() {
  const filter = elements.deviceFilter.value;
  const devices = filter === "全部" ? state.devices : state.devices.filter((device) => device.status === filter);
  if (devices.length === 0) {
    elements.deviceList.innerHTML = emptyState("沒有符合條件的設備。");
    return;
  }
  elements.deviceList.innerHTML = devices.map(renderDeviceCard).join("");
  bind("[data-quick-inspect]", (button) => focusQuickInspection(button.dataset.quickInspect));
  bind("[data-edit-device]", (button) => editDevice(button.dataset.editDevice));
  bind("[data-delete-device]", (button) => deleteDevice(button.dataset.deleteDevice));
}

function focusQuickInspection(id) {
  elements.quickInspectionDevice.value = id;
  elements.quickInspectionForm.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderDeviceCard(device) {
  const latest = latestInspection(device.id);
  const health = latest ? inspectionHealth(latest) : [];
  return `
    <article class="card">
      <div class="card-top">
        <div>
          <p class="card-title">${escapeHtml(device.name)}</p>
          <p class="card-subtitle">${escapeHtml(device.type)} · ${escapeHtml(device.ip)} · ${escapeHtml(device.location)}</p>
        </div>
        <span class="tag ${statusClass(device.status)}">${escapeHtml(device.status)}</span>
      </div>
      <div class="health-grid">
        <div class="health-cell">
          <span>最近巡檢</span>
          <strong>${escapeHtml(latest?.date || "無")}</strong>
        </div>
        <div class="health-cell">
          <span>容量</span>
          <strong>${latest ? `${latest.capacity}%` : "未記錄"}</strong>
          <div class="capacity-track"><div class="capacity-fill ${capacityClass(latest?.capacity)}" style="width: ${latest ? latest.capacity : 0}%"></div></div>
        </div>
        <div class="health-cell">
          <span>備份</span>
          <strong>${escapeHtml(latest?.backupStatus || "未記錄")}</strong>
        </div>
        <div class="health-cell">
          <span>硬碟/RAID</span>
          <strong>${escapeHtml(latest?.diskStatus || "未記錄")}</strong>
        </div>
      </div>
      <div class="meta-row">
        <span class="tag">重要度 ${escapeHtml(device.criticality)}</span>
        ${health.map((item) => `<span class="tag ${item.className}">${escapeHtml(item.label)}</span>`).join("")}
      </div>
      <p class="muted">${escapeHtml(device.note || "未填用途")}</p>
      <div class="card-actions">
        <button class="small-button" type="button" data-quick-inspect="${device.id}">快速巡檢</button>
        <button class="small-button" type="button" data-edit-device="${device.id}">編輯</button>
        <button class="small-button" type="button" data-delete-device="${device.id}">刪除</button>
      </div>
    </article>
  `;
}

function renderInspectionTable() {
  if (!elements.inspectionTable) return;
  if (state.inspections.length === 0) {
    elements.inspectionTable.innerHTML = emptyState("尚未建立巡檢紀錄。");
    return;
  }
  elements.inspectionTable.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>日期</th>
          <th>設備</th>
          <th>容量</th>
          <th>溫度</th>
          <th>備份</th>
          <th>硬碟/RAID</th>
          <th>結論</th>
          <th>備註</th>
        </tr>
      </thead>
      <tbody>
        ${state.inspections
          .map((inspection) => {
            const device = findDevice(inspection.deviceId);
            return `
              <tr>
                <td>${escapeHtml(inspection.date)}</td>
                <td>${escapeHtml(device?.name || "未知")}</td>
                <td><span class="table-badge ${capacityClass(inspection.capacity)}">${inspection.capacity}%</span></td>
                <td>${inspection.temperature}°C</td>
                <td>${escapeHtml(inspection.backupStatus)}</td>
                <td>${escapeHtml(inspection.diskStatus)}</td>
                <td><span class="table-badge ${statusClass(inspection.result)}">${escapeHtml(inspection.result)}</span></td>
                <td>${escapeHtml(inspection.note || "-")}</td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;
}

function renderIssueList() {
  const filter = elements.issueFilter.value;
  const issues = filter === "全部" ? state.issues : state.issues.filter((issue) => issue.status === filter);
  if (issues.length === 0) {
    elements.issueList.innerHTML = emptyState("目前沒有符合條件的異常。");
    return;
  }
  elements.issueList.innerHTML = issues
    .map((issue) => {
      const device = findDevice(issue.deviceId);
      return `
        <article class="card">
          <div class="card-top">
            <div>
              <p class="card-title">${escapeHtml(issue.title)}</p>
              <p class="card-subtitle">${escapeHtml(device?.name || "未知設備")} · ${escapeHtml(issue.type)} · ${escapeHtml(issue.createdAt)}</p>
            </div>
            <span class="tag ${statusClass(issue.status)}">${escapeHtml(issue.status)}</span>
          </div>
          <div class="meta-row">
            <span class="tag ${issue.priority === "高" ? "danger" : issue.priority === "中" ? "warn" : ""}">優先級 ${escapeHtml(issue.priority)}</span>
            <span class="tag">根因：${escapeHtml(issue.cause || "待補")}</span>
          </div>
          <p class="muted">${escapeHtml(issue.action || "尚未記錄處理方式")}</p>
          <div class="card-actions">
            ${["待處理", "處理中", "已完成"].map((status) => `<button class="small-button ${issue.status === status ? "active" : ""}" type="button" data-issue="${issue.id}" data-status="${status}">${status}</button>`).join("")}
          </div>
        </article>
      `;
    })
    .join("");
  bind("[data-issue]", (button) => updateIssueStatus(button.dataset.issue, button.dataset.status));
}

function renderSop() {
  elements.sopList.innerHTML = sopTemplates
    .map((sop) => `
      <article class="sop-card">
        <h3>${escapeHtml(sop.title)}</h3>
        <ol>${sop.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol>
      </article>
    `)
    .join("");
}

function setActiveTab(tabId) {
  document.querySelectorAll("[data-tab]").forEach((button) => button.classList.toggle("active", button.dataset.tab === tabId));
  document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.toggle("active", panel.id === tabId));
}

function latestInspection(deviceId) {
  return state.inspections.find((inspection) => inspection.deviceId === deviceId);
}

function findDevice(id) {
  return state.devices.find((device) => device.id === id);
}

function bind(selector, callback) {
  document.querySelectorAll(selector).forEach((element) => element.addEventListener("click", () => callback(element)));
}

function emptyState(message) {
  return `<p class="muted">${escapeHtml(message)}</p>`;
}

function statusClass(status) {
  if (["正常", "已完成"].includes(status)) return "ok";
  if (["注意", "處理中", "未巡檢"].includes(status)) return "warn";
  if (["異常", "待處理"].includes(status)) return "danger";
  return "";
}

function deriveInspectionResult(form) {
  const capacity = Number(form.get("capacity"));
  const temperature = Number(form.get("temperature"));
  const backupStatus = text(form.get("backupStatus"));
  const diskStatus = text(form.get("diskStatus"));

  if (capacity >= 90 || temperature >= 60 || backupStatus === "失敗" || diskStatus === "降級") return "異常";
  if (capacity >= 80 || temperature >= 50 || backupStatus === "逾期" || diskStatus === "注意") return "注意";
  return "正常";
}

function inspectionHealth(inspection) {
  const items = [];
  if (inspection.capacity >= 90) items.push({ label: "容量異常", className: "danger" });
  else if (inspection.capacity >= 80) items.push({ label: "容量注意", className: "warn" });

  if (inspection.backupStatus === "失敗") items.push({ label: "備份失敗", className: "danger" });
  else if (inspection.backupStatus === "逾期") items.push({ label: "備份逾期", className: "warn" });

  if (inspection.diskStatus === "降級") items.push({ label: "RAID 降級", className: "danger" });
  else if (inspection.diskStatus === "注意") items.push({ label: "硬碟注意", className: "warn" });

  if (inspection.temperature >= 60) items.push({ label: "溫度異常", className: "danger" });
  else if (inspection.temperature >= 50) items.push({ label: "溫度偏高", className: "warn" });

  return items.length ? items : [{ label: "巡檢正常", className: "ok" }];
}

function capacityClass(value) {
  if (value >= 90) return "danger";
  if (value >= 80) return "warn";
  return "ok";
}

function createId() {
  return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function nowLabel() {
  return new Date().toLocaleString("zh-TW", { hour12: false });
}

function text(value) {
  return String(value || "").trim();
}

function isValidIpOrDash(value) {
  if (value === "-") return true;
  return /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(value);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

render();
