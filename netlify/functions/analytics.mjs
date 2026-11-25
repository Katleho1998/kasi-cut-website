import { getStore } from '@netlify/blobs';

const DAY = 86_400_000;
const LIVE_WINDOW = 120_000;
const SOURCES = new Set(['Direct', 'Instagram', 'Facebook', 'WhatsApp', 'Search', 'Other']);
const PRODUCTS = new Set(['taima', 'malome', 'oulady']);
const jsonHeaders = { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8' };

function localDate(timestamp) {
  return new Date(timestamp + 2 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function store() {
  return getStore({ name: 'kasi-cut-analytics', consistency: 'strong' });
}

async function record(request, analytics) {
  const origin = request.headers.get('origin');
  if (origin !== new URL(request.url).origin) return new Response(null, { status: 403 });

  let event;
  try {
    const raw = await request.text();
    if (raw.length > 512) return new Response(null, { status: 413 });
    event = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 400 });
  }

  if (!event || !/^[a-f0-9-]{36}$/i.test(event.id)) {
    return new Response(null, { status: 400 });
  }

  const now = Date.now();
  const date = localDate(now);
  const live = () => analytics.setJSON(`live/${date}/${event.id}`, { seen: now });

  if (event.type === 'heartbeat') {
    await live();
  } else if (event.type === 'view') {
    const source = SOURCES.has(event.source) ? event.source : 'Other';
    await Promise.all([
      analytics.set(`views/${date}/${now}-${crypto.randomUUID()}-${source}`, ''),
      analytics.set(`visitors/${date}/${event.id}`, '', { onlyIfNew: true }),
      live(),
    ]);
  } else if (event.type === 'flavour' && PRODUCTS.has(event.product)) {
    await analytics.set(`flavours/${date}/${crypto.randomUUID()}-${event.product}`, '');
  } else {
    return new Response(null, { status: 400 });
  }

  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}

async function report(analytics) {
  const now = Date.now();
  const dates = Array.from({ length: 30 }, (_, index) => localDate(now - index * DAY));
  const allowedDates = new Set(dates);
  const months = [...new Set(dates.map(date => date.slice(0, 7)))];
  const groups = ['views', 'visitors', 'flavours'];

  const listings = await Promise.all(groups.flatMap(group => months.map(async month => {
    const { blobs } = await analytics.list({ prefix: `${group}/${month}` });
    return { group, blobs };
  })));

  const daily = Object.fromEntries(dates.map(date => [date, { views: 0, visitors: 0 }]));
  const sources = Object.fromEntries([...SOURCES].map(source => [source, 0]));
  const flavours = { taima: 0, malome: 0, oulady: 0 };

  for (const { group, blobs } of listings) {
    for (const { key } of blobs) {
      const [, date, detail] = key.split('/');
      if (!allowedDates.has(date)) continue;
      if (group === 'views') {
        daily[date].views++;
        const source = detail.split('-').at(-1);
        sources[source in sources ? source : 'Other']++;
      } else if (group === 'visitors') {
        daily[date].visitors++;
      } else {
        const product = detail.split('-').at(-1);
        if (product in flavours) flavours[product]++;
      }
    }
  }

  const recentDates = [localDate(now), localDate(now - DAY)];
  const recent = await Promise.all(recentDates.map(async date => {
    const { blobs } = await analytics.list({ prefix: `live/${date}/` });
    return blobs;
  }));
  const active = await Promise.all(recent.flat().map(({ key }) => analytics.get(key, { type: 'json' })));
  const live = active.filter(entry => entry && Number.isFinite(entry.seen) && entry.seen >= now - LIVE_WINDOW).length;

  return Response.json({
    live,
    today: daily[dates[0]],
    last30Days: {
      views: Object.values(daily).reduce((sum, day) => sum + day.views, 0),
      visitors: Object.values(daily).reduce((sum, day) => sum + day.visitors, 0),
    },
    daily: dates.slice(0, 7).reverse().map(date => ({ date, ...daily[date] })),
    sources,
    flavours,
    updatedAt: new Date(now).toISOString(),
  }, { headers: jsonHeaders });
}

export default async request => {
  try {
    const analytics = store();
    if (request.method === 'POST') return await record(request, analytics);
    if (request.method === 'GET') return await report(analytics);
    return new Response(null, { status: 405, headers: { Allow: 'GET, POST' } });
  } catch (error) {
    console.error('Analytics unavailable', error);
    return Response.json({ error: 'Analytics are temporarily unavailable.' }, { status: 503, headers: jsonHeaders });
  }
};
