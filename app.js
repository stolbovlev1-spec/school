/* ============================================================
   Школьный помощник — PWA
   Все данные хранятся в localStorage прямо на устройстве.
   Ничего не уходит на сервер.
   ============================================================ */

const DB_KEYS = { hw: 'sh_homework', exams: 'sh_exams', notes: 'sh_notes', grades: 'sh_grades', idc: 'sh_id_counter' };

function load(key) { try { return JSON.parse(localStorage.getItem(key)) || []; } catch (e) { return []; } }
function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
function nextId() {
  const c = (parseInt(localStorage.getItem(DB_KEYS.idc)) || 0) + 1;
  localStorage.setItem(DB_KEYS.idc, c);
  return c;
}

let currentTab = 'today';

/* ---------------- Навигация ---------------- */
function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-page').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  document.querySelectorAll('.bottom-nav button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));

  const titles = { today: 'Сегодня', exam: 'Экзамены', scan: 'Сканер', grades: 'Оценки' };
  document.getElementById('pageTitle').textContent = titles[tab];

  const fab = document.getElementById('fab');
  const fabLabel = document.getElementById('fabLabel');
  fab.style.display = (tab === 'scan') ? 'none' : 'flex';
  fabLabel.textContent = { today: 'Домашка', exam: 'Счётчик', grades: 'Оценка' }[tab] || '';

  renderAll();
}

/* ---------------- Bottom sheet helpers ---------------- */
function openSheet(html) {
  document.getElementById('sheetContent').innerHTML = html;
  document.getElementById('sheetBackdrop').classList.add('open');
}
function closeSheet() { document.getElementById('sheetBackdrop').classList.remove('open'); }
function closeSheetOnBackdrop(e) { if (e.target.id === 'sheetBackdrop') closeSheet(); }

function openAddSheet() {
  if (currentTab === 'today') openHomeworkSheet();
  else if (currentTab === 'exam') openExamSheet();
  else if (currentTab === 'grades') openGradeSheet();
}

/* ============================================================
   ДОМАШКИ
   ============================================================ */
let selectedPriority = 1;

function openHomeworkSheet() {
  selectedPriority = 1;
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  openSheet(`
    <h3>Новая домашка</h3>
    <label>Предмет</label>
    <input id="hwSubject" placeholder="Алгебра">
    <label>Что задали</label>
    <input id="hwTitle" placeholder="Номера 12-18">
    <label>Срок сдачи</label>
    <input id="hwDate" type="date" value="${tomorrow}">
    <label>Приоритет</label>
    <div>
      <span class="chip selected" data-p="0" onclick="pickPriority(this,0)">Не срочно</span>
      <span class="chip" data-p="1" onclick="pickPriority(this,1)">Средне</span>
      <span class="chip" data-p="2" onclick="pickPriority(this,2)">Срочно</span>
    </div>
    <br>
    <button class="primary" onclick="saveHomework()">Добавить</button>
  `);
  // средний по умолчанию
  setTimeout(() => {
    document.querySelectorAll('#sheetContent .chip').forEach(c => c.classList.toggle('selected', c.dataset.p === '1'));
  }, 0);
}

function pickPriority(el, p) {
  selectedPriority = p;
  document.querySelectorAll('#sheetContent .chip').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
}

function saveHomework() {
  const subject = document.getElementById('hwSubject').value.trim();
  const title = document.getElementById('hwTitle').value.trim();
  const date = document.getElementById('hwDate').value;
  if (!subject || !title || !date) return;

  const item = { id: nextId(), subject, title, dueDate: date, done: false, priority: selectedPriority };
  const list = load(DB_KEYS.hw);
  list.push(item);
  save(DB_KEYS.hw, list);

  scheduleReminder(item);
  closeSheet();
  renderAll();
}

function toggleHomework(id) {
  const list = load(DB_KEYS.hw);
  const item = list.find(h => h.id === id);
  if (item) item.done = !item.done;
  save(DB_KEYS.hw, list);
  renderAll();
}

function deleteHomework(id) {
  save(DB_KEYS.hw, load(DB_KEYS.hw).filter(h => h.id !== id));
  renderAll();
}

function priorityColorClass(p) { return 'priority-' + p; }

