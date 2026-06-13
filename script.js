/**
 * CARBON TWIN AI — script.js
 * Complete application logic: Carbon calculation engine, twin visualization,
 * quests, badges, simulator, charts, and data management.
 */

'use strict';

/* ============================================================
   1. CONSTANTS & EMISSION FACTORS
   ============================================================ */

/** kg CO₂ per km for each transport mode */
const TRANSPORT_FACTORS = {
  car:      0.21,
  bike:     0.103,
  bicycle:  0.0,
  bus:      0.089,
  train:    0.041,
  walk:     0.0
};

/** kg CO₂ per day for each food type */
const FOOD_FACTORS = {
  vegan:       1.5,
  vegetarian:  2.5,
  mixed:       5.0,
  'meat-heavy': 7.5
};

/** kg CO₂ per hour for general electricity */
const ELECTRICITY_FACTOR = 0.4;

/** kg CO₂ per hour for AC/Heating (higher load) */
const AC_FACTOR = 0.75;

/** kg CO₂ for shopping levels */
const SHOPPING_FACTORS = {
  none:  0,
  light: 2.0,
  heavy: 8.0
};

/** Environmental average: 12 kg CO₂/day for average person */
const AVG_DAILY_EMISSIONS = 12;

/** Quotes database */
const QUOTES = [
  { text: "The Earth does not belong to us, we belong to the Earth.", author: "Chief Seattle" },
  { text: "The greatest threat to our planet is the belief that someone else will save it.", author: "Robert Swan" },
  { text: "We do not inherit the earth from our ancestors, we borrow it from our children.", author: "Antoine de Saint-Exupéry" },
  { text: "In every walk with nature, one receives far more than he seeks.", author: "John Muir" },
  { text: "The environment is where we all meet, where we all have a mutual interest.", author: "Lady Bird Johnson" },
  { text: "Act as if what you do makes a difference. It does.", author: "William James" },
  { text: "Small acts, when multiplied by millions of people, can transform the world.", author: "Howard Zinn" },
  { text: "Be the change you wish to see in the world.", author: "Mahatma Gandhi" }
];

/** Achievement/badge definitions */
const BADGES = [
  { id: 'green-beginner',   icon: '🌱', name: 'Green Beginner',    req: 'Log first activity',         condition: d => d.logs.length >= 1 },
  { id: 'eco-explorer',     icon: '🌍', name: 'Eco Explorer',       req: 'Log 5 days',                 condition: d => d.logs.length >= 5 },
  { id: 'carbon-saver',     icon: '💚', name: 'Carbon Saver',       req: 'Stay below 8 kg for 3 days', condition: d => d.logs.filter(l => l.total <= 8).length >= 3 },
  { id: 'planet-protector', icon: '🛡️', name: 'Planet Protector',   req: 'Log 14 days',                condition: d => d.logs.length >= 14 },
  { id: 'quest-master',     icon: '⚡', name: 'Quest Master',       req: 'Complete 10 quests',         condition: d => d.questsCompleted >= 10 },
  { id: 'vegan-champion',   icon: '🥗', name: 'Vegan Champion',     req: 'Log vegan 3 days in a row',  condition: d => hasConsecutiveVegan(d, 3) },
  { id: 'bike-hero',        icon: '🚲', name: 'Bike Hero',          req: 'Use bicycle 5 times',        condition: d => d.logs.filter(l => l.transport === 'bicycle').length >= 5 },
  { id: 'streak-king',      icon: '🔥', name: 'Streak King',        req: '7-day streak',               condition: d => d.streak >= 7 }
];

/** Quest pool */
const QUEST_POOL = [
  { id: 'q1',  icon: '🚶', title: 'Walk 1 km today',             desc: 'Skip motorized transport for at least 1 km.',      xp: 20 },
  { id: 'q2',  icon: '🥦', title: 'Eat a vegetarian meal',       desc: 'Choose a plant-based option for any meal today.',  xp: 15 },
  { id: 'q3',  icon: '💡', title: 'Reduce electricity by 1 hour', desc: 'Turn off devices an hour earlier tonight.',        xp: 10 },
  { id: 'q4',  icon: '❄️', title: 'Skip AC for 2 hours',         desc: 'Open a window instead of running the AC.',         xp: 15 },
  { id: 'q5',  icon: '🛍️', title: 'Zero shopping today',         desc: 'Avoid any unnecessary purchases.',                 xp: 10 },
  { id: 'q6',  icon: '🚌', title: 'Take public transport',       desc: 'Use a bus or train for your commute.',             xp: 20 },
  { id: 'q7',  icon: '🌱', title: 'Log your activities',          desc: 'Track everything you do today in the app.',        xp: 5  },
  { id: 'q8',  icon: '🍎', title: 'Eat vegan for a day',         desc: 'Go fully plant-based for all meals.',              xp: 30 },
  { id: 'q9',  icon: '🚲', title: 'Cycle to your destination',   desc: 'Use a bicycle for at least one trip.',             xp: 25 },
  { id: 'q10', icon: '♻️', title: 'Recycle something today',     desc: 'Sort and recycle at least one item.',              xp: 10 }
];

/** Twin avatar states based on eco score */
const TWIN_STATES = {
  excellent: { avatar: '🧑‍🌾', sky: 'linear-gradient(180deg, #001833 0%, #003d14 60%, #1a5c2a 100%)', trees: 5, polluted: false },
  good:      { avatar: '😊',    sky: 'linear-gradient(180deg, #002244 0%, #004d20 60%, #1a5c2a 100%)', trees: 4, polluted: false },
  moderate:  { avatar: '😐',    sky: 'linear-gradient(180deg, #1a1000 0%, #3d2600 60%, #2a1a00 100%)', trees: 2, polluted: true  },
  poor:      { avatar: '😰',    sky: 'linear-gradient(180deg, #1a0a00 0%, #2d1300 60%, #1a0a00 100%)', trees: 1, polluted: true  },
  critical:  { avatar: '😵',    sky: 'linear-gradient(180deg, #0d0000 0%, #1a0000 60%, #0d0000 100%)', trees: 0, polluted: true  }
};

/* ============================================================
   2. DATA STORE (localStorage)
   ============================================================ */

/**
 * Load app data from localStorage.
 * @returns {Object} Parsed app state
 */
function loadData() {
  try {
    const raw = localStorage.getItem('carbonTwinData');
    if (!raw) return getDefaultData();
    return { ...getDefaultData(), ...JSON.parse(raw) };
  } catch {
    return getDefaultData();
  }
}

