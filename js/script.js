/* ═══════════════════════════════════════════════════════════════
   LIFE DASHBOARD  –  Vanilla JS
   ═══════════════════════════════════════════════════════════════ */

/* ── LOCAL STORAGE HELPERS ──────────────────────────────────── */
const ls = {
  get: (k, fallback = null) => {
    try { const v = localStorage.getItem(k); return v !== null ? JSON.parse(v) : fallback; } catch { return fallback; }
  },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};

/* ── STATE ──────────────────────────────────────────────────── */
let todos      = ls.get('ld_todos', []);
let links      = ls.get('ld_links', []);
let userName   = ls.get('ld_name', '');
let pomCount   = ls.get('ld_pomCount', { date: '', count: 0 });
let dailyData  = ls.get('ld_daily', {});   // { 'YYYY-MM-DD': { added, done } }
let editIndex  = -1;

/* ─── THEME ─────────────────────────────────────────────────── */
(function initTheme() {
  const saved = ls.get('ld_theme', 'light');
  document.documentElement.setAttribute('data-theme', saved);
})();

document.getElementById('themeToggle').addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  ls.set('ld_theme', next);
  if (progressChart) updateChart();
});

/* ─── GREETING & CLOCK ──────────────────────────────────────── */
function updateClock() {
  const now  = new Date();
  const h    = now.getHours();
  const pad  = n => String(n).padStart(2, '0');
  const time = `${pad(h)}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  document.getElementById('clock').textContent = time;

  const greeting = h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
  document.getElementById('greetingText').textContent = greeting;

  const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('currentDate').textContent =
    `${days[now.getDay()]}, ${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
}

function saveName() {
  const input = document.getElementById('nameInput');
  const name  = input.value.trim();
  if (!name) return;
  userName = name;
  ls.set('ld_name', name);
  document.getElementById('displayName').textContent = name;
  input.value = '';
}

function initGreeting() {
  if (userName) document.getElementById('displayName').textContent = userName;
  updateClock();
  setInterval(updateClock, 1000);
}

/* ─── TO-DO LIST ────────────────────────────────────────────── */
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function addTodo() {
  const input = document.getElementById('todoInput');
  const text  = input.value.trim();
  const errEl = document.getElementById('todoError');

  if (!text) { errEl.textContent = 'Task cannot be empty.'; return; }

  const dup = todos.some(t => t.text.toLowerCase() === text.toLowerCase());
  if (dup) { errEl.textContent = 'This task already exists.'; return; }

  errEl.textContent = '';

  const todo = { id: Date.now(), text, done: false, createdAt: Date.now() };
  todos.push(todo);
  ls.set('ld_todos', todos);

  // record daily add
  const dk = todayKey();
  if (!dailyData[dk]) dailyData[dk] = { added: 0, done: 0 };
  dailyData[dk].added++;
  ls.set('ld_daily', dailyData);

  input.value = '';
  renderTodos();
  updateStats();
  updateInsights();
  updateChart();
}

document.getElementById('todoInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') addTodo();
});

function toggleTodo(id) {
  const t = todos.find(x => x.id === id);
  if (!t) return;
  t.done = !t.done;

  // record daily done
  const dk = todayKey();
  if (!dailyData[dk]) dailyData[dk] = { added: 0, done: 0 };
  if (t.done) dailyData[dk].done++;
  else dailyData[dk].done = Math.max(0, dailyData[dk].done - 1);
  ls.set('ld_daily', dailyData);

  ls.set('ld_todos', todos);
  renderTodos();
  updateStats();
  updateInsights();
  updateChart();
}

function deleteTodo(id) {
  todos = todos.filter(x => x.id !== id);
  ls.set('ld_todos', todos);
  renderTodos();
  updateStats();
  updateInsights();
  updateChart();
}

function openEditModal(id) {
  const t = todos.find(x => x.id === id);
  if (!t) return;
  editIndex = id;
  document.getElementById('editInput').value = t.text;
  document.getElementById('editModal').classList.add('open');
  document.getElementById('editInput').focus();
}

