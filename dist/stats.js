const format = number => new Intl.NumberFormat('en-ZA').format(number);
const labels = { taima: "Taima's Original Pepper", malome: "Malome's Chillie Bites", oulady: "OuLady's Droëwors" };
document.querySelector('#year').textContent = new Date().getFullYear();

function rows(element, entries) {
  element.replaceChildren();
  for (const [name, count] of entries) {
    if (!count) continue;
    const row = document.createElement('div');
    const title = document.createElement('span');
    const value = document.createElement('strong');
    title.textContent = name;
    value.textContent = format(count);
    row.append(title, value);
    element.append(row);
  }
  if (!element.childElementCount) element.textContent = 'No activity yet.';
}

function dailyBars(days) {
  const container = document.querySelector('#daily');
  container.replaceChildren();
  const highest = Math.max(1, ...days.map(day => day.views));
  for (const day of days) {
    const bar = document.createElement('div');
    bar.className = 'bar';
    const value = document.createElement('strong');
    value.textContent = format(day.views);
    const visual = document.createElement('span');
    visual.className = 'bar-fill';
    visual.style.height = `${Math.max(3, (day.views / highest) * 100)}%`;
    const date = document.createElement('small');
    date.textContent = new Date(`${day.date}T12:00:00+02:00`).toLocaleDateString('en-ZA', { weekday: 'short', timeZone: 'Africa/Johannesburg' });
    bar.append(value, visual, date);
    container.append(bar);
  }
}

let loading = false;
async function refresh() {
  if (loading) return;
  loading = true;
  try {
    const response = await fetch('/.netlify/functions/analytics', { cache: 'no-store' });
    if (!response.ok) throw new Error(`Status ${response.status}`);
    const data = await response.json();
    document.querySelector('#live').textContent = format(data.live);
    document.querySelector('#views-today').textContent = format(data.today.views);
    document.querySelector('#visitors-today').textContent = format(data.today.visitors);
    document.querySelector('#views-month').textContent = format(data.last30Days.views);
    document.querySelector('#visitors-month').textContent = format(data.last30Days.visitors);
    dailyBars(data.daily);
    rows(document.querySelector('#sources'), Object.entries(data.sources).sort((a, b) => b[1] - a[1]));
    rows(document.querySelector('#flavours'), Object.entries(data.flavours).sort((a, b) => b[1] - a[1]).map(([id, count]) => [labels[id], count]));
    window.KasiGlobe?.update(data.geography);
    document.querySelector('#status').textContent = `Updated ${new Date(data.updatedAt).toLocaleTimeString('en-ZA', { timeZone: 'Africa/Johannesburg', hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
  } catch {
    document.querySelector('#status').textContent = 'Can’t load stats right now. Retrying…';
  } finally {
    loading = false;
  }
}

refresh();
setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 15_000);