/** Returns a fresh default data structure */
function getDefaultData() {
  return {
    logs: [],             // Array of daily log entries
    quests: [],           // Today's quests
    questDate: null,      // Date string for quest rotation
    questsCompleted: 0,   // Total quests ever completed
    streak: 0,            // Consecutive logging days
    lastLogDate: null,    // ISO date string of last log
    theme: 'dark',        // 'dark' | 'light'
    largeText: false,
    unlockedBadges: []
  };
}

/**
 * Save app data to localStorage.
 * @param {Object} data - Data to persist
 */
function saveData(data) {
  try {
    localStorage.setItem('carbonTwinData', JSON.stringify(data));
  } catch (e) {
    console.warn('Storage unavailable:', e);
  }
}

/* ============================================================
   3. CARBON CALCULATION ENGINE
   ============================================================ */

/**
 * Calculate daily CO₂ emissions from activity inputs.
 * @param {Object} params - Activity parameters
 * @returns {Object} Breakdown and total kg CO₂
 */
function calculateEmissions({ transport = 'car', km = 10, food = 'mixed', electricity = 8, ac = 2, shopping = 'none' }) {
  const transportCO2   = (TRANSPORT_FACTORS[transport] || 0) * km;
  const foodCO2        = FOOD_FACTORS[food] || FOOD_FACTORS.mixed;
  const electricityCO2 = electricity * ELECTRICITY_FACTOR;
  const acCO2          = ac * AC_FACTOR;
  const shoppingCO2    = SHOPPING_FACTORS[shopping] || 0;

  const total = transportCO2 + foodCO2 + electricityCO2 + acCO2 + shoppingCO2;

  return {
    transport: round2(transportCO2),
    food:      round2(foodCO2),
    energy:    round2(electricityCO2 + acCO2),
    shopping:  round2(shoppingCO2),
    total:     round2(total)
  };
}

/**
 * Calculate eco score (0-100) based on emissions.
 * 100 = net zero, 0 = 20+ kg/day
 * @param {number} kgCO2 - Daily emissions
 * @returns {number} Score 0-100
 */
function calcEcoScore(kgCO2) {
  if (kgCO2 <= 0)  return 100;
  if (kgCO2 >= 20) return 0;
  return Math.round(100 - (kgCO2 / 20) * 100);
}

/**
 * Get named level from eco score.
 * @param {number} score - Eco score 0-100
 * @returns {string} Level name
 */
function getEcoLevel(score) {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'moderate';
  if (score >= 20) return 'poor';
  return 'critical';
}

/** Friendly label for eco level */
function getLevelLabel(level) {
  const labels = { excellent: '🌿 Excellent', good: '✅ Good', moderate: '⚠️ Moderate', poor: '❗ High', critical: '🚨 Critical' };
  return labels[level] || 'Unknown';
}

/* ============================================================
   4. PAGE NAVIGATION
   ============================================================ */

/** Currently active page */
let currentPage = 'landing';

/**
 * Show a named page and hide all others.
 * @param {string} pageName - Page ID
 */
function showPage(pageName) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active');
    p.setAttribute('aria-hidden', 'true');
  });

  // Show target
  const target = document.getElementById(`page-${pageName}`);
  if (target) {
    target.classList.add('active');
    target.removeAttribute('aria-hidden');
    document.body.setAttribute('data-page', pageName);
  }

  currentPage = pageName;
  closeMobileMenu();

  // Refresh page-specific data
  if (pageName === 'dashboard') refreshDashboard();
  if (pageName === 'twin')      refreshTwin();
  if (pageName === 'quests')    refreshQuests();
  if (pageName === 'stats')     refreshStats();

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ============================================================
   5. THEME TOGGLE
   ============================================================ */

function toggleTheme() {
  const data = loadData();
  const isDark = document.body.getAttribute('data-theme') === 'dark';
  const newTheme = isDark ? 'light' : 'dark';

  document.body.setAttribute('data-theme', newTheme);
  document.getElementById('themeToggle').querySelector('.theme-icon').textContent = isDark ? '☀️' : '🌙';

  // Sync the settings toggle
  const settingsToggle = document.getElementById('darkModeToggle');
  if (settingsToggle) settingsToggle.checked = !isDark;

  data.theme = newTheme;
  saveData(data);
}

function toggleLargeText() {
  const data = loadData();
  const toggle = document.getElementById('largeTextToggle');
  const enabled = toggle.checked;
  document.body.setAttribute('data-large-text', enabled ? 'true' : 'false');
  data.largeText = enabled;
  saveData(data);
}

/* ============================================================
   6. MOBILE MENU
   ============================================================ */

function toggleMobileMenu() {
  const nav = document.getElementById('mobileNav');
  const btn = document.getElementById('mobileMenuBtn');
  const isOpen = nav.classList.contains('open');
  nav.classList.toggle('open');
  btn.setAttribute('aria-expanded', !isOpen);
  nav.setAttribute('aria-hidden', isOpen);
}

function closeMobileMenu() {
  const nav = document.getElementById('mobileNav');
  const btn = document.getElementById('mobileMenuBtn');
  nav.classList.remove('open');
  btn.setAttribute('aria-expanded', 'false');
  nav.setAttribute('aria-hidden', 'true');
}

/* ============================================================
   7. NOTIFICATIONS
   ============================================================ */

let notifTimer = null;

/**
 * Show an animated notification message.
 * @param {string} msg - Message text
 * @param {number} duration - Display time in ms
 */
function showNotification(msg, duration = 3000) {
  const el = document.getElementById('notification');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(notifTimer);
  notifTimer = setTimeout(() => el.classList.remove('show'), duration);
}

/* ============================================================
   8. ACTIVITY LOGGER
   ============================================================ */

/** Update the live preview panel while user adjusts inputs */
function updateLivePreview() {
  const params = getCurrentFormValues();
  if (!params) return;

  const emissions = calculateEmissions(params);

  // Update preview values
  setText('previewEmission', emissions.total.toFixed(1));
  setText('pb-transport', `${emissions.transport.toFixed(1)} kg`);
  setText('pb-food',      `${emissions.food.toFixed(1)} kg`);
  setText('pb-energy',    `${emissions.energy.toFixed(1)} kg`);
  setText('pb-shopping',  `${emissions.shopping.toFixed(1)} kg`);

  // Color the main number by level
  const score = calcEcoScore(emissions.total);
  const level = getEcoLevel(score);
  const el = document.getElementById('previewEmission');
  if (el) {
    el.style.color = { excellent: 'var(--accent-green)', good: 'var(--accent-emerald)', moderate: 'var(--accent-amber)', poor: 'var(--accent-red)', critical: '#dc2626' }[level] || 'var(--accent-green)';
  }

  // Level indicator
  const levelColors = { excellent: '#22c55e', good: '#10b981', moderate: '#f59e0b', poor: '#ef4444', critical: '#dc2626' };
  const dot = document.querySelector('.level-dot');
  if (dot) dot.style.background = levelColors[level] || '#22c55e';
  setText('levelText', getLevelLabel(level));
}