function saveEdit() {
  const newText = document.getElementById('editInput').value.trim();
  if (!newText) return;

  const dup = todos.some(x => x.id !== editIndex && x.text.toLowerCase() === newText.toLowerCase());
  if (dup) { alert('A task with this name already exists.'); return; }

  const t = todos.find(x => x.id === editIndex);
  if (t) t.text = newText;
  ls.set('ld_todos', todos);
  closeModal();
  renderTodos();
}

function closeModal() {
  document.getElementById('editModal').classList.remove('open');
  editIndex = -1;
}

// close modal on overlay click
document.getElementById('editModal').addEventListener('click', e => {
  if (e.target === document.getElementById('editModal')) closeModal();
});

function renderTodos() {
  const sortBy = document.getElementById('sortSelect').value;
  let list = [...todos];

  if (sortBy === 'status') {
    list.sort((a, b) => a.done - b.done);
  } else {
    list.sort((a, b) => b.createdAt - a.createdAt);
  }

  const ul = document.getElementById('todoList');
  ul.innerHTML = '';

  if (list.length === 0) {
    ul.innerHTML = '<li class="empty-state">No tasks yet. Add one above!</li>';
    return;
  }

  list.forEach(t => {
    const li = document.createElement('li');
    li.className = `todo-item${t.done ? ' done' : ''}`;
    li.dataset.id = t.id;

    const timeStr = formatTime(t.createdAt);

    li.innerHTML = `
      <div class="todo-checkbox${t.done ? ' checked' : ''}" onclick="toggleTodo(${t.id})" title="Mark complete"></div>
      <span class="todo-text">${escHtml(t.text)}</span>
      <span class="todo-time">${timeStr}</span>
      <div class="todo-actions">
        <button class="icon-btn" onclick="openEditModal(${t.id})" title="Edit">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="icon-btn delete" onclick="deleteTodo(${t.id})" title="Delete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/>
            <path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>`;
    ul.appendChild(li);
  });
}

/* ─── STATS ─────────────────────────────────────────────────── */
function updateStats() {
  const total   = todos.length;
  const done    = todos.filter(t => t.done).length;
  const pct     = total > 0 ? Math.round((done / total) * 100) : 0;
  const pending = total - done;

  document.getElementById('statTotal').textContent   = total;
  document.getElementById('statDone').textContent    = done;
  document.getElementById('statPercent').textContent = pct + '%';
  document.getElementById('statPending').textContent = pending;
}

/* ─── POMODORO TIMER ────────────────────────────────────────── */
let timerInterval = null;
let timerDuration = ls.get('ld_pomDuration', 25) * 60;  // seconds
let timeLeft      = timerDuration;
let timerRunning  = false;
const CIRCUMFERENCE = 2 * Math.PI * 88; // r=88

function updateRing(remaining, total) {
  const offset = CIRCUMFERENCE * (1 - remaining / total);
  document.getElementById('ringProgress').style.strokeDashoffset = offset;
}

function renderTimer() {
  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;
  const pad = n => String(n).padStart(2, '0');
  document.getElementById('timerDisplay').textContent = `${pad(m)}:${pad(s)}`;
  updateRing(timeLeft, timerDuration);
  document.title = timerRunning ? `⏱ ${pad(m)}:${pad(s)} – Dashboard` : 'Life Dashboard';
}