function renderHomework() {
  const list = load(DB_KEYS.hw).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const pending = list.filter(h => !h.done);
  const done = list.filter(h => h.done);

  document.getElementById('hwEmpty').style.display = list.length === 0 ? 'block' : 'none';

  const rowHtml = (h) => {
    const days = Math.ceil((new Date(h.dueDate) - new Date().setHours(0,0,0,0)) / 86400000);
    const dateStr = new Date(h.dueDate).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    const daysLabel = h.done ? '' : (days >= 0 ? ` · через ${days} дн.` : ' · просрочено');
    return `
      <div class="hw-item ${priorityColorClass(h.priority)} ${h.done ? 'done' : ''}">
        <input type="checkbox" ${h.done ? 'checked' : ''} onchange="toggleHomework(${h.id})">
        <div class="hw-info">
          <div class="hw-title">${escapeHtml(h.title)}</div>
          <div class="hw-sub">${escapeHtml(h.subject)} · срок: ${dateStr}${daysLabel}</div>
        </div>
        <span onclick="deleteHomework(${h.id})" style="color:var(--text-dim); padding:6px;">✕</span>
      </div>`;
  };

  document.getElementById('hwPending').innerHTML = pending.map(rowHtml).join('');
  document.getElementById('hwDoneWrap').style.display = done.length ? 'block' : 'none';
  document.getElementById('hwDone').innerHTML = done.map(rowHtml).join('');
}

/* ============================================================
   ЭКЗАМЕНЫ
   ============================================================ */
function openExamSheet() {
  const future = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  openSheet(`
    <h3>Новый счётчик</h3>
    <label>Название</label>
    <input id="examName" placeholder="ЕГЭ по математике">
    <label>Дата</label>
    <input id="examDate" type="date" value="${future}">
    <br><br>
    <button class="primary" onclick="saveExam()">Создать</button>
  `);
}

function saveExam() {
  const name = document.getElementById('examName').value.trim();
  const date = document.getElementById('examDate').value;
  if (!name || !date) return;
  const list = load(DB_KEYS.exams);
  list.push({ id: nextId(), name, date });
  save(DB_KEYS.exams, list);
  closeSheet();
  renderAll();
}

function deleteExam(id) {
  save(DB_KEYS.exams, load(DB_KEYS.exams).filter(e => e.id !== id));
  renderAll();
}

function ringSvg(percent, daysLeft) {
  const r = 78, c = 2 * Math.PI * r;
  const offset = c * (1 - percent);
  const color = daysLeft <= 7 ? 'var(--red)' : 'var(--accent)';
  return `
    <div class="ring">
      <svg width="180" height="180" viewBox="0 0 180 180">
        <circle cx="90" cy="90" r="${r}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="14"/>
        <circle cx="90" cy="90" r="${r}" fill="none" stroke="${color}" stroke-width="14"
          stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${offset}"/>
      </svg>
      <div class="ring-center">
        <div class="num">${daysLeft}</div>
        <div class="lbl">дней осталось</div>
      </div>
    </div>`;
}

function renderExams() {
  const list = load(DB_KEYS.exams).sort((a, b) => a.date.localeCompare(b.date));
  document.getElementById('examEmpty').style.display = list.length === 0 ? 'block' : 'none';

  document.getElementById('examList').innerHTML = list.map(e => {
    const today = new Date().setHours(0,0,0,0);
    const daysLeft = Math.max(0, Math.ceil((new Date(e.date) - today) / 86400000));
    const window = 90;
    const percent = daysLeft >= window ? 0.02 : Math.min(1, Math.max(0.02, 1 - daysLeft / window));
    const dateStr = new Date(e.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    const motivation = daysLeft === 0 ? 'Сегодня главный день. Ты готов! 💪'
      : daysLeft <= 7 ? 'Финальная неделя — держи темп! 🔥'
      : daysLeft <= 30 ? 'Уже близко — самое время закрепить слабые темы'
      : 'Впереди достаточно времени, чтобы всё спокойно разобрать';

    return `
      <div class="card" style="text-align:center; position:relative;">
        <span onclick="deleteExam(${e.id})" style="position:absolute; right:16px; top:16px; color:var(--text-dim);">✕</span>
        <h2 style="color:var(--text); font-size:18px; font-weight:700;">${escapeHtml(e.name)}</h2>
        ${ringSvg(percent, daysLeft)}
        <div style="margin-top:8px;">${dateStr}</div>
        <div style="margin-top:8px; color:var(--text-dim); font-style:italic; font-size:13px;">${motivation}</div>
      </div>`;
  }).join('');
}

/* ============================================================
   СКАНЕР (OCR через Tesseract.js — работает в браузере)
   ============================================================ */
document.getElementById('cameraInput').addEventListener('change', handleScanFile);
document.getElementById('galleryInput').addEventListener('change', handleScanFile);

async function handleScanFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const preview = document.getElementById('scanPreview');
  preview.src = URL.createObjectURL(file);
  preview.style.display = 'block';

  const status = document.getElementById('ocrStatus');
  const progress = document.getElementById('ocrProgress');
  progress.style.display = 'block';
  progress.value = 0;
  status.textContent = 'Распознаём текст...';

  try {
    const { data } = await Tesseract.recognize(file, 'rus+eng', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          progress.value = m.progress * 100;
          status.textContent = `Распознаём текст... ${Math.round(m.progress * 100)}%`;
        } else {
          status.textContent = m.status;
        }
      }
    });
    progress.style.display = 'none';
    status.textContent = '';
    showOcrResultDialog(data.text);
  } catch (err) {
    progress.style.display = 'none';
    status.textContent = 'Не удалось распознать текст. Проверь интернет при первом использовании (модель языка загружается один раз).';
  }
  e.target.value = '';
}