/** Read current form values */
function getCurrentFormValues() {
  const transport  = document.querySelector('input[name="transport"]:checked')?.value || 'car';
  const food       = document.querySelector('input[name="food"]:checked')?.value || 'mixed';
  const shopping   = document.querySelector('input[name="shopping"]:checked')?.value || 'none';
  const km         = parseFloat(document.getElementById('transportKm')?.value || 10);
  const electricity= parseFloat(document.getElementById('electricityHours')?.value || 8);
  const ac         = parseFloat(document.getElementById('acHours')?.value || 2);
  return { transport, km, food, electricity, ac, shopping };
}

/** Save a new daily log entry */
function logActivity() {
  const params = getCurrentFormValues();
  const emissions = calculateEmissions(params);

  const data = loadData();
  const today = todayString();

  // Create log entry
  const entry = {
    date: today,
    ...params,
    ...emissions,
    timestamp: Date.now()
  };

  // Remove existing log for today (one log per day)
  data.logs = data.logs.filter(l => l.date !== today);
  data.logs.push(entry);

  // Update streak
  updateStreak(data, today);

  // Check badges
  const newBadges = checkBadges(data);

  saveData(data);
  renderLogHistory(data);
  refreshDashboard();

  // Show notification
  showNotification(`✅ Logged! ${emissions.total.toFixed(1)} kg CO₂ today — Eco Score: ${calcEcoScore(emissions.total)}/100`);

  // Badge notifications
  newBadges.forEach(b => {
    setTimeout(() => showNotification(`🏆 Badge Unlocked: ${b.name}!`, 4000), 1200);
  });
}

/** Update the consecutive logging streak */
function updateStreak(data, today) {
  const yesterday = dateString(-1);
  if (data.lastLogDate === yesterday) {
    data.streak++;
  } else if (data.lastLogDate !== today) {
    data.streak = 1;
  }
  data.lastLogDate = today;
}

/** Render recent log history */
function renderLogHistory(data) {
  const container = document.getElementById('logHistory');
  if (!container) return;

  const recent = [...data.logs].reverse().slice(0, 8);

  if (recent.length === 0) {
    container.innerHTML = '<p class="empty-state">No logs yet.</p>';
    return;
  }

  container.innerHTML = recent.map(l => `
    <div class="log-entry" role="listitem">
      <div class="log-entry-date">${formatDate(l.date)}</div>
      <div class="log-entry-val">${l.total.toFixed(1)} kg CO₂</div>
      <div class="log-entry-detail">
        ${l.transport} · ${l.food} · ${l.electricity}h electricity
      </div>
    </div>
  `).join('');
}

/* ============================================================
   9. DASHBOARD
   ============================================================ */

function refreshDashboard() {
  const data = loadData();
  const today = todayString();
  const todayLog = data.logs.find(l => l.date === today);

  // Today
  setText('todayEmissions', todayLog ? todayLog.total.toFixed(1) : '0.0');
  setText('todayTrend', todayLog ? getLevelLabel(getEcoLevel(calcEcoScore(todayLog.total))) : 'No log today');

  // Week
  const weekLogs = getLogsInRange(data.logs, 7);
  const weekTotal = sumTotal(weekLogs);
  setText('weekEmissions', weekTotal.toFixed(1));
  setText('weekTrend', weekLogs.length > 0 ? `${weekLogs.length} day${weekLogs.length !== 1 ? 's' : ''} logged` : 'Log activities to start');

  // Month
  const monthLogs = getLogsInRange(data.logs, 30);
  const monthTotal = sumTotal(monthLogs);
  setText('monthEmissions', monthTotal.toFixed(1));
  setText('monthTrend', monthLogs.length > 0 ? `${monthLogs.length} days this month` : '—');

  // Eco score (last 7 days average or today)
  if (weekLogs.length > 0) {
    const avgDay = weekTotal / weekLogs.length;
    const score = calcEcoScore(avgDay);
    setText('ecoScore', score);
    setText('ecoLevel', getLevelLabel(getEcoLevel(score)));
  }

  // Streak
  setText('streakCount', data.streak || 0);

  // Reset AI flag so insights refresh with new data
  window._aiInsightsLoaded = false;

  // Progress bars
  renderProgressBars(weekLogs);

  // Suggestions
  renderSuggestions(data);

  // Badges
  renderBadges(data);

  // Quote
  rotateQuote('dashQuote');

  // Log history
  renderLogHistory(data);
}

function renderProgressBars(logs) {
  const container = document.getElementById('progressBars');
  if (!container) return;

  if (logs.length === 0) {
    container.innerHTML = '<p class="empty-state">Log activities to see your weekly breakdown.</p>';
    return;
  }

  // Get last 7 days with dates
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = dateString(-i);
    const log = logs.find(l => l.date === d);
    days.push({ date: d, total: log ? log.total : null });
  }

  const max = Math.max(...days.map(d => d.total || 0), 1);

  container.innerHTML = days.map(day => {
    const label = formatDateShort(day.date);
    const val = day.total !== null ? day.total.toFixed(1) : '—';
    const pct = day.total !== null ? Math.min((day.total / max) * 100, 100) : 0;
    const colorClass = day.total !== null ? (day.total <= 6 ? 'var(--accent-green)' : day.total <= 10 ? 'var(--accent-amber)' : 'var(--accent-red)') : 'rgba(34,197,94,0.2)';

    return `
      <div class="prog-row">
        <div class="prog-header">
          <span>${label}</span>
          <span>${val}${day.total !== null ? ' kg' : ''}</span>
        </div>
        <div class="prog-track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="${label}: ${val}">
          <div class="prog-fill" style="width:${pct}%;background:${colorClass}"></div>
        </div>
      </div>
    `;
  }).join('');
}

function renderSuggestions(data) {
  const container = document.getElementById('suggestionsList');
  const refreshBtn = document.getElementById('aiRefreshBtn');
  if (!container) return;

  if (data.logs.length === 0) {
    container.innerHTML = '<li class="suggestion-item">Log some activities and AI will generate personalised insights!</li>';
    if (refreshBtn) refreshBtn.style.display = 'none';
    return;
  }

  // Show fallback suggestions immediately, then fetch AI ones
  const fallback = generateSuggestions(data);
  container.innerHTML = fallback.map(s => `<li class="suggestion-item" role="listitem">${s}</li>`).join('');
  if (refreshBtn) refreshBtn.style.display = 'inline-flex';

  // Auto-fetch AI on first load
  if (!window._aiInsightsLoaded) {
    window._aiInsightsLoaded = true;
    fetchAiInsights(data);
  }
}

