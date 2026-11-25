(() => {
  const canvas = document.querySelector('#globe');
  const context = canvas.getContext('2d');
  const tooltip = document.querySelector('#globe-tooltip');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rad = Math.PI / 180;
  const home = { lat: -28.87, lon: 27.87 };
  let data = null;
  let geography = { live: {}, last30Days: {} };
  let lon = 22;
  let lat = -11;
  let width = 0;
  let height = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let resumeAt = 0;
  let previousFrame = 0;
  let markers = [];

  function resize() {
    const box = canvas.getBoundingClientRect();
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    width = box.width;
    height = box.height;
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    context.setTransform(scale, 0, 0, scale, 0, 0);
  }

  function project(point, centerX, centerY, radius) {
    const phi = point.lat * rad;
    const lambda = (point.lon - lon) * rad;
    const phi0 = lat * rad;
    const cosPhi = Math.cos(phi);
    const depth = Math.sin(phi) * Math.sin(phi0) + cosPhi * Math.cos(phi0) * Math.cos(lambda);
    return {
      x: centerX + radius * cosPhi * Math.sin(lambda),
      y: centerY - radius * (Math.sin(phi) * Math.cos(phi0) - cosPhi * Math.sin(phi0) * Math.cos(lambda)),
      depth,
    };
  }

  function gridLine(points, centerX, centerY, radius) {
    context.beginPath();
    let drawing = false;
    for (const point of points) {
      const projected = project(point, centerX, centerY, radius);
      if (projected.depth <= 0.02) {
        drawing = false;
      } else if (drawing) {
        context.lineTo(projected.x, projected.y);
      } else {
        context.moveTo(projected.x, projected.y);
        drawing = true;
      }
    }
    context.stroke();
  }

  function arc(destination, centerX, centerY, radius, time) {
    const toVector = point => {
      const p = point.lat * rad;
      const l = point.lon * rad;
      return [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)];
    };
    const start = toVector(home);
    const end = toVector(destination);
    const angle = Math.acos(Math.max(-1, Math.min(1, start[0] * end[0] + start[1] * end[1] + start[2] * end[2])));
    const denominator = Math.sin(angle);
    if (denominator < .001) return;

    context.beginPath();
    let drawing = false;
    for (let step = 0; step <= 44; step++) {
      const t = step / 44;
      const a = Math.sin((1 - t) * angle) / denominator;
      const b = Math.sin(t * angle) / denominator;
      const x = a * start[0] + b * end[0];
      const y = a * start[1] + b * end[1];
      const z = a * start[2] + b * end[2];
      const projected = project({ lat: Math.atan2(z, Math.hypot(x, y)) / rad, lon: Math.atan2(y, x) / rad }, centerX, centerY, radius);
      if (projected.depth <= .02) drawing = false;
      else if (drawing) context.lineTo(projected.x, projected.y);
      else { context.moveTo(projected.x, projected.y); drawing = true; }
    }
    context.strokeStyle = '#df484b88';
    context.lineWidth = 1.4;
    context.setLineDash([3, 5]);
    context.lineDashOffset = reducedMotion ? 0 : -time / 35;
    context.stroke();
    context.setLineDash([]);
  }

  function marker(place, count, live, centerX, centerY, radius, time) {
    const point = project(place, centerX, centerY, radius);
    if (point.depth <= .04) return;
    const size = live ? 4.5 : 2.5;
    const pulse = live && !reducedMotion ? (Math.sin(time / 380) + 1) * 2 : 1.5;
    context.beginPath();
    context.arc(point.x, point.y, size + pulse + 4, 0, Math.PI * 2);
    context.fillStyle = live ? '#e8404330' : '#efdad01a';
    context.fill();
    context.beginPath();
    context.arc(point.x, point.y, size, 0, Math.PI * 2);
    context.fillStyle = live ? '#ef5359' : '#e6bfc0';
    context.fill();
    if (live) markers.push({ x: point.x, y: point.y, label: place.name, count });
  }

  function draw(time) {
    if (!document.hidden) {
      const elapsed = Math.min(50, time - (previousFrame || time));
      if (!reducedMotion && !dragging && time > resumeAt) lon = (lon + elapsed * .0008 + 180) % 360 - 180;
      context.clearRect(0, 0, width, height);
      const radius = Math.min(width * .39, height * .42, 240);
      const centerX = width * .5;
      const centerY = height * .5;

      const glow = context.createRadialGradient(centerX, centerY, radius * .72, centerX, centerY, radius * 1.25);
      glow.addColorStop(0, '#ad242000');
      glow.addColorStop(.72, '#b52b2714');
      glow.addColorStop(1, '#ad242000');
      context.fillStyle = glow;
      context.beginPath();
      context.arc(centerX, centerY, radius * 1.25, 0, Math.PI * 2);
      context.fill();

      const sphere = context.createRadialGradient(centerX - radius * .35, centerY - radius * .32, 0, centerX, centerY, radius);
      sphere.addColorStop(0, '#292424');
      sphere.addColorStop(.75, '#1b1a1a');
      sphere.addColorStop(1, '#0e0e0e');
      context.fillStyle = sphere;
      context.beginPath();
      context.arc(centerX, centerY, radius, 0, Math.PI * 2);
      context.fill();

      context.strokeStyle = '#ffffff12';
      context.lineWidth = 1;
      for (let gridLat = -60; gridLat <= 60; gridLat += 30) {
        gridLine(Array.from({ length: 91 }, (_, index) => ({ lat: gridLat, lon: -180 + index * 4 })), centerX, centerY, radius);
      }
      for (let gridLon = -180; gridLon < 180; gridLon += 30) {
        gridLine(Array.from({ length: 46 }, (_, index) => ({ lat: -90 + index * 4, lon: gridLon })), centerX, centerY, radius);
      }

      if (data) {
        for (const [dotLat, dotLon] of data.dots) {
          const point = project({ lat: dotLat, lon: dotLon }, centerX, centerY, radius);
          if (point.depth <= .04) continue;
          context.fillStyle = `rgba(227,214,210,${(.16 + point.depth * .49).toFixed(2)})`;
          const size = .9 + point.depth * .65;
          context.fillRect(point.x, point.y, size, size);
        }

        for (const [code, count] of Object.entries(geography.live)) {
          if (count && data.places[code] && code !== 'ZA') arc(data.places[code], centerX, centerY, radius, time);
        }

        markers = [];
        for (const [code, count] of Object.entries(geography.last30Days)) {
          if (count && !geography.live[code] && data.places[code]) marker(data.places[code], count, false, centerX, centerY, radius, time);
        }
        for (const [code, count] of Object.entries(geography.live)) {
          if (count && data.places[code]) marker(data.places[code], count, true, centerX, centerY, radius, time);
        }
      }

      const origin = project(home, centerX, centerY, radius);
      if (origin.depth > .04) {
        context.fillStyle = '#fff';
        context.fillRect(origin.x - 2, origin.y - 2, 4, 4);
      }
      context.strokeStyle = '#ffffff30';
      context.lineWidth = 1;
      context.beginPath();
      context.arc(centerX, centerY, radius - .5, 0, Math.PI * 2);
      context.stroke();
    }
    previousFrame = time;
    requestAnimationFrame(draw);
  }

  function countryRows(target, counts, empty) {
    target.replaceChildren();
    const entries = Object.entries(counts).filter(([, count]) => count).sort((a, b) => b[1] - a[1]);
    if (!entries.length) { target.textContent = empty; return; }
    for (const [code, count] of entries.slice(0, 8)) {
      const row = document.createElement('div');
      row.className = target.id === 'live-locations' ? 'country-row live' : 'country-row';
      const name = document.createElement('span');
      const value = document.createElement('strong');
      name.textContent = data?.places[code]?.name || 'Location unavailable';
      value.textContent = new Intl.NumberFormat('en-ZA').format(count);
      row.append(name, value);
      target.append(row);
    }
  }

  function update(next) {
    geography = { live: next?.live || {}, last30Days: next?.last30Days || {} };
    countryRows(document.querySelector('#live-locations'), geography.live, 'Waiting for live visitors.');
    countryRows(document.querySelector('#month-locations'), geography.last30Days, 'No location data yet.');
    const locations = Object.entries(geography.live).filter(([code, count]) => count && data?.places[code]);
    canvas.setAttribute('aria-label', locations.length ? `Globe showing ${locations.map(([code, count]) => `${count} in ${data.places[code].name}`).join(', ')}` : 'Globe with no known live visitor locations');
  }

  canvas.addEventListener('pointerdown', event => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
    tooltip.hidden = true;
  });
  canvas.addEventListener('pointermove', event => {
    if (dragging) {
      lon = (lon - (event.clientX - lastX) * .35 + 540) % 360 - 180;
      lat = Math.max(-65, Math.min(65, lat + (event.clientY - lastY) * .25));
      lastX = event.clientX;
      lastY = event.clientY;
      return;
    }
    const box = canvas.getBoundingClientRect();
    const x = event.clientX - box.left;
    const y = event.clientY - box.top;
    const found = markers.find(point => Math.hypot(x - point.x, y - point.y) < 13);
    tooltip.hidden = !found;
    if (found) {
      tooltip.textContent = `${found.label} · ${found.count} live`;
      tooltip.style.left = `${Math.min(x + 13, width - 170)}px`;
      tooltip.style.top = `${Math.max(8, y - 36)}px`;
    }
  });
  canvas.addEventListener('pointerup', () => { dragging = false; resumeAt = performance.now() + 6000; });
  canvas.addEventListener('pointercancel', () => { dragging = false; });
  canvas.addEventListener('pointerleave', () => { tooltip.hidden = true; });

  window.KasiGlobe = { update };
  new ResizeObserver(resize).observe(canvas);
  resize();
  requestAnimationFrame(draw);
  fetch('/globe-data.json').then(response => {
    if (!response.ok) throw new Error('Map unavailable');
    return response.json();
  }).then(result => { data = result; update(geography); }).catch(() => {
    document.querySelector('#live-locations').textContent = 'Map unavailable right now.';
  });
})();
