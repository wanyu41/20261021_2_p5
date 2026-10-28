// 使用獨立的儲存鍵保存考試資訊、課表和番茄鐘設定。 // 說明資料保存範圍。
const STORAGE_KEY = "exam-clock-settings"; // 設定本頁在瀏覽器中的儲存識別名稱。
// 定義首次開啟網頁時使用的初始設定。 // 說明預設資料結構。
const defaults = { exam: { subject: "", startTime: "09:00", endTime: "11:00", teacher: "", expected: "", attended: "" }, schedule: [], autoBell: false, focusMinutes: 25, breakMinutes: 5 }; // 準備各分頁的預設值。
// 保存目前應用程式的介面與計時狀態。 // 說明全域狀態用途。
let appState = structuredClone(defaults); // 複製預設設定，避免直接修改原始值。
let examCanvas; // 保存考試大鐘畫布。
let pomodoroCanvas; // 保存番茄鐘畫布。
let examDetails = {}; // 保存考試資訊顯示元件。
let examNotice; // 保存考試設定錯誤提示。
let bellNotice; // 保存鐘聲與課表操作提示。
let pomodoroNotice; // 保存番茄鐘音訊錯誤提示。
let audioContext; // 保存瀏覽器 Web Audio 音訊環境。
let countdownState = { label: "請設定考試時間", minutes: null }; // 保存考試結束倒數結果。
let lastExamUpdate = 0; // 記錄上次更新考試倒數的時間。
let firedScheduleEvents = new Set(); // 防止同一個排課事件重複響鈴。
let pomodoro = { running: false, phase: "focus", round: 1, deadline: 0, remainingSeconds: 25 * 60 }; // 保存番茄鐘運作狀態。
// 初始化分頁、畫布、設定與事件處理器。 // 說明 p5.js 啟動入口。
function setup() { // 開始建立頁面。
  document.documentElement.lang = "zh-Hant"; // 指定頁面使用繁體中文。
  document.title = "考試大鐘・上下課鐘・讀書番茄鐘"; // 設定瀏覽器頁籤名稱。
  document.body.innerHTML = ""; // 清除樣板頁面的預設空白內容。
  document.body.insertAdjacentHTML("afterbegin", `<main id="app" class="exam-app"><nav class="tab-bar" aria-label="功能分頁"><button class="tab-button active" data-tab="exam-page">考試大鐘</button><button class="tab-button" data-tab="bell-page">上下課鐘</button><button class="tab-button" data-tab="pomodoro-page">讀書番茄鐘</button></nav><section id="exam-page" class="tab-page active"><h1 class="visually-hidden">考試大鐘</h1><div id="exam-canvas-wrap" class="clock-stage"></div><section id="exam-details" class="exam-details"></section><section id="exam-controls" class="controls-panel"><h2 class="controls-heading">考試資訊設定</h2><form id="exam-form" class="settings-form" autocomplete="off"><div class="field"><label for="exam-subject">考試科目</label><input id="exam-subject" class="setting-input" type="text" placeholder="例如：數學"></div><div class="field"><label for="exam-startTime">開始時間</label><input id="exam-startTime" class="setting-input" type="time"></div><div class="field"><label for="exam-endTime">結束時間</label><input id="exam-endTime" class="setting-input" type="time"></div><div class="field"><label for="exam-teacher">監考老師</label><input id="exam-teacher" class="setting-input" type="text" placeholder="請輸入老師姓名"></div><div class="field"><label for="exam-expected">應到人數</label><input id="exam-expected" class="setting-input" type="number" min="0" step="1" placeholder="人數"></div><div class="field"><label for="exam-attended">實到人數</label><input id="exam-attended" class="setting-input" type="number" min="0" step="1" placeholder="人數"></div></form><div class="form-actions"><button id="fullscreen-button" class="primary-button" type="button">全螢幕</button><div id="exam-notice" class="form-notice" role="status" aria-live="polite"></div></div></section></section><section id="bell-page" class="tab-page"><header class="page-heading"><h1>上下課鐘</h1><p>按下按鈕試聽鐘聲，或新增課表並啟用自動打鐘。</p></header><div class="bell-buttons"><button id="class-start-button" class="bell-button start-bell" type="button">上課鈴</button><button id="class-end-button" class="bell-button end-bell" type="button">下課鈴</button></div><section class="controls-panel"><div class="section-title-row"><h2 class="controls-heading">自動打鐘</h2><label class="switch-label" for="auto-bell-toggle"><input id="auto-bell-toggle" type="checkbox"><span>啟用課表自動響鈴</span></label></div><p class="helper-text">瀏覽器需要先按過一次鈴聲按鈕或開啟自動打鐘，才能播放音訊。</p><h2 class="controls-heading schedule-heading">課表</h2><div class="schedule-head"><span>節次</span><span>上課時間</span><span>下課時間</span><span>操作</span></div><div id="schedule-list" class="schedule-list"></div><div class="form-actions"><button id="add-period-button" class="secondary-button" type="button">＋ 新增一節</button><div id="bell-notice" class="form-notice" role="status" aria-live="polite"></div></div></section></section><section id="pomodoro-page" class="tab-page"><header class="page-heading"><h1>讀書番茄鐘</h1><p>專注一段時間，再安排短暫休息。</p></header><div id="pomodoro-canvas-wrap" class="pomodoro-stage"></div><div class="pomodoro-meta"><span id="pomodoro-phase">專注時間</span><span id="pomodoro-round">第 1 輪</span></div><section class="controls-panel"><h2 class="controls-heading">時間設定（分鐘）</h2><div class="settings-form pomodoro-settings"><div class="field"><label for="focus-minutes">專注時間</label><input id="focus-minutes" class="setting-input" type="number" min="1" max="240" step="1"></div><div class="field"><label for="break-minutes">休息時間</label><input id="break-minutes" class="setting-input" type="number" min="1" max="120" step="1"></div></div><div class="pomodoro-actions"><button id="pomodoro-start" class="primary-button" type="button">開始</button><button id="pomodoro-pause" class="secondary-button" type="button">暫停</button><button id="pomodoro-reset" class="secondary-button" type="button">重設</button><button id="pomodoro-skip" class="secondary-button" type="button">跳過</button></div></section></section></main>`); // 建立分頁、考試表單、課表控制與番茄鐘介面。
  const examCanvasElement = createCanvas(1200, 440); // 以 p5.js 建立考試大鐘畫布。
  examCanvasElement.parent("exam-canvas-wrap"); // 將考試畫布放入指定容器。
  examCanvas = examCanvasElement; // 保存考試畫布元件參照。
  pixelDensity(1); // 固定畫布像素密度，確保投影文字銳利且效能穩定。
  pomodoroCanvas = createGraphics(1200, 360); // 建立番茄鐘專用 p5.js 繪圖緩衝畫布。
  pomodoroCanvas.elt.classList.add("pomodoro-canvas"); // 加入番茄鐘畫布的樣式類別。
  pomodoroCanvas.elt.style.display = "block"; // 覆寫 p5.Graphics 預設隱藏畫布的設定以顯示倒數。
  document.querySelector("#pomodoro-canvas-wrap").appendChild(pomodoroCanvas.elt); // 將番茄鐘畫布放入畫面。
  examDetails = document.querySelector("#exam-details"); // 取得考試資訊顯示區域。
  examNotice = document.querySelector("#exam-notice"); // 取得考試設定狀態提示區域。
  bellNotice = document.querySelector("#bell-notice"); // 取得上下課鐘狀態提示區域。
  pomodoroNotice = document.createElement("div"); // 建立番茄鐘提示音錯誤提示區域。
  pomodoroNotice.id = "pomodoro-notice"; // 設定番茄鐘提示區域識別名稱。
  pomodoroNotice.className = "form-notice pomodoro-notice"; // 套用提示訊息樣式。
  pomodoroNotice.setAttribute("role", "status"); // 指定提示區域的輔助科技角色。
  pomodoroNotice.setAttribute("aria-live", "polite"); // 讓螢幕閱讀器讀出錯誤提示。
  document.querySelector(".pomodoro-actions").after(pomodoroNotice); // 將提示放在番茄鐘操作按鈕下方。
  loadSettings(); // 讀取瀏覽器已保存的設定。
  renderExamDetails(); // 顯示已讀取的考試資訊。
  renderSchedule(); // 顯示已讀取的課表。
  setupEventHandlers(); // 註冊按鈕、表單與分頁事件。
  updatePomodoroDisplay(); // 初始化番茄鐘畫面與倒數數字。
  window.setInterval(updateTimers, 250); // 定期更新考試倒數、番茄鐘和自動打鐘。
  window.addEventListener("resize", resizeCanvases); // 視窗尺寸改變時同步調整畫布尺寸。
  document.addEventListener("fullscreenchange", updateFullscreenState); // 全螢幕切換後同步更新介面。
  resizeCanvases(); // 依畫面尺寸設定畫布大小。
} // 完成頁面初始化。
// p5.js 每影格更新兩個畫布中的時鐘與番茄倒數文字。 // 說明畫面繪製流程。
function draw() { // 開始繪製畫面。
  clear(); // 清除考試時鐘畫布上的上一影格。
  const now = new Date(); // 取得目前本地時間。
  const dateText = new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "long", day: "numeric", weekday: "long" }).format(now); // 組合繁體中文日期與星期。
  const timeText = [now.getHours(), now.getMinutes(), now.getSeconds()].map((part) => String(part).padStart(2, "0")).join(":"); // 組合固定兩位數的時分秒。
  textAlign(CENTER, CENTER); // 設定時鐘文字置中。
  noStroke(); // 關閉文字外框。
  fill("#9baabd"); // 設定日期文字顏色。
  textFont("system-ui, sans-serif"); // 使用清晰的系統無襯線字型。
  textSize(constrain(width * 0.023, 17, 28)); // 按畫布寬度調整日期大小。
  text(dateText, width / 2, height * 0.19); // 繪製日期與星期。
  fill("#f4f7fb"); // 設定大時鐘文字顏色。
  textFont("Consolas, 'Courier New', monospace"); // 使用等寬字型顯示時間。
  textSize(min(width * 0.145, height * 0.39, 190)); // 設定適合投影的大字體。
  text(timeText, width / 2, height * 0.51); // 繪製目前時分秒。
  const urgent = Number.isFinite(countdownState.minutes) && countdownState.minutes >= 0 && countdownState.minutes <= 10; // 判斷考試剩餘時間是否在最後十分鐘。
  fill(urgent ? "#ff5b63" : "#b8c5d6"); // 依剩餘時間設定倒數文字顏色。
  textFont("system-ui, sans-serif"); // 倒數提示使用易讀的系統字型。
  textSize(constrain(width * 0.029, 20, 34)); // 設定倒數提示的醒目字體大小。
  text(countdownState.label, width / 2, height * 0.82); // 繪製考試倒數提示。
  drawPomodoroCanvas(); // 繪製番茄鐘的剩餘時間。
} // 完成本影格繪製。
// 將保存的設定讀入目前狀態並填入設定欄位。 // 說明讀取資料流程。
function loadSettings() { // 開始讀取本機設定。
  try { // 捕捉瀏覽器儲存空間或資料格式錯誤。
    const saved = localStorage.getItem(STORAGE_KEY); // 取得保存的設定字串。
    if (saved) { const parsed = JSON.parse(saved); const legacyExam = parsed.exam || Object.fromEntries(Object.keys(defaults.exam).filter((key) => key in parsed).map((key) => [key, parsed[key]])); appState = { ...structuredClone(defaults), ...parsed, exam: { ...defaults.exam, ...legacyExam }, schedule: Array.isArray(parsed.schedule) ? parsed.schedule : [] }; } // 合併新格式與舊版考試資料，並確保課表格式有效。
  } catch (error) { console.error("讀取設定失敗：", error); showNotice(examNotice, "無法讀取已儲存設定，請檢查瀏覽器儲存空間。"); } // 顯示明確的讀取錯誤。
  Object.entries(appState.exam).forEach(([key, value]) => { const input = document.querySelector(`#exam-${key}`); if (input) input.value = value ?? ""; }); // 填入考試表單內容。
  document.querySelector("#auto-bell-toggle").checked = Boolean(appState.autoBell); // 還原自動打鐘開關狀態。
  document.querySelector("#focus-minutes").value = appState.focusMinutes; // 還原專注分鐘數。
  document.querySelector("#break-minutes").value = appState.breakMinutes; // 還原休息分鐘數。
  pomodoro.remainingSeconds = (pomodoro.phase === "focus" ? appState.focusMinutes : appState.breakMinutes) * 60; // 依目前階段初始化番茄鐘秒數。
} // 完成讀取設定。
// 保存整份設定並以可見提示回報失敗。 // 說明資料儲存流程。
function saveSettings() { // 開始保存設定。
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(appState)); if (examNotice) examNotice.textContent = ""; } catch (error) { console.error("儲存設定失敗：", error); showNotice(examNotice, "設定無法儲存，請檢查瀏覽器儲存空間。"); } // 保存設定並處理錯誤。
} // 完成保存設定。
// 註冊頁籤、考試欄位、課表與番茄鐘所有操作。 // 說明事件綁定用途。
function setupEventHandlers() { // 開始註冊互動事件。
  document.querySelectorAll(".tab-button").forEach((button) => button.addEventListener("click", () => selectTab(button.dataset.tab))); // 設定三個分頁的切換按鈕。
  document.querySelector("#exam-form").addEventListener("input", (event) => { const key = event.target.id.replace("exam-", ""); appState.exam[key] = event.target.type === "number" ? normalizeCount(event.target.value) : event.target.value; if (event.target.type === "number") event.target.value = appState.exam[key]; saveSettings(); renderExamDetails(); updateExamCountdown(); }); // 更新並保存考試欄位。
  document.querySelector("#fullscreen-button").addEventListener("click", toggleFullscreen); // 設定全螢幕按鈕。
  document.querySelector("#class-start-button").addEventListener("click", () => playBell("start", true)); // 設定手動播放上課鈴。
  document.querySelector("#class-end-button").addEventListener("click", () => playBell("end", true)); // 設定手動播放下課鈴。
  document.querySelector("#auto-bell-toggle").addEventListener("change", (event) => { appState.autoBell = event.target.checked; if (appState.autoBell) unlockAudio().catch((error) => { console.error("啟用音訊失敗：", error); showNotice(bellNotice, "瀏覽器未能啟用音訊，請再按一次鈴聲按鈕。"); }); saveSettings(); showNotice(bellNotice, appState.autoBell ? "自動打鐘已啟用。" : "自動打鐘已停用。"); }); // 啟用或停用課表自動響鈴。
  document.querySelector("#add-period-button").addEventListener("click", addPeriod); // 設定新增課表節次按鈕。
  document.querySelector("#schedule-list").addEventListener("input", handleScheduleInput); // 即時保存課表時間欄位變更。
  document.querySelector("#schedule-list").addEventListener("click", (event) => { const button = event.target.closest("[data-delete-id]"); if (button) deletePeriod(button.dataset.deleteId); }); // 處理刪除單一節次。
  document.querySelector("#focus-minutes").addEventListener("change", (event) => updatePomodoroSetting("focusMinutes", event.target.value, 1, 240)); // 保存專注分鐘設定。
  document.querySelector("#break-minutes").addEventListener("change", (event) => updatePomodoroSetting("breakMinutes", event.target.value, 1, 120)); // 保存休息分鐘設定。
  document.querySelector("#pomodoro-start").addEventListener("click", startPomodoro); // 設定番茄鐘開始按鈕。
  document.querySelector("#pomodoro-pause").addEventListener("click", pausePomodoro); // 設定番茄鐘暫停按鈕。
  document.querySelector("#pomodoro-reset").addEventListener("click", resetPomodoro); // 設定番茄鐘重設按鈕。
  document.querySelector("#pomodoro-skip").addEventListener("click", () => finishPomodoroPhase(false)); // 設定番茄鐘跳過按鈕。
} // 完成事件註冊。
// 切換所選分頁並只顯示對應內容。 // 說明分頁狀態更新。
function selectTab(tabId) { // 開始切換分頁。
  document.querySelectorAll(".tab-button").forEach((button) => button.classList.toggle("active", button.dataset.tab === tabId)); // 更新分頁按鈕選取狀態。
  document.querySelectorAll(".tab-page").forEach((page) => page.classList.toggle("active", page.id === tabId)); // 顯示選取的頁面。
  if (tabId === "exam-page" || tabId === "pomodoro-page") window.requestAnimationFrame(resizeCanvases); // 切換到畫布分頁後依可見區域重新校正尺寸。
} // 完成分頁切換。
// 將考試資訊顯示在投影畫面的資訊卡。 // 說明資訊呈現方式。
function renderExamDetails() { // 開始更新考試資訊卡。
  const exam = appState.exam; // 取得目前考試資料。
  const expected = exam.expected === "" ? null : Number(exam.expected); // 將應到人數轉成數字。
  const attended = exam.attended === "" ? null : Number(exam.attended); // 將實到人數轉成數字。
  const absent = expected === null && attended === null ? "—" : Math.max(0, (expected || 0) - (attended || 0)); // 計算不能小於零的缺考人數。
  const details = [["考試科目", escapeHtml(exam.subject.trim()) || "未設定科目"], ["考試時間", `${escapeHtml(exam.startTime || "--:--")} ～ ${escapeHtml(exam.endTime || "--:--")}`], ["監考老師", escapeHtml(exam.teacher.trim()) || "未設定"], ["出席狀況", `應到 ${expected ?? "—"}　實到 ${attended ?? "—"}　缺考 ${absent}`]]; // 準備四張考試資訊卡。
  examDetails.innerHTML = details.map(([label, value]) => `<article class="detail-card"><div class="detail-label">${label}</div><div class="detail-value">${value}</div></article>`).join(""); // 更新資訊卡的安全文字內容。
} // 完成考試資訊更新。
// 更新考試開始與結束時間的分鐘倒數。 // 說明倒數狀態判斷。
function updateExamCountdown() { // 開始更新考試倒數。
  const now = new Date(); // 取得目前本地日期與時間。
  const start = parseTimeToday(appState.exam.startTime, now); // 解析今天的考試開始時間。
  const end = parseTimeToday(appState.exam.endTime, now); // 解析今天的考試結束時間。
  if (!start || !end) { countdownState = { label: "請設定有效的考試時間", minutes: null }; return; } // 無效時間顯示設定提醒。
  if (end <= start) end.setDate(end.getDate() + 1); // 結束時間不晚於開始時間時視為跨午夜。
  if (now < start) countdownState = { label: `距離考試開始還有 ${Math.ceil((start - now) / 60000)} 分鐘`, minutes: null }; // 尚未開考時顯示開始倒數。
  else if (now < end) { const minutes = Math.ceil((end - now) / 60000); countdownState = { label: `距離考試結束還有 ${minutes} 分鐘`, minutes }; } // 考試進行中顯示結束倒數。
  else countdownState = { label: "考試時間已結束", minutes: null }; // 超過結束時間時顯示已結束。
} // 完成考試倒數更新。
// 按固定間隔更新倒數、課表響鈴與番茄鐘。 // 說明背景計時流程。
function updateTimers() { // 開始更新各項計時器。
  if (millis() - lastExamUpdate >= 250 || lastExamUpdate === 0) { lastExamUpdate = millis(); updateExamCountdown(); } // 更新考試倒數資料。
  checkSchedule(); // 檢查自動打鐘時間。
  if (pomodoro.running) { if (Date.now() >= pomodoro.deadline) finishPomodoroPhase(true); else { pomodoro.remainingSeconds = Math.ceil((pomodoro.deadline - Date.now()) / 1000); updatePomodoroDisplay(); } } // 根據絕對時間更新番茄鐘倒數。
} // 完成背景計時更新。
// 將 HH:MM 時間字串解析為指定日期的本地時間。 // 說明時間解析方式。
function parseTimeToday(value, date) { // 開始解析時間欄位。
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value || ""); // 驗證 24 小時制時間。
  if (!match) return null; // 無效時間回報空值。
  const result = new Date(date); // 複製指定日期。
  result.setHours(Number(match[1]), Number(match[2]), 0, 0); // 設定解析出的時分秒。
  return result; // 回傳解析結果。
} // 完成時間解析。
// 將非負整數輸入正規化，允許欄位保持空白。 // 說明人數欄位驗證。
function normalizeCount(value) { // 開始驗證人數輸入。
  if (value === "") return ""; // 保留尚未輸入的空欄位。
  const number = Number.parseInt(value, 10); // 將字串轉為十進位整數。
  return Number.isFinite(number) && number >= 0 ? String(number) : "0"; // 排除負數與無效輸入。
} // 完成人數欄位驗證。
// 將使用者輸入安全轉為可插入 HTML 的文字。 // 說明避免 HTML 注入。
function escapeHtml(value) { // 開始跳脫特殊字元。
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]); // 編碼所有 HTML 特殊符號。
} // 完成文字跳脫。
// 新增一個空白課表節次並將其寫入本機。 // 說明課表新增操作。
function addPeriod() { // 開始新增課表節次。
  appState.schedule.push({ id: window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`, start: "", end: "" }); // 建立具唯一識別碼的課表資料。
  renderSchedule(); // 立即顯示新增的課表欄位。
  saveSettings(); // 保存最新課表。
} // 完成課表新增。
// 安全建立及顯示所有課表列。 // 說明課表繪製方式。
function renderSchedule() { // 開始更新課表列表。
  const list = document.querySelector("#schedule-list"); // 取得課表列表容器。
  list.replaceChildren(); // 移除舊的課表列。
  appState.schedule.forEach((period, index) => { const row = document.createElement("div"); row.className = "schedule-row"; const number = document.createElement("strong"); number.textContent = `第 ${index + 1} 節`; const start = document.createElement("input"); start.type = "time"; start.className = "setting-input schedule-time"; start.value = period.start; start.dataset.id = period.id; start.dataset.key = "start"; start.setAttribute("aria-label", `第 ${index + 1} 節上課時間`); const end = document.createElement("input"); end.type = "time"; end.className = "setting-input schedule-time"; end.value = period.end; end.dataset.id = period.id; end.dataset.key = "end"; end.setAttribute("aria-label", `第 ${index + 1} 節下課時間`); const remove = document.createElement("button"); remove.type = "button"; remove.className = "delete-button"; remove.textContent = "刪除"; remove.dataset.deleteId = period.id; remove.setAttribute("aria-label", `刪除第 ${index + 1} 節`); row.append(number, start, end, remove); list.appendChild(row); }); // 建立每節上課時間、下課時間與刪除控制。
  list.classList.toggle("empty", appState.schedule.length === 0); // 依課表是否空白切換提示樣式。
  if (appState.schedule.length === 0) list.textContent = "尚未新增課表，請按「新增一節」。"; // 空課表時顯示引導文字。
} // 完成課表列表更新。
// 保存指定課表時間欄位的變更。 // 說明課表欄位更新。
function handleScheduleInput(event) { // 開始處理課表欄位輸入。
  const input = event.target; // 取得觸發事件的欄位。
  if (!input.matches(".schedule-time")) return; // 忽略非課表時間欄位。
  const period = appState.schedule.find((item) => item.id === input.dataset.id); // 找到欄位所屬課表節次。
  if (period) period[input.dataset.key] = input.value; // 更新該節次的時間。
  saveSettings(); // 保存課表變更。
} // 完成課表欄位更新。
// 移除指定課表節次並更新畫面。 // 說明刪除課表資料。
function deletePeriod(id) { // 開始刪除節次。
  appState.schedule = appState.schedule.filter((period) => period.id !== id); // 保留其他節次。
  renderSchedule(); // 更新課表列表顯示。
  saveSettings(); // 保存刪除結果。
} // 完成節次刪除。
// 比對目前時間並只在課表事件發生時響一次鈴。 // 說明自動打鐘判斷。
function checkSchedule() { // 開始檢查自動打鐘。
  if (!appState.autoBell || !audioContext || audioContext.state !== "running") return; // 未啟用或音訊未解鎖時不自動播放。
  const now = new Date(); // 取得目前時間。
  const day = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`; // 產生今日事件識別日期。
  const minute = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`; // 產生目前的 24 小時制分鐘。
  appState.schedule.forEach((period) => { [["start", "start"], ["end", "end"]].forEach(([key, bell]) => { if (period[key] === minute) { const eventId = `${day}-${period.id}-${key}`; if (!firedScheduleEvents.has(eventId)) { firedScheduleEvents.add(eventId); playBell(bell, false); } } }); }); // 檢查每節的上下課時間並避免重複響鈴。
  if (firedScheduleEvents.size > 200) firedScheduleEvents.clear(); // 限制長時間執行時的重複事件記錄大小。
} // 完成自動打鐘檢查。
// 解鎖瀏覽器音訊並建立 Web Audio 音訊環境。 // 說明瀏覽器音訊要求。
async function unlockAudio() { // 開始啟用音訊。
  if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)(); // 首次互動時建立音訊環境。
  if (audioContext.state !== "running") await audioContext.resume(); // 在使用者互動中喚醒音訊環境。
  if (audioContext.state !== "running") throw new Error("瀏覽器音訊尚未啟用"); // 音訊仍未啟用時明確回報錯誤。
  return audioContext; // 回傳可播放音訊的環境。
} // 完成音訊啟用。
// 以振盪器和音量包絡合成上課鈴、下課鈴與番茄提示音。 // 說明不需外部音檔。
async function playBell(kind, manual) { // 開始播放合成鐘聲。
  try { const context = await unlockAudio(); const sequence = kind === "start" ? [880, 660, 880, 660] : kind === "end" ? [660, 880, 660] : kind === "focus" ? [880, 1174, 1397] : [659, 784, 988]; const spacing = kind === "start" ? 0.42 : kind === "end" ? 0.55 : 0.24; sequence.forEach((frequency, index) => scheduleBellTone(context, frequency, context.currentTime + index * spacing, kind === "focus" || kind === "break" ? 0.48 : 0.85)); if (manual) showNotice(bellNotice, kind === "start" ? "正在播放上課鈴。" : "正在播放下課鈴。"); } catch (error) { console.error("播放鐘聲失敗：", error); showNotice(bellNotice, "無法播放鐘聲，請確認瀏覽器允許音訊播放。"); } // 捕捉並顯示音訊錯誤。
} // 完成鐘聲播放。
// 以多個稍微錯音的振盪器合成具有鐘鳴質感的音符。 // 說明聲音包絡設定。
function scheduleBellTone(context, frequency, startAt, duration) { // 開始設定單個鐘聲音符。
  [1, 2.76, 5.4].forEach((partial, index) => { const oscillator = context.createOscillator(); const gain = context.createGain(); oscillator.type = index === 0 ? "sine" : "triangle"; oscillator.frequency.value = frequency * partial; gain.gain.setValueAtTime(0.0001, startAt); gain.gain.exponentialRampToValueAtTime(index === 0 ? 0.19 : 0.055 / index, startAt + 0.012); gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration * (index === 0 ? 1 : 0.7)); oscillator.connect(gain); gain.connect(context.destination); oscillator.start(startAt); oscillator.stop(startAt + duration + 0.03); }); // 疊加基音與泛音並以衰減包絡製造鐘聲。
} // 完成音符排程。
// 驗證並更新番茄鐘的專注或休息時長。 // 說明番茄設定驗證。
function updatePomodoroSetting(key, value, minimum, maximum) { // 開始更新番茄時長設定。
  const minutes = Math.min(maximum, Math.max(minimum, Number.parseInt(value, 10) || minimum)); // 限制輸入在允許範圍內。
  appState[key] = minutes; // 保存正規化後的分鐘數。
  document.querySelector(key === "focusMinutes" ? "#focus-minutes" : "#break-minutes").value = minutes; // 顯示修正後的設定值。
  if (!pomodoro.running) pomodoro.remainingSeconds = (pomodoro.phase === "focus" ? appState.focusMinutes : appState.breakMinutes) * 60; // 暫停狀態下套用新的階段時長。
  saveSettings(); // 保存番茄鐘時長。
  updatePomodoroDisplay(); // 更新倒數畫面。
} // 完成番茄時長設定。
// 開始番茄鐘並根據目前剩餘秒數計算結束時間。 // 說明開始操作。
function startPomodoro() { // 開始執行番茄計時。
  if (pomodoro.running) return; // 已在執行時避免重複啟動。
  unlockAudio().then(() => showNotice(pomodoroNotice, "")).catch((error) => { console.error("啟用番茄鐘提示音失敗：", error); showNotice(pomodoroNotice, "計時仍會進行，但瀏覽器未能啟用提示音。請確認允許此頁播放音訊。"); }); // 利用開始按鈕的使用者互動啟用階段提示音。
  pomodoro.running = true; // 標記番茄鐘正在執行。
  pomodoro.deadline = Date.now() + pomodoro.remainingSeconds * 1000; // 設定絕對結束時間以避免計時漂移。
  updatePomodoroDisplay(); // 更新按鈕與時間顯示。
} // 完成開始番茄計時。
// 暫停番茄鐘並保存尚未完成的秒數。 // 說明暫停操作。
function pausePomodoro() { // 開始暫停番茄計時。
  if (!pomodoro.running) return; // 尚未開始時不需處理。
  pomodoro.remainingSeconds = Math.max(0, Math.ceil((pomodoro.deadline - Date.now()) / 1000)); // 保存精準剩餘秒數。
  pomodoro.running = false; // 標記計時已暫停。
  updatePomodoroDisplay(); // 更新暫停後畫面。
} // 完成暫停番茄計時。
// 重設目前階段與剩餘時間，保留目前輪數。 // 說明重設操作。
function resetPomodoro() { // 開始重設番茄計時。
  pomodoro.running = false; // 停止目前計時。
  pomodoro.remainingSeconds = (pomodoro.phase === "focus" ? appState.focusMinutes : appState.breakMinutes) * 60; // 重設為當前階段設定時間。
  updatePomodoroDisplay(); // 更新重設後畫面。
} // 完成重設番茄計時。
// 結束目前階段並自動切換到下一個階段。 // 說明階段切換流程。
function finishPomodoroPhase(playSound) { // 開始切換番茄階段。
  if (playSound) playBell(pomodoro.phase === "focus" ? "focus" : "break", false); // 自動階段完成時播放提示音。
  if (pomodoro.phase === "focus") pomodoro.phase = "break"; else { pomodoro.phase = "focus"; pomodoro.round += 1; } // 專注後休息，休息後進入下一輪。
  const nextDuration = (pomodoro.phase === "focus" ? appState.focusMinutes : appState.breakMinutes) * 60; // 取得下一階段的時長。
  if (pomodoro.running) { pomodoro.deadline = playSound ? pomodoro.deadline + nextDuration * 1000 : Date.now() + nextDuration * 1000; pomodoro.remainingSeconds = Math.max(0, Math.ceil((pomodoro.deadline - Date.now()) / 1000)); } else pomodoro.remainingSeconds = nextDuration; // 自動接續或跳過後立即從新階段完整時間開始。
  updatePomodoroDisplay(); // 更新階段名稱、輪數與按鈕。
} // 完成階段切換。
// 更新番茄鐘狀態文字及控制按鈕。 // 說明計時器操作狀態。
function updatePomodoroDisplay() { // 開始更新番茄鐘文字。
  document.querySelector("#pomodoro-phase").textContent = pomodoro.phase === "focus" ? "專注時間" : "休息時間"; // 顯示目前階段。
  document.querySelector("#pomodoro-round").textContent = `第 ${pomodoro.round} 輪`; // 顯示目前番茄輪數。
  document.querySelector("#pomodoro-start").disabled = pomodoro.running; // 計時中停用開始按鈕。
  document.querySelector("#pomodoro-pause").disabled = !pomodoro.running; // 暫停狀態停用暫停按鈕。
} // 完成番茄狀態文字更新。
// 繪製高對比的大型番茄鐘倒數。 // 說明投影畫面繪製。
function drawPomodoroCanvas() { // 開始繪製番茄鐘倒數畫布。
  if (!pomodoroCanvas) return; // 畫布尚未建立時略過繪製。
  const graphics = pomodoroCanvas; // 取得番茄鐘 p5.js 繪圖緩衝。
  graphics.clear(); // 清除上一影格。
  const seconds = Math.max(0, pomodoro.running ? Math.ceil((pomodoro.deadline - Date.now()) / 1000) : pomodoro.remainingSeconds); // 計算最新剩餘秒數。
  const time = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`; // 格式化為分秒字串。
  graphics.textAlign(CENTER, CENTER); // 將倒數文字置中。
  graphics.textFont("Consolas, 'Courier New', monospace"); // 使用等寬數字字型。
  graphics.textSize(Math.min(graphics.width * 0.25, graphics.height * 0.64, 230)); // 設定超大倒數字體。
  graphics.noStroke(); // 移除文字外框。
  graphics.fill(pomodoro.phase === "focus" ? "#f4f7fb" : "#8fe0c3"); // 專注與休息使用不同顏色。
  graphics.text(time, graphics.width / 2, graphics.height / 2); // 繪製剩餘時間。
} // 完成番茄畫布繪製。
// 依目前可見容器尺寸調整兩張 p5 畫布。 // 說明響應式調整。
function resizeCanvases() { // 開始調整畫布尺寸。
  const examWrap = document.querySelector("#exam-canvas-wrap"); // 取得考試時鐘畫布容器。
  const pomodoroWrap = document.querySelector("#pomodoro-canvas-wrap"); // 取得番茄畫布容器。
  if (examWrap && examWrap.clientWidth > 0) resizeCanvas(examWrap.clientWidth, examWrap.clientHeight); // 更新主畫布尺寸。
  if (pomodoroCanvas && pomodoroWrap && pomodoroWrap.clientWidth > 0) pomodoroCanvas.resizeCanvas(pomodoroWrap.clientWidth, pomodoroWrap.clientHeight); // 更新番茄畫布尺寸。
} // 完成畫布尺寸調整。
// 進入或離開考試大鐘全螢幕模式。 // 說明全螢幕切換操作。
function toggleFullscreen() { // 開始處理全螢幕操作。
  if (document.fullscreenElement) document.exitFullscreen().catch((error) => { console.error("離開全螢幕失敗：", error); showNotice(examNotice, "無法離開全螢幕模式。"); }); // 有全螢幕頁面時嘗試離開。
  else document.querySelector("#app").requestFullscreen().catch((error) => { console.error("進入全螢幕失敗：", error); showNotice(examNotice, "無法進入全螢幕，請確認瀏覽器允許全螢幕顯示。"); }); // 否則將應用程式切換至全螢幕。
} // 完成全螢幕切換。
// 依瀏覽器全螢幕事件更新樣式及畫布尺寸。 // 說明全螢幕介面變化。
function updateFullscreenState() { // 開始更新全螢幕狀態。
  const active = document.fullscreenElement === document.querySelector("#app"); // 判斷本應用程式是否處於全螢幕。
  document.querySelector("#app").classList.toggle("fullscreen-active", active); // 套用全螢幕專用樣式。
  document.querySelector("#fullscreen-button").textContent = active ? "離開全螢幕" : "全螢幕"; // 更新按鈕文字。
  window.setTimeout(resizeCanvases, 80); // 等待版面重排後調整畫布。
} // 完成全螢幕狀態更新。
// 將錯誤或操作狀態寫入指定的提示區。 // 說明狀態回報。
function showNotice(element, message) { // 開始顯示狀態提示。
  if (element) element.textContent = message; // 以純文字更新提示避免插入不安全 HTML。
} // 完成狀態提示。