/** Fetch AI-generated personalised insights via Anthropic API */
async function fetchAiInsights(data) {
  const container  = document.getElementById('suggestionsList');
  const loading    = document.getElementById('aiLoadingState');
  const refreshBtn = document.getElementById('aiRefreshBtn');
  if (!container) return;

  // Build summary of user data
  const recent = data.logs.slice(-7);
  const avgTotal = recent.length ? (recent.reduce((a, l) => a + l.total, 0) / recent.length).toFixed(1) : 0;
  const transport = recent.length ? (recent.map(l => l.transport).sort((a,b) =>
    recent.filter(x=>x.transport===b).length - recent.filter(x=>x.transport===a).length)[0]) : 'unknown';
  const food = recent.length ? (recent.map(l => l.food).sort((a,b) =>
    recent.filter(x=>x.food===b).length - recent.filter(x=>x.food===a).length)[0]) : 'unknown';
  const avgAC = recent.length ? (recent.reduce((a,l) => a + (parseFloat(l.ac)||0), 0) / recent.length).toFixed(1) : 0;
  const avgElec = recent.length ? (recent.reduce((a,l) => a + (parseFloat(l.electricity)||0), 0) / recent.length).toFixed(1) : 0;
  const hasShopping = recent.some(l => l.shopping === 'heavy');

  const prompt = `You are a carbon footprint AI coach. Based on a user's recent activity data, generate exactly 4 personalised, specific, actionable eco insights with estimated CO₂ savings. Be direct and data-driven.

User's recent activity (last ${recent.length} days):
- Primary transport: ${transport}
- Average daily CO₂: ${avgTotal} kg
- Most common diet: ${food}
- Average AC/heating: ${avgAC} hours/day
- Average electricity: ${avgElec} hours/day
- Heavy shopping: ${hasShopping ? 'yes' : 'no'}
- Day streak: ${data.streak || 0} days

Respond ONLY with a JSON array of 4 strings. Each string should be one concise insight (1-2 sentences max) starting with a relevant emoji. Include specific numbers where possible. Example format:
["🚌 Switching from car to bus 3 days/week could save ~187 kg CO₂ annually.", "..."]`;

  if (loading) loading.style.display = 'flex';
  if (refreshBtn) refreshBtn.style.display = 'none';
  container.style.opacity = '0.4';

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) throw new Error(`API error ${response.status}`);
    const result = await response.json();
    const text = result.content?.map(c => c.text || '').join('').trim();

    // Parse JSON array from response
    const clean = text.replace(/```json|```/g, '').trim();
    const insights = JSON.parse(clean);

    if (Array.isArray(insights) && insights.length > 0) {
      container.innerHTML = insights.map(s =>
        `<li class="suggestion-item ai-insight" role="listitem">${s}</li>`
      ).join('');
    }
  } catch (err) {
    console.warn('AI insights unavailable, using local suggestions:', err);
    // Keep fallback already shown
  } finally {
    if (loading) loading.style.display = 'none';
    container.style.opacity = '1';
    if (refreshBtn) refreshBtn.style.display = 'inline-flex';
  }
}

/** Trigger a fresh AI insight fetch */
function refreshAiInsights() {
  window._aiInsightsLoaded = true;
  const data = loadData();
  fetchAiInsights(data);
}

/**
 * Generate local fallback suggestions based on user's logged data.
 * @param {Object} data - App state
 * @returns {string[]} Array of suggestion strings
 */
function generateSuggestions(data) {
  if (data.logs.length === 0) return [];

  const suggestions = [];
  const recent = data.logs.slice(-7);
  const avgAC = recent.reduce((a, l) => a + (parseFloat(l.ac) || 0), 0) / recent.length;
  const mostUsedTransport = getMostFrequent(recent.map(l => l.transport));
  const mostUsedFood = getMostFrequent(recent.map(l => l.food));
  const avgShopping = recent.filter(l => l.shopping === 'heavy').length / recent.length;

  if (mostUsedTransport === 'car' || mostUsedTransport === 'bike') {
    suggestions.push(`🚌 You mostly travel by ${mostUsedTransport}. Switching to public transport 3 days a week could save ~${Math.round(0.12 * 10 * 3 * 52)} kg CO₂/year.`);
  }
  if (mostUsedFood === 'meat-heavy') {
    suggestions.push('🥦 Your meat-heavy diet contributes significantly. Replacing 2 meat meals per week with vegetarian options saves ~200 kg CO₂/year.');
  }
  if (avgAC > 3) {
    suggestions.push(`❄️ You average ${avgAC.toFixed(1)}h of AC/heating daily. Reducing by just 1 hour saves ~${Math.round(AC_FACTOR * 365)} kg CO₂/year.`);
  }
  if (avgShopping > 0.3) {
    suggestions.push('🛍️ Frequent shopping adds up. Planning purchases and buying second-hand can cut 500+ kg CO₂/year.');
  }
  if (mostUsedTransport === 'bicycle' || mostUsedTransport === 'walk') {
    suggestions.push('🚲 Amazing! Your zero-emission commute is one of the biggest individual actions possible. Keep it up!');
  }
  if (suggestions.length === 0) {
    suggestions.push('📊 Keep logging your activities! After a few more days I\'ll have personalised recommendations for you.');
  }

  return suggestions.slice(0, 4);
}

function renderBadges(data) {
  const container = document.getElementById('badgesGrid');
  if (!container) return;

  container.innerHTML = BADGES.map(badge => {
    const unlocked = badge.condition(data);
    if (unlocked && !data.unlockedBadges.includes(badge.id)) {
      data.unlockedBadges.push(badge.id);
    }
    const isUnlocked = data.unlockedBadges.includes(badge.id) || unlocked;
    return `
      <div class="badge-item ${isUnlocked ? 'unlocked' : 'locked'}" 
           role="listitem" 
           title="${badge.req}"
           aria-label="${badge.name}: ${isUnlocked ? 'Unlocked' : 'Locked - ' + badge.req}">
        <div class="badge-icon">${badge.icon}</div>
        <div class="badge-name">${badge.name}</div>
      </div>
    `;
  }).join('');
}

/** Check for newly unlocked badges, return array of new ones */
function checkBadges(data) {
  const newBadges = [];
  BADGES.forEach(badge => {
    if (!data.unlockedBadges.includes(badge.id) && badge.condition(data)) {
      data.unlockedBadges.push(badge.id);
      newBadges.push(badge);
    }
  });
  return newBadges;
}

/* ============================================================
   10. CARBON TWIN VISUALIZATION — Animated SVG Scene
   ============================================================ */