function startTimer() {
  if (timerRunning) return;
  timerRunning = true;
  document.getElementById('timerLabel').textContent = 'Focusing…';
  document.getElementById('startBtn').disabled = true;

  timerInterval = setInterval(() => {
    timeLeft--;
    renderTimer();
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      timerRunning = false;
      document.getElementById('startBtn').disabled = false;
      document.getElementById('timerLabel').textContent = 'Session complete! 🎉';
      document.title = 'Life Dashboard';
      incrementPomodoro();
      timeLeft = timerDuration;
      renderTimer();
      notifyDone();
    }
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  document.getElementById('startBtn').disabled = false;
  document.getElementById('timerLabel').textContent = 'Paused';
}

function resetTimer() {
  clearInterval(timerInterval);
  timerRunning = false;
  timeLeft = timerDuration;
  document.getElementById('startBtn').disabled = false;
  document.getElementById('timerLabel').textContent = 'Ready to focus';
  document.title = 'Life Dashboard';
  renderTimer();
}

function setCustomDuration() {
  const val = parseInt(document.getElementById('durationInput').value, 10);
  if (isNaN(val) || val < 1 || val > 120) {
    alert('Please enter a duration between 1 and 120 minutes.');
    return;
  }
  timerDuration = val * 60;
  ls.set('ld_pomDuration', val);
  resetTimer();
}

function incrementPomodoro() {
  const today = todayKey();
  if (pomCount.date !== today) pomCount = { date: today, count: 0 };
  pomCount.count++;
  ls.set('ld_pomCount', pomCount);
  document.getElementById('pomodoroCount').textContent = pomCount.count;
  document.getElementById('insightSessions').textContent = `${pomCount.count} today`;
}

function notifyDone() {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Focus session complete!', { body: 'Great work — time for a break.' });
  }
}

function initTimer() {
  const savedDur = ls.get('ld_pomDuration', 25);
  document.getElementById('durationInput').value = savedDur;
  timerDuration = savedDur * 60;
  timeLeft = timerDuration;

  const today = todayKey();
  if (pomCount.date !== today) pomCount = { date: today, count: 0 };
  document.getElementById('pomodoroCount').textContent = pomCount.count;

  renderTimer();

  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

/* ─── QUICK LINKS ───────────────────────────────────────────── */
function addLink() {
  const nameEl  = document.getElementById('linkName');
  const urlEl   = document.getElementById('linkUrl');
  const errEl   = document.getElementById('linkError');
  const name    = nameEl.value.trim();
  let   url     = urlEl.value.trim();

  if (!name || !url) { errEl.textContent = 'Both label and URL are required.'; return; }
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  try { new URL(url); } catch { errEl.textContent = 'Please enter a valid URL.'; return; }

  errEl.textContent = '';
  links.push({ id: Date.now(), name, url });
  ls.set('ld_links', links);
  nameEl.value = '';
  urlEl.value  = '';
  renderLinks();
}

document.getElementById('linkUrl').addEventListener('keydown', e => {
  if (e.key === 'Enter') addLink();
});

function deleteLink(id) {
  links = links.filter(l => l.id !== id);
  ls.set('ld_links', links);
  renderLinks();
}

function renderLinks() {
  const container = document.getElementById('linksList');
  container.innerHTML = '';

  if (links.length === 0) {
    container.innerHTML = '<p class="empty-state">No links yet. Add one above!</p>';
    return;
  }

  links.forEach(l => {
    const wrap = document.createElement('div');
    wrap.className = 'link-chip-wrap';

    const hostname = (() => { try { return new URL(l.url).hostname; } catch { return ''; } })();
    const faviconUrl = hostname ? `https://www.google.com/s2/favicons?domain=${hostname}&sz=16` : '';

    wrap.innerHTML = `
      <a class="link-chip" href="${escHtml(l.url)}" target="_blank" rel="noopener noreferrer">
        ${faviconUrl ? `<img src="${faviconUrl}" alt="" onerror="this.remove()">` : ''}
        <span>${escHtml(l.name)}</span>
      </a>
      <button class="del-link" onclick="deleteLink(${l.id})" title="Remove link">✕</button>`;
    container.appendChild(wrap);
  });
}

/* ─── AI INSIGHTS ───────────────────────────────────────────── */
function updateInsights() {
  const total = todos.length;
  const done  = todos.filter(t => t.done).length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

  document.getElementById('insightPercent').textContent = total > 0 ? `${pct}%` : '—';

  let msg = 'No data yet';
  if (total > 0) {
    if (pct > 80)        msg = 'Excellent productivity';
    else if (pct >= 50)  msg = 'Good progress';
    else                 msg = 'You need improvement';
  }
  document.getElementById('insightMsg').textContent = msg;

  // most active day
  const entries = Object.entries(dailyData);
  if (entries.length > 0) {
    const best = entries.reduce((a, b) => (b[1].done > a[1].done ? b : a));
    const d = new Date(best[0] + 'T00:00:00');
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    document.getElementById('insightActiveDay').textContent =
      best[1].done > 0 ? `${days[d.getDay()]} (${best[1].done} done)` : '—';
  }

  // sessions
  const today = todayKey();
  if (pomCount.date !== today) pomCount = { date: today, count: 0 };
  document.getElementById('insightSessions').textContent = `${pomCount.count} today`;

  // banner
  const bannerEl = document.getElementById('insightBannerText');
  if (total === 0) {
    bannerEl.textContent = 'Add tasks to see your productivity insights.';
  } else if (pct > 80) {
    bannerEl.textContent = `Outstanding! You've completed ${pct}% of your tasks today.`;
  } else if (pct >= 50) {
    bannerEl.textContent = `You're making progress — ${pct}% done. Keep going!`;
  } else {
    bannerEl.textContent = `Only ${pct}% complete. Focus on knocking out a few more tasks.`;
  }
}

/* ─── CHART ─────────────────────────────────────────────────── */
let progressChart = null;

function getLast7Days() {
  const labels = [];
  const addedData = [];
  const doneData  = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key   = d.toISOString().slice(0, 10);
    const short = d.toLocaleDateString('en-US', { weekday: 'short' });
    labels.push(short);
    addedData.push(dailyData[key]?.added || 0);
    doneData.push(dailyData[key]?.done  || 0);
  }

  return { labels, addedData, doneData };
}