function showOcrResultDialog(text) {
  const now = new Date();
  const defaultTitle = 'Скан ' + now.toLocaleDateString('ru-RU') + ' ' + now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  openSheet(`
    <h3>Распознанный текст</h3>
    <label>Название заметки</label>
    <input id="noteTitle" value="${escapeHtml(defaultTitle)}">
    <label>Текст (можно поправить)</label>
    <textarea id="noteText" rows="8" style="width:100%; border-radius:12px; border:1px solid rgba(255,255,255,0.12); background:var(--surface-2); color:var(--text); padding:12px; font-size:14px;">${escapeHtml(text)}</textarea>
    <br><br>
    <button class="primary" onclick="saveScanNote()">Сохранить в конспект</button>
  `);
}

function saveScanNote() {
  const title = document.getElementById('noteTitle').value.trim() || 'Без названия';
  const text = document.getElementById('noteText').value;
  const list = load(DB_KEYS.notes);
  list.push({ id: nextId(), title, text, createdAt: new Date().toISOString() });
  save(DB_KEYS.notes, list);
  closeSheet();
  renderAll();
}

function deleteNote(id) {
  save(DB_KEYS.notes, load(DB_KEYS.notes).filter(n => n.id !== id));
  renderAll();
}

function viewNote(id) {
  const note = load(DB_KEYS.notes).find(n => n.id === id);
  if (!note) return;
  openSheet(`
    <h3>${escapeHtml(note.title)}</h3>
    <div style="white-space:pre-wrap; font-size:14px; color:var(--text-dim); max-height:50vh; overflow-y:auto;">${escapeHtml(note.text)}</div>
    <br>
    <button class="secondary" onclick="closeSheet()">Закрыть</button>
  `);
}

function renderNotes() {
  const list = load(DB_KEYS.notes).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  document.getElementById('notesEmpty').style.display = list.length === 0 ? 'block' : 'none';
  document.getElementById('notesList').innerHTML = list.map(n => `
    <div class="note-item" onclick="viewNote(${n.id})" style="cursor:pointer;">
      <div class="hw-info">
        <div class="hw-title">${escapeHtml(n.title)}</div>
        <div class="hw-sub">${escapeHtml(n.text.slice(0, 60))}${n.text.length > 60 ? '…' : ''}</div>
      </div>
      <span onclick="event.stopPropagation(); deleteNote(${n.id})" style="color:var(--text-dim); padding:6px;">✕</span>
    </div>
  `).join('');
}

/* ============================================================
   ОЦЕНКИ
   ============================================================ */
let selectedSubjectFilter = null;
let selectedGradeValue = 5;

function openGradeSheet() {
  selectedGradeValue = 5;
  openSheet(`
    <h3>Новая оценка</h3>
    <label>Предмет</label>
    <input id="gradeSubject" placeholder="Физика" value="${selectedSubjectFilter ? escapeHtml(selectedSubjectFilter) : ''}">
    <label>Оценка</label>
    <div>
      <span class="chip" data-v="2" onclick="pickGrade(this,2)">2</span>
      <span class="chip" data-v="3" onclick="pickGrade(this,3)">3</span>
      <span class="chip" data-v="4" onclick="pickGrade(this,4)">4</span>
      <span class="chip selected" data-v="5" onclick="pickGrade(this,5)">5</span>
    </div>
    <br>
    <button class="primary" onclick="saveGrade()">Добавить</button>
  `);
}

function pickGrade(el, v) {
  selectedGradeValue = v;
  document.querySelectorAll('#sheetContent .chip').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
}

function saveGrade() {
  const subject = document.getElementById('gradeSubject').value.trim();
  if (!subject) return;
  const list = load(DB_KEYS.grades);
  list.push({ id: nextId(), subject, value: selectedGradeValue, date: new Date().toISOString() });
  save(DB_KEYS.grades, list);
  closeSheet();
  renderAll();
}

function deleteGrade(id) {
  save(DB_KEYS.grades, load(DB_KEYS.grades).filter(g => g.id !== id));
  renderAll();
}

function filterSubject(s) {
  selectedSubjectFilter = s;
  renderGrades();
}