/** Current twin SVG state */
let currentTwinSvgState = 'green';

/**
 * Map score to state name for the SVG scene
 */
function scoreToSvgState(score) {
  if (score >= 65) return 'green';
  if (score >= 35) return 'neutral';
  return 'polluted';
}

/**
 * Apply a state to the SVG twin scene with smooth transitions.
 * @param {'green'|'neutral'|'polluted'} state
 */
function applyTwinSvgState(state) {
  currentTwinSvgState = state;

  // Update tab buttons
  document.querySelectorAll('.twin-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.state === state);
    btn.setAttribute('aria-selected', btn.dataset.state === state);
  });

  const svg = document.getElementById('twinSceneSvg');
  if (!svg) return;

  // Sky
  const skyRect = document.getElementById('skyRect');
  if (skyRect) {
    const skyMap = { green: 'url(#skyGradGreen)', neutral: 'url(#skyGradNeutral)', polluted: 'url(#skyGradPolluted)' };
    skyRect.setAttribute('fill', skyMap[state]);
  }

  // Ground
  const groundRect = document.getElementById('groundRect');
  if (groundRect) {
    const groundMap = { green: 'url(#groundGreen)', neutral: 'url(#groundNeutral)', polluted: 'url(#groundPolluted)' };
    groundRect.setAttribute('fill', groundMap[state]);
  }

  // Mountains colour
  const mtnColor = { green: '#1a4731', neutral: '#44403c', polluted: '#292524' };
  ['mtn1','mtn2','mtn3','mtn4'].forEach((id, i) => {
    const el = document.getElementById(id);
    if (el) el.setAttribute('fill', mtnColor[state]);
  });

  // Sun visibility
  const sun = document.getElementById('sunMoon');
  if (sun) sun.style.opacity = state === 'polluted' ? '0.25' : '1';

  // Clouds opacity
  const clouds = document.getElementById('clouds');
  if (clouds) clouds.style.opacity = state === 'green' ? '1' : state === 'neutral' ? '0.5' : '0.15';

  // Smoke plumes
  const smoke = document.getElementById('smokePlumes');
  if (smoke) smoke.style.opacity = state === 'polluted' ? '1' : '0';

  // Trees
  const green  = document.getElementById('treesGreen');
  const neutral= document.getElementById('treesNeutral');
  const dead   = document.getElementById('treesDead');
  if (green)   green.style.opacity   = state === 'green' ? '1' : '0';
  if (neutral) neutral.style.opacity = state === 'neutral' ? '1' : '0';
  if (dead)    dead.style.opacity    = state === 'polluted' ? '1' : '0';

  // Extras
  const ge = document.getElementById('greenExtras');
  const ne = document.getElementById('neutralExtras');
  const pe = document.getElementById('pollutedExtras');
  if (ge) ge.style.opacity = state === 'green' ? '1' : '0';
  if (ne) ne.style.opacity = state === 'neutral' ? '1' : '0';
  if (pe) pe.style.opacity = state === 'polluted' ? '1' : '0';

  // Birds
  const birds = document.getElementById('birds');
  if (birds) birds.style.opacity = state === 'green' ? '1' : '0';

  // Avatar
  const avatar = document.getElementById('twinAvatarSvg');
  if (avatar) {
    const avatarMap = { green: '🧑‍🌾', neutral: '😐', polluted: '😰' };
    avatar.textContent = avatarMap[state];
  }

  // Aura
  const aura = document.getElementById('avatarAura');
  if (aura) {
    const auraColor = { green: '#22c55e', neutral: '#94a3b8', polluted: '#ef4444' };
    aura.setAttribute('stroke', auraColor[state]);
    aura.style.opacity = state === 'polluted' ? '0.3' : '0.6';
  }
}

/**
 * Preview a state when user clicks a tab (demo mode).
 */
function previewTwinState(state) {
  applyTwinSvgState(state);
}

function refreshTwin() {
  const data = loadData();
  const weekLogs = getLogsInRange(data.logs, 7);

  // Update streak display
  setText('twinStreakCount', data.streak || 0);

  if (weekLogs.length === 0) {
    applyTwinSvgState('green'); // default
    updateTwinStatus('—', '—', '—', data.logs.length);
    return;
  }

  const avgEmissions = sumTotal(weekLogs) / weekLogs.length;
  const score = calcEcoScore(avgEmissions);
  const level = getEcoLevel(score);
  const svgState = scoreToSvgState(score);

  // Apply animated state
  applyTwinSvgState(svgState);

  // Score label in SVG
  const scoreLabel = document.getElementById('twinScoreNum');
  if (scoreLabel) {
    const scoreColor = { green: '#22c55e', neutral: '#f59e0b', polluted: '#ef4444' };
    scoreLabel.textContent = `${score} / 100`;
    scoreLabel.setAttribute('fill', scoreColor[svgState] || 'white');
  }

  // Score bar
  const tsbFill = document.getElementById('tsbFill');
  if (tsbFill) {
    tsbFill.style.width = `${score}%`;
    tsbFill.setAttribute('aria-valuenow', score);
  }

  // Status panel
  const treesEquiv = Math.round(avgEmissions * 0.1);
  updateTwinStatus(score, getLevelLabel(level), treesEquiv, data.logs.length);

  // Future prediction dual cards
  renderFuturePrediction(score, level, avgEmissions);

  // Twin says
  renderTwinSays(score, level, avgEmissions);
}

function updateTwinStatus(score, level, trees, days) {
  setText('twinEcoScore',       score !== '—' ? `${score}/100` : '—');
  setText('twinEmissionLevel',  level);
  setText('twinTrees',          trees !== '—' ? `~${trees} trees/day` : '—');
  setText('twinDays',           days);
}

