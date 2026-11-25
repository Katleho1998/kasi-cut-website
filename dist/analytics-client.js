(() => {
  if (navigator.doNotTrack === '1' || navigator.globalPrivacyControl) return;

  const endpoint = '/.netlify/functions/analytics';
  let id;
  try {
    id = sessionStorage.getItem('kasi-cut-session');
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem('kasi-cut-session', id);
    }
  } catch {
    id = crypto.randomUUID();
  }

  function source() {
    const campaign = new URLSearchParams(location.search).get('utm_source')?.toLowerCase() || '';
    let referrer = '';
    try { referrer = new URL(document.referrer).hostname.toLowerCase(); } catch { /* No referrer. */ }
    if (['instagram', 'ig'].includes(campaign) || referrer.includes('instagram.com')) return 'Instagram';
    if (['facebook', 'fb'].includes(campaign) || /facebook\.com|fb\.com/.test(referrer)) return 'Facebook';
    if (['whatsapp', 'wa'].includes(campaign) || referrer.includes('whatsapp.com')) return 'WhatsApp';
    if (['google', 'bing', 'search'].includes(campaign) || /google\.|bing\.|duckduckgo\./.test(referrer)) return 'Search';
    return referrer && referrer !== location.hostname ? 'Other' : 'Direct';
  }

  function send(type, extra = {}) {
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, id, ...extra }),
      keepalive: true,
    }).catch(() => {});
  }

  send('view', { source: source() });
  setInterval(() => { if (document.visibilityState === 'visible') send('heartbeat'); }, 45_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') send('heartbeat');
  });
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-product]');
    if (button) send('flavour', { product: button.dataset.product });
  });
})();