function updateChart() {
  const { labels, addedData, doneData } = getLast7Days();
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const gridColor  = isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)';
  const tickColor  = isDark ? '#9ca3af' : '#6b7280';

  if (progressChart) {
    progressChart.data.labels = labels;
    progressChart.data.datasets[0].data = addedData;
    progressChart.data.datasets[1].data = doneData;
    progressChart.options.scales.x.ticks.color = tickColor;
    progressChart.options.scales.y.ticks.color = tickColor;
    progressChart.options.scales.x.grid.color  = gridColor;
    progressChart.options.scales.y.grid.color  = gridColor;
    progressChart.update();
    return;
  }

  const ctx = document.getElementById('progressChart').getContext('2d');
  progressChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Added',
          data: addedData,
          backgroundColor: 'rgba(124,58,237,.2)',
          borderColor: '#7c3aed',
          borderWidth: 2,
          borderRadius: 6,
        },
        {
          label: 'Completed',
          data: doneData,
          backgroundColor: 'rgba(16,185,129,.2)',
          borderColor: '#10b981',
          borderWidth: 2,
          borderRadius: 6,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: tickColor,
            font: { size: 12 },
            boxWidth: 12,
            padding: 16
          }
        }
      },
      scales: {
        x: {
          ticks: { color: tickColor, font: { size: 11 } },
          grid:  { color: gridColor },
          border:{ display: false }
        },
        y: {
          beginAtZero: true,
          ticks: { color: tickColor, font: { size: 11 }, stepSize: 1 },
          grid:  { color: gridColor },
          border:{ display: false }
        }
      }
    }
  });
}

/* ─── SIDEBAR NAV ACTIVE STATE ──────────────────────────────── */
function initSidebarNav() {
  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.section, .two-col-row, .stats-row, #todo-section, #timer-section, #links-section, #insights-section');

  window.addEventListener('scroll', () => {
    let current = '';
    document.querySelectorAll('#greeting-section, #todo-section, #timer-section, #links-section, #insights-section').forEach(sec => {
      const rect = sec.getBoundingClientRect();
      if (rect.top <= 120) current = sec.id;
    });
    navItems.forEach(item => {
      const href = item.getAttribute('href').replace('#', '');
      item.classList.toggle('active', href === current);
    });
  }, { passive: true });
}

/* ─── UTILITIES ─────────────────────────────────────────────── */
function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

/* ─── INIT ──────────────────────────────────────────────────── */
function init() {
  initGreeting();
  initTimer();
  renderTodos();
  renderLinks();
  updateStats();
  updateInsights();
  updateChart();
  initSidebarNav();
}

document.addEventListener('DOMContentLoaded', init);