function renderFuturePrediction(score, level, avgEmissions) {
  const container = document.getElementById('futurePrediction');
  const greenScore = document.getElementById('futureGreenScore');
  const redScore   = document.getElementById('futureRedScore');
  const greenBar   = document.getElementById('futureGreenBar');
  const redBar     = document.getElementById('futureRedBar');
  const greenList  = document.getElementById('futureGreenList');
  const redList    = document.getElementById('futureRedList');

  const yearlyEmissions = Math.round(avgEmissions * 365);
  const sustainableScore = Math.min(99, Math.round(score * 1.25));
  const highEmissScore   = Math.max(5, Math.round(score * 0.55));

  if (greenScore) greenScore.innerHTML = `Eco Score: <strong>${sustainableScore}</strong>`;
  if (redScore)   redScore.innerHTML   = `Eco Score: <strong>${highEmissScore}</strong>`;
  if (greenBar)   greenBar.style.width = `${sustainableScore}%`;
  if (redBar)     redBar.style.width   = `${highEmissScore}%`;

  const saved = Math.round(yearlyEmissions * 0.4);
  const excess = Math.round(yearlyEmissions * 1.6);

  if (greenList) greenList.innerHTML = `
    <li class="future-item good">✔ Approx. ${saved} kg CO₂ saved per year</li>
    <li class="future-item good">✔ Cleaner air &amp; more greenery</li>
    <li class="future-item good">✔ Within 1.5°C personal budget</li>
    <li class="future-item good">✔ Positive community impact</li>
  `;

  if (redList) redList.innerHTML = `
    <li class="future-item bad">✖ ${excess} kg CO₂ emitted annually</li>
    <li class="future-item bad">✖ Increased regional air pollution</li>
    <li class="future-item bad">✖ Reduced local biodiversity</li>
    <li class="future-item bad">✖ ${Math.round((yearlyEmissions / 2000 * 100))}% of sustainable personal budget</li>
  `;

  if (container) {
    if (score >= 60) {
      container.innerHTML = `<div class="future-item good">🌿 You're on a great trajectory. Maintaining current habits prevents ~${saved} kg CO₂/year from entering the atmosphere by 2035.</div>`;
    } else if (score >= 40) {
      container.innerHTML = `<div class="future-item good">📈 A few habit shifts could dramatically improve your 2035 future. Your current track puts you at ${yearlyEmissions} kg/year.</div>`;
    } else {
      container.innerHTML = `<div class="future-item bad">💚 The good news: switching transport and diet alone could cut your footprint by 40–60% and unlock the green path by 2035.</div>`;
    }
  }
}

function renderTwinSays(score, level, avgEmissions) {
  const container = document.getElementById('twinSays');
  if (!container) return;

  const messages = {
    excellent: "I'm thriving! 🌿 Keep doing what you're doing — your choices are building the clean future we both want.",
    good:      "Things are looking pretty good! 😊 One more habit change — maybe public transit or meatless Mondays — and I'll really flourish.",
    moderate:  "I'm okay, but I'm struggling a bit. 😐 Your energy usage is the biggest factor right now. Even 1 less hour of AC daily helps.",
    poor:      "I'm not doing well. 😰 Your transport choices are the top contributor. Cycling or bussing just 2 days a week would make a huge difference.",
    critical:  "I'm really suffering. 😵 Please — any change helps. Start with food: one vegetarian day saves as much as skipping a 50 km car trip."
  };

  container.innerHTML = `<p class="twin-message">${messages[level] || messages.moderate}</p>`;
}

/* ============================================================
   11. SIMULATOR
   ============================================================ */

function updateSimulator() {
  // Update range display values
  const simDays = document.getElementById('simDays');
  const simAC   = document.getElementById('simAC');
  if (simDays) setText('simDaysVal', `${simDays.value} day${simDays.value == 1 ? '' : 's'}`);
  if (simAC)   setText('simACVal',   `${simAC.value} hr${simAC.value == 1 ? '' : 's'}`);

  // Baseline: average person
  const baseline = { transport: 'car', km: 15, food: 'mixed', electricity: 8, ac: 4, shopping: 'light' };
  const baseEmissions = calculateEmissions(baseline);
  const baseDailyTotal = baseEmissions.total;

  // New scenario
  const transport  = document.getElementById('simTransport')?.value || 'bicycle';
  const food       = document.getElementById('simFood')?.value || 'vegetarian';
  const daysPerWk  = parseInt(simDays?.value || 3);
  const acReduction= parseFloat(simAC?.value || 2);

  // Calculate savings
  // Transport: compare baseline car 15km vs new transport same distance, X days/week
  const baseTransportDaily   = TRANSPORT_FACTORS.car * 15;
  const newTransportDaily    = (TRANSPORT_FACTORS[transport] || 0) * 15;
  const transportSavingDay   = (baseTransportDaily - newTransportDaily) * (daysPerWk / 7);

  // Food saving per day
  const baseFoodDaily = FOOD_FACTORS.mixed;
  const newFoodDaily  = FOOD_FACTORS[food] || baseFoodDaily;
  const foodSavingDay = baseFoodDaily - newFoodDaily;

  // AC saving per day
  const acSavingDay = acReduction * AC_FACTOR;

  // Total daily saving
  const totalDailySaving = transportSavingDay + foodSavingDay + acSavingDay;
  const totalYearlySaving = Math.round(totalDailySaving * 365);

  // Display results
  setText('simSavings', totalYearlySaving > 0 ? totalYearlySaving : '0');

  // Breakdown
  const breakdown = document.getElementById('simBreakdown');
  if (breakdown) {
    const maxSaving = Math.max(transportSavingDay, foodSavingDay, acSavingDay, 0.1);
    breakdown.innerHTML = [
      { label: '🚗 Transport', val: Math.round(transportSavingDay * 365) },
      { label: '🍽️ Food',      val: Math.round(foodSavingDay * 365) },
      { label: '❄️ AC/Energy', val: Math.round(acSavingDay * 365) }
    ].map(item => {
      const pct = Math.max(0, Math.round((Math.max(item.val, 0) / Math.max(totalYearlySaving, 1)) * 100));
      return `
        <div class="sim-row">
          <span>${item.label}</span>
          <div class="sim-row-bar"><div class="sim-row-fill" style="width:${pct}%"></div></div>
          <span>${item.val > 0 ? '+' : ''}${item.val} kg</span>
        </div>
      `;
    }).join('');
  }

  // Equivalents
  setText('eq-trees',   Math.max(0, Math.round(totalYearlySaving / 22)));      // 1 tree absorbs ~22 kg CO₂/year
  setText('eq-flights', Math.max(0, Math.round(totalYearlySaving / 255)));     // ~255 kg per short flight
  setText('eq-home',    Math.max(0, Math.round(totalYearlySaving / 9.5)));     // ~9.5 kg CO₂/day home average
}

/* ============================================================
   12. QUESTS
   ============================================================ */

function refreshQuests() {
  const data = loadData();
  generateQuestsIfNeeded(data);
  renderQuestsList(data);
  renderAchievements(data);
  setText('totalQuestsCompleted', data.questsCompleted || 0);
  setText('streakCountQuest', data.streak || 0);
}

function generateQuestsIfNeeded(data) {
  const today = todayString();
  if (data.questDate !== today || !data.quests || data.quests.length === 0) {
    generateQuests(data);
  }
}