function currentGradeList() {
  const all = load(DB_KEYS.grades);
  return selectedSubjectFilter ? all.filter(g => g.subject === selectedSubjectFilter) : all;
}

function openCalcSheet() {
  openSheet(`
    <h3>Какая оценка нужна?</h3>
    <label>Желаемый средний балл</label>
    <input id="calcTarget" type="number" step="0.1" value="4.5">
    <label>Сколько оценок ещё будет</label>
    <input id="calcCount" type="number" value="3">
    <button class="primary" onclick="runCalc()">Посчитать</button>
    <div id="calcResult" style="margin-top:14px; text-align:center; font-size:15px;"></div>
  `);
}

function runCalc() {
  const target = parseFloat(document.getElementById('calcTarget').value.replace(',', '.'));
  const count = parseInt(document.getElementById('calcCount').value);
  const resultEl = document.getElementById('calcResult');
  if (!target || !count || count <= 0) { resultEl.textContent = 'Проверь введённые числа'; return; }

  const list = currentGradeList();
  const currentSum = list.reduce((a, g) => a + g.value, 0);
  const currentCount = list.length;
  const neededTotal = target * (currentCount + count);
  const neededFromNew = neededTotal - currentSum;
  const perGrade = neededFromNew / count;

  if (perGrade > 5) resultEl.textContent = `Даже с одними пятёрками до ${target} не дотянуть за ${count} оценок 😅`;
  else if (perGrade <= 2) resultEl.textContent = 'Цель уже практически достигнута!';
  else resultEl.textContent = `Нужно в среднем ${perGrade.toFixed(2)} балла за каждую из следующих ${count} оценок`;
}

function renderGrades() {
  const all = load(DB_KEYS.grades);
  const subjects = [...new Set(all.map(g => g.subject))].sort();
  const list = currentGradeList();

  document.getElementById('avgSubjectLabel').textContent = selectedSubjectFilter || 'Средний балл (все предметы)';
  const avg = list.length ? (list.reduce((a, g) => a + g.value, 0) / list.length) : null;
  document.getElementById('avgValue').textContent = avg ? avg.toFixed(2) : '—';

  document.getElementById('subjectChips').innerHTML =
    `<span class="chip ${!selectedSubjectFilter ? 'selected' : ''}" onclick="filterSubject(null)">Все</span>` +
    subjects.map(s => `<span class="chip ${selectedSubjectFilter === s ? 'selected' : ''}" onclick="filterSubject('${s.replace(/'/g,"\\'")}')">${escapeHtml(s)}</span>`).join('');

  document.getElementById('gradesEmpty').style.display = list.length === 0 ? 'block' : 'none';
  document.getElementById('gradesList').innerHTML = [...list].reverse().map(g => {
    const dateStr = new Date(g.date).toLocaleDateString('ru-RU');
    return `
      <div class="grade-item">
        <span class="badge g${g.value}">${g.value}</span>
        <div class="hw-info">
          <div class="hw-title">${escapeHtml(g.subject)}</div>
          <div class="hw-sub">${dateStr}</div>
        </div>
        <span onclick="deleteGrade(${g.id})" style="color:var(--text-dim); padding:6px;">✕</span>
      </div>`;
  }).join('');
}

/* ============================================================
   УВЕДОМЛЕНИЯ (best-effort — см. README про ограничения PWA)
   ============================================================ */
function scheduleReminder(hw) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') Notification.requestPermission();
  // Напоминание сработает только пока это окно/вкладка открыты в браузере —
  // это ограничение веб-платформы, подробности в README.
  const reminderTime = new Date(hw.dueDate);
  reminderTime.setDate(reminderTime.getDate() - 1);
  reminderTime.setHours(19, 0, 0, 0);
  const delay = reminderTime.getTime() - Date.now();
  if (delay > 0 && delay < 24 * 3600 * 1000 * 30) {
    setTimeout(() => {
      if (Notification.permission === 'granted') {
        new Notification('Напоминание: ' + hw.subject, { body: hw.title, icon: 'icons/icon-192.png' });
      }
    }, delay);
  }
}

/* ---------------- Utils ---------------- */
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function renderAll() {
  renderHomework();
  renderExams();
  renderNotes();
  renderGrades();
}

/* ---------------- Init ---------------- */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

// Подсказка "добавить на главный экран" на Android (Chrome)
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const banner = document.getElementById('installBanner');
  banner.classList.add('show');
  banner.style.cursor = 'pointer';
  banner.textContent = '📲 Нажми, чтобы установить приложение на телефон';
  banner.onclick = () => {
    banner.classList.remove('show');
    deferredInstallPrompt.prompt();
  };
});

renderAll();