function generateQuests(passedData) {
  const data = passedData || loadData();
  const today = todayString();

  // Pick 5 random quests from pool
  const shuffled = [...QUEST_POOL].sort(() => Math.random() - 0.5).slice(0, 5);
  data.quests = shuffled.map(q => ({ ...q, completed: false }));
  data.questDate = today;

  saveData(data);
  renderQuestsList(data);

  // Count display
  updateQuestCounts(data);
}

function toggleQuest(questId) {
  const data = loadData();
  const quest = data.quests.find(q => q.id === questId);
  if (!quest) return;

  quest.completed = !quest.completed;
  if (quest.completed) {
    data.questsCompleted = (data.questsCompleted || 0) + 1;
    showNotification(`⚡ Quest complete! +${quest.xp} XP — "${quest.title}"`);
    const newBadges = checkBadges(data);
    newBadges.forEach(b => setTimeout(() => showNotification(`🏆 Badge Unlocked: ${b.name}!`, 4000), 1200));
  }

  saveData(data);
  renderQuestsList(data);
  updateQuestCounts(data);
}

function renderQuestsList(data) {
  const container = document.getElementById('questsList');
  if (!container) return;

  if (!data.quests || data.quests.length === 0) {
    container.innerHTML = '<p class="empty-state">No quests generated yet. Click Refresh!</p>';
    return;
  }

  container.innerHTML = data.quests.map(q => `
    <div class="quest-item ${q.completed ? 'completed' : ''}" role="listitem">
      <button 
        class="quest-checkbox ${q.completed ? 'done' : ''}" 
        onclick="toggleQuest('${q.id}')"
        aria-label="${q.completed ? 'Mark as incomplete' : 'Mark as complete'}: ${q.title}"
        aria-pressed="${q.completed}">
        ${q.completed ? '✓' : ''}
      </button>
      <div class="quest-body">
        <div class="quest-title">${q.icon} ${q.title}</div>
        <div class="quest-desc">${q.desc}</div>
      </div>
      <div class="quest-xp" aria-label="${q.xp} XP reward">+${q.xp} XP</div>
    </div>
  `).join('');
}

function updateQuestCounts(data) {
  const completed = data.quests ? data.quests.filter(q => q.completed).length : 0;
  const total = data.quests ? data.quests.length : 0;
  setText('questCompletedCount', completed);
  setText('questTotalCount', total);
}

function renderAchievements(data) {
  const container = document.getElementById('achievementsList');
  if (!container) return;

  container.innerHTML = BADGES.map(b => {
    const unlocked = data.unlockedBadges.includes(b.id) || b.condition(data);
    return `
      <div class="achieve-item ${unlocked ? 'unlocked' : 'locked'}" role="listitem" aria-label="${b.name}: ${unlocked ? 'Unlocked' : 'Locked - ' + b.req}">
        <div class="achieve-icon">${b.icon}</div>
        <div>
          <div class="achieve-name">${b.name}</div>
          <div class="achieve-req">${unlocked ? '✓ Unlocked' : b.req}</div>
        </div>
      </div>
    `;
  }).join('');
}

/* ============================================================
   13. STATISTICS & CHARTS
   ============================================================ */

let dailyChartInst   = null;
let categoryChartInst = null;
let weeklyChartInst  = null;

function refreshStats() {
  const data = loadData();

  renderStatInsights(data);
  renderDailyChart(data);
  renderCategoryChart(data);
  renderWeeklyChart(data);
}

function renderStatInsights(data) {
  if (data.logs.length === 0) return;

  const totals = data.logs.map(l => l.total);
  const best   = Math.min(...totals);
  const worst  = Math.max(...totals);
  const avg    = totals.reduce((a, b) => a + b, 0) / totals.length;
  const savedVsAvg = Math.round((AVG_DAILY_EMISSIONS - avg) * data.logs.length);

  setText('bestDay',    `${best.toFixed(1)} kg`);
  setText('worstDay',   `${worst.toFixed(1)} kg`);
  setText('avgDay',     `${avg.toFixed(1)} kg`);
  setText('totalSaved', `${savedVsAvg >= 0 ? '+' : ''}${savedVsAvg} kg`);
}

function renderDailyChart(data) {
  const canvas = document.getElementById('dailyChart');
  if (!canvas) return;

  // Last 7 days
  const labels = [];
  const values = [];
  for (let i = 6; i >= 0; i--) {
    const d = dateString(-i);
    const log = data.logs.find(l => l.date === d);
    labels.push(formatDateShort(d));
    values.push(log ? log.total : 0);
  }

  if (dailyChartInst) dailyChartInst.destroy();

  const isDark = document.body.getAttribute('data-theme') !== 'light';
  dailyChartInst = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'kg CO₂',
        data: values,
        backgroundColor: values.map(v => v <= 6 ? 'rgba(34,197,94,0.7)' : v <= 10 ? 'rgba(245,158,11,0.7)' : 'rgba(239,68,68,0.7)'),
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: getChartOptions(isDark, 'Daily CO₂ Emissions (kg)')
  });
}

function renderCategoryChart(data) {
  const canvas = document.getElementById('categoryChart');
  if (!canvas) return;

  const recent = getLogsInRange(data.logs, 30);

  if (recent.length === 0) {
    // Placeholder data
    const placeholder = [4, 3, 3, 2];
    renderDoughnut(canvas, ['Transport', 'Food', 'Energy', 'Shopping'], placeholder);
    return;
  }

  const transport = sumBy(recent, 'transport');
  const food      = sumBy(recent, 'food');
  const energy    = sumBy(recent, 'energy');
  const shopping  = sumBy(recent, 'shopping');

  if (categoryChartInst) categoryChartInst.destroy();
  categoryChartInst = renderDoughnut(canvas, ['Transport', 'Food', 'Energy', 'Shopping'], [transport, food, energy, shopping]);
}

function renderDoughnut(canvas, labels, values) {
  const isDark = document.body.getAttribute('data-theme') !== 'light';
  return new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: ['rgba(34,197,94,0.8)', 'rgba(56,189,248,0.8)', 'rgba(245,158,11,0.8)', 'rgba(167,139,250,0.8)'],
        borderColor: 'transparent',
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: isDark ? '#9dc4a4' : '#2d5c38', padding: 12, font: { size: 11 } }
        }
      }
    }
  });
}

function renderWeeklyChart(data) {
  const canvas = document.getElementById('weeklyChart');
  if (!canvas) return;

  // Get last 4 weeks
  const labels = [];
  const values = [];
  for (let w = 3; w >= 0; w--) {
    const start = w * 7;
    const weekLogs = data.logs.filter(l => {
      const daysAgo = daysBetween(l.date, todayString());
      return daysAgo >= start && daysAgo < start + 7;
    });
    labels.push(`Week ${4 - w}`);
    values.push(round2(weekLogs.reduce((a, l) => a + l.total, 0)));
  }

  if (weeklyChartInst) weeklyChartInst.destroy();

  const isDark = document.body.getAttribute('data-theme') !== 'light';
  weeklyChartInst = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Weekly CO₂ (kg)',
        data: values,
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34,197,94,0.1)',
        borderWidth: 2.5,
        pointBackgroundColor: '#22c55e',
        pointRadius: 5,
        fill: true,
        tension: 0.4
      }]
    },
    options: getChartOptions(isDark, 'Weekly CO₂ Total (kg)')
  });
}

function getChartOptions(isDark, title) {
  const gridColor   = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
  const labelColor  = isDark ? '#9dc4a4' : '#2d5c38';
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: isDark ? 'rgba(16,32,20,0.95)' : 'rgba(255,255,255,0.95)',
        titleColor: isDark ? '#e8f5ea' : '#0f2213',
        bodyColor: isDark ? '#9dc4a4' : '#2d5c38',
        borderColor: 'rgba(34,197,94,0.3)',
        borderWidth: 1
      }
    },
    scales: {
      x: {
        grid: { color: gridColor },
        ticks: { color: labelColor, font: { size: 11 } }
      },
      y: {
        grid: { color: gridColor },
        ticks: { color: labelColor, font: { size: 11 } },
        beginAtZero: true
      }
    }
  };
}

/* ============================================================
   14. SETTINGS
   ============================================================ */

function exportData() {
  const data = loadData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `carbon-twin-data-${todayString()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showNotification('📥 Data exported successfully!');
}

function resetData() {
  if (!confirm('Are you sure you want to reset all your Carbon Twin data? This cannot be undone.')) return;
  localStorage.removeItem('carbonTwinData');
  showNotification('🔄 All data has been reset.');
  refreshDashboard();
}

/* ============================================================
   15. QUOTE SYSTEM
   ============================================================ */

let quoteIndex = 0;

function rotateQuote(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const q = QUOTES[quoteIndex % QUOTES.length];
  el.textContent = q.text;
  const cite = el.nextElementSibling;
  if (cite && cite.tagName === 'CITE') cite.textContent = `— ${q.author}`;
  quoteIndex++;
}

function startQuoteTicker() {
  const el = document.getElementById('quoteTicker');
  if (!el) return;
  let i = 0;
  function cycleQuote() {
    el.style.opacity = '0';
    setTimeout(() => {
      const q = QUOTES[i % QUOTES.length];
      el.textContent = `"${q.text}" — ${q.author}`;
      el.style.opacity = '1';
      i++;
    }, 500);
  }
  cycleQuote();
  setInterval(cycleQuote, 6000);
}

/* ============================================================
   16. HERO NUMBER ANIMATION
   ============================================================ */

function animateCounters() {
  document.querySelectorAll('[data-count]').forEach(el => {
    const target = parseInt(el.getAttribute('data-count'));
    let current  = 0;
    const step   = Math.ceil(target / 60);
    const interval = setInterval(() => {
      current = Math.min(current + step, target);
      el.textContent = current.toLocaleString();
      if (current >= target) clearInterval(interval);
    }, 16);
  });
}

/* ============================================================
   17. LIVE PREVIEW EVENT LISTENERS
   ============================================================ */

function attachLoggerListeners() {
  // Radio cards — update preview on change
  document.querySelectorAll('input[type="radio"]').forEach(radio => {
    radio.addEventListener('change', updateLivePreview);
  });

  // Number inputs
  ['transportKm', 'electricityHours', 'acHours'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateLivePreview);
  });

  // Keyboard activation for radio cards
  document.querySelectorAll('.radio-card').forEach(card => {
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const radio = card.querySelector('input[type="radio"]');
        if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change', { bubbles: true })); }
      }
    });
  });
}

/* ============================================================
   18. UTILITY FUNCTIONS
   ============================================================ */

/** Round to 2 decimal places */
function round2(n) {
  return Math.round(n * 100) / 100;
}

/** Set text content of an element by ID */
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/** Today as YYYY-MM-DD */
function todayString() {
  return new Date().toISOString().split('T')[0];
}

/** Date N days from today as YYYY-MM-DD (negative = past) */
function dateString(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
}

/** Format date string to readable form */
function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Format date to short weekday */
function formatDateShort(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((today - d) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

/** Get logs within last N days */
function getLogsInRange(logs, days) {
  const cutoff = dateString(-days);
  return logs.filter(l => l.date >= cutoff);
}

/** Sum total emissions from log array */
function sumTotal(logs) {
  return round2(logs.reduce((a, l) => a + l.total, 0));
}

/** Sum a specific property from log array */
function sumBy(logs, key) {
  return round2(logs.reduce((a, l) => a + (parseFloat(l[key]) || 0), 0));
}

/** Get most frequently occurring value in array */
function getMostFrequent(arr) {
  const freq = {};
  arr.forEach(v => freq[v] = (freq[v] || 0) + 1);
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0];
}

/** Count days between two YYYY-MM-DD strings */
function daysBetween(dateA, dateB) {
  const a = new Date(dateA + 'T00:00:00');
  const b = new Date(dateB + 'T00:00:00');
  return Math.abs(Math.round((b - a) / 86400000));
}

/** Check if user has logged vegan for N consecutive days */
function hasConsecutiveVegan(data, n) {
  const sorted = [...data.logs].sort((a, b) => b.date.localeCompare(a.date));
  let streak = 0;
  for (const log of sorted) {
    if (log.food === 'vegan') {
      streak++;
      if (streak >= n) return true;
    } else {
      streak = 0;
    }
  }
  return false;
}

/* ============================================================
   19. INITIALIZATION
   ============================================================ */

function init() {
  const data = loadData();

  // Apply saved theme
  document.body.setAttribute('data-theme', data.theme || 'dark');
  document.getElementById('themeToggle').querySelector('.theme-icon').textContent =
    data.theme === 'light' ? '☀️' : '🌙';

  // Apply large text
  if (data.largeText) {
    document.body.setAttribute('data-large-text', 'true');
    const lt = document.getElementById('largeTextToggle');
    if (lt) lt.checked = true;
  }

  // Sync settings toggles
  const darkToggle = document.getElementById('darkModeToggle');
  if (darkToggle) darkToggle.checked = (data.theme !== 'light');

  // Start landing page
  showPage('landing');
  attachLoggerListeners();
  updateLivePreview();
  startQuoteTicker();

  // Animate hero counters after short delay
  setTimeout(animateCounters, 400);

  // Initialize simulator
  updateSimulator();

  // Generate quests
  generateQuestsIfNeeded(data);
}

// Run init on DOM ready
document.addEventListener('DOMContentLoaded', init);