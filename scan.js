// Free on-device receipt scanner: reads the photo with Tesseract in the browser,
// then turns the text into store, date, items, tax and total.
window.Scan = (() => {
  const r2 = (x) => Math.round(x * 100) / 100;
  // ---------- free on-device receipt scanner (Tesseract) ----------
  let ocrWorker = null, ocrProgress = null;
  function loadTesseract() {
    if (window.Tesseract) return Promise.resolve();
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
      s.onload = res; s.onerror = () => rej({ code: 'ocr_load' });
      document.head.appendChild(s);
    });
  }
  async function getWorker() {
    if (ocrWorker) return ocrWorker;
    await loadTesseract();
    ocrWorker = await Tesseract.createWorker('eng', 1, {
      logger: (m) => { if (ocrProgress && m.status) ocrProgress(m.status, m.progress || 0); },
    });
    await ocrWorker.setParameters({ preserve_interword_spaces: '1' });
    return ocrWorker;
  }

  // grayscale + contrast stretch, long side ~2000px, so thermal print reads better
  async function prepImage(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
      const scale = Math.min(2, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const d = ctx.getImageData(0, 0, c.width, c.height), px = d.data;
      const hist = new Uint32Array(256);
      for (let i = 0; i < px.length; i += 4) { const g = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) | 0; px[i] = g; hist[g]++; }
      const total = px.length / 4; let lo = 0, hi = 255, acc = 0;
      for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > total * 0.02) { lo = v; break; } }
      acc = 0;
      for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc > total * 0.02) { hi = v; break; } }
      const span = Math.max(1, hi - lo);
      for (let i = 0; i < px.length; i += 4) { let g = ((px[i] - lo) * 255) / span; g = g < 0 ? 0 : g > 255 ? 255 : g; px[i] = px[i + 1] = px[i + 2] = g; }
      ctx.putImageData(d, 0, 0);
      return c;
    } finally { URL.revokeObjectURL(url); }
  }

  const STORES = ['Harris Teeter', 'Lotte', 'Sprouts', 'Food Lion', 'Giant', 'Safeway', 'Whole Foods', "Trader Joe's", 'Costco', 'Walmart', 'Target', 'Aldi', 'Wegmans', "MOM's Organic Market", 'H Mart', 'Patel Brothers', 'CVS', 'Walgreens', 'Kroger', 'Lidl', 'Publix', 'Shoppers', 'Home Depot', "Lowe's", 'Amazon', 'Dollar Tree', 'Sams Club', "BJ's"];
  const ABBR = { ORG: 'Organic', ORGANC: 'Organic', ORNG: 'Orange', SWT: 'Sweet', GRD: 'Grade', WHT: 'White', LG: 'Large', BNLS: 'Boneless', SKNLS: 'Skinless', CHKN: 'Chicken', CHK: 'Chicken', BRST: 'Breast', PRTN: 'Portion', NPR: '', VP: '', FL: '', BLK: 'Black', GRN: 'Green', RED: 'Red', YLW: 'Yellow', BNNA: 'Banana', BNNAS: 'Bananas', TOM: 'Tomato', POT: 'Potato', CRM: 'Cream', CHS: 'Cheese', MLK: 'Milk', WHL: 'Whole', VEG: 'Vegetable', FRZ: 'Frozen', PK: 'Pack', CT: 'Count', OZ: 'oz', LB: 'lb' };
  const MONTHS3 = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  // a price at the end of a line, with optional trailing tax flags (T1F, B, A *, TT…)
  const PRICE_END = /(-)?\s?(?:\$|\bS(?=\d))?\s?(\d{1,4}[.,]\d{2})\s?(-)?((?:\s+[A-Z0-9]{1,3}){0,2})\s*\*?\s*$/;
  const priceOf = (line) => {
    const m = line.match(PRICE_END);
    if (!m) return null;
    const v = Number(m[2].replace(',', '.'));
    return { value: (m[1] || m[3]) ? -v : v, name: line.slice(0, m.index).trim() };
  };
  const NOT_ITEM = /(sub\s*-?\s*total|\btotal|balance|change\b|visa|\bmaster\b|mastercard|\bamex\b|discover|\bcredit|debit|\bcash\b|tender|amount|approv|auth|card\s*#|\bref\b|\baid\b|\btc\b|rrn|invoice|item\s*count|items?\s*sold|number of items|points|saving|you saved|net sales|markdown|code\s*:|survey|thank you|sequence|terminal|result|purchase|entry method|\bmode\b|\btvr\b|\biad\b|\btsi\b|\bmid\b|\btid\b|\bpin\b|discounts?\s*$|customer|manager|store\s*#|phone|www\.|\.com)/i;
  const DISCOUNT = /(coupon|discount|savings|instant|\bsc\b|\bpc\b|price you pay|you saved|\boff\b)/i;

  function cleanName(raw) {
    let s = raw
      .replace(/\b\d+(\.\d+)?\s*\(?\d*\.?\d*\)?\s*lb\s*@\s*[$S]?\d+[.,]\d{2}\s*\/?\s*lb\b/ig, ' ')
      .replace(/^\s*(WT|SC|PC)\s+/i, ' ')
      .replace(/\b(SC|PC)\s*\d{3,}\b/ig, ' ')
      .replace(/\b\d{5,}\b/g, ' ')
      .replace(/[|_~^`"{}<>\[\]]/g, ' ')
      .replace(/\s+(W|WM|B|A|F|T|TF|T1F|EA|LB|PC)\s*$/i, ' ')
      .replace(/\s+/g, ' ').trim();
    s = s.split(' ').map((w) => { const k = w.replace(/[^A-Za-z]/g, '').toUpperCase(); return k in ABBR && w.length <= 7 ? ABBR[k] : w; }).filter(Boolean).join(' ');
    s = s.toLowerCase().replace(/\s+/g, ' ').trim();
    return s ? s[0].toUpperCase() + s.slice(1) : '';
  }
  const letters = (s) => (s.match(/[A-Za-z]/g) || []).length;

  function findDate(text) {
    const t = text.toUpperCase();
    const ok = (y, m, d) => y >= 2020 && y <= 2035 && m >= 1 && m <= 12 && d >= 1 && d <= 31;
    const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    let m = t.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/);
    if (m) { let y = +m[3]; if (y < 100) y += 2000; if (ok(y, +m[1], +m[2])) return iso(y, +m[1], +m[2]); }
    m = t.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
    if (m && ok(+m[1], +m[2], +m[3])) return iso(+m[1], +m[2], +m[3]);
    m = t.match(new RegExp(`\\b(${MONTHS3.join('|')})[A-Z]*\\.?\\s+(\\d{1,2}),?\\s+(20\\d{2})\\b`));
    if (m) { const mo = MONTHS3.indexOf(m[1]) + 1; if (ok(+m[3], mo, +m[2])) return iso(+m[3], mo, +m[2]); }
    m = t.match(new RegExp(`\\b(\\d{1,2})\\s?(${MONTHS3.join('|')})\\s?(20\\d{2})\\b`));
    if (m) { const mo = MONTHS3.indexOf(m[2]) + 1; if (ok(+m[3], mo, +m[1])) return iso(+m[3], mo, +m[1]); }
    return null;
  }

  function findStore(lines, text) {
    const flat = text.toLowerCase().replace(/[^a-z]/g, '');
    for (const s of STORES) if (flat.includes(s.toLowerCase().replace(/[^a-z]/g, ''))) return s === 'Lotte' ? 'Lotte Mart' : s;
    for (const l of lines.slice(0, 6)) if (letters(l) >= 4 && !/\d{3}.*\d{4}|street|\bst\b|\brd\b|\bdr\b|ave|suite|hours/i.test(l)) return cleanName(l).replace(/\b\w/g, (c) => c.toUpperCase());
    return '';
  }

  function parseReceipt(text) {
    const lines = text.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const items = [];
    let tax = 0, totals = [], lastText = '', pendingWeight = null, lastItemLine = -9;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const w = line.match(/(\d+[.,]\d+)\s*\(?[\d.,]*\)?\s*lb\s*@/i);
      const p = priceOf(line);
      if (w) {
        const wt = Number(w[1].replace(',', '.'));
        // "1.64 lb @ $1.99/lb" with no price of its own, right under an item: that item's weight
        if (!p && lastItemLine === i - 1 && items.length && !items[items.length - 1].weight) { items[items.length - 1].weight = wt; continue; }
        pendingWeight = wt;
      }
      const isTax = /\btax\b/i.test(line) && !/bag/i.test(line);
      const isTotal = /(balance due|\btotal\b|\bbalance\b|amount)/i.test(line) && !/(sub\s*-?\s*total|saving|discount|points|number|sales\s*$)/i.test(line);
      if (!p) {
        // label on one line, price alone on the next
        const next = lines[i + 1] && /^-?[$S]?\s?\d{1,4}[.,]\d{2}\s?-?(\s+[A-Z]{1,3})?$/.test(lines[i + 1]) ? priceOf(lines[i + 1]) : null;
        if (next && isTax) { tax += Math.abs(next.value); i++; continue; }
        if (next && isTotal) { totals.push(Math.abs(next.value)); i++; continue; }
        if (letters(line) >= 3 && !NOT_ITEM.test(line) && !w) lastText = line;
        continue;
      }
      if (isTax) { tax += Math.abs(p.value); continue; }
      if (isTotal) { totals.push(Math.abs(p.value)); continue; }
      if (NOT_ITEM.test(line) && !/bag/i.test(line)) continue;
      let name = cleanName(p.name);
      // a discount line: take it off the item above
      if (p.value < 0 && items.length && (letters(name) < 3 || DISCOUNT.test(p.name))) {
        items[items.length - 1].price = r2(items[items.length - 1].price + p.value);
        continue;
      }
      if (letters(name) < 3) { name = cleanName(lastText); lastText = ''; }
      if (letters(name) < 2) continue;
      const weight = pendingWeight && !/\blb\b/i.test(name) ? pendingWeight : null;
      pendingWeight = null;
      items.push({ item: name, price: r2(p.value), weight });
      lastItemLine = i;
      lastText = '';
    }
    // combine repeats into one line with ×N
    const merged = new Map();
    for (const it of items) {
      const k = it.item.toLowerCase();
      const m = merged.get(k);
      if (m) { m.n++; m.price = r2(m.price + it.price); m.weight = m.weight || it.weight ? r2((m.weight || 0) + (it.weight || 0)) : null; }
      else merged.set(k, { ...it, n: 1 });
    }
    const out = [...merged.values()].map((m) => ({
      item: m.weight ? `${m.item} (${m.weight} lb)` : m.n > 1 ? `${m.item} ×${m.n}` : m.item,
      price: m.price,
    }));
    return { store: findStore(lines, text), date: findDate(text), items: out, tax: r2(tax), total: totals.length ? Math.max(...totals) : null };
  }


  async function scan(file, onProgress) {
    ocrProgress = onProgress || null;
    try {
      const [worker, canvas] = await Promise.all([getWorker(), prepImage(file).catch(() => { throw { code: 'image_rejected' }; })]);
      const { data } = await worker.recognize(canvas);
      return parseReceipt(data.text || '');
    } finally { ocrProgress = null; }
  }
  return { scan, parseReceipt };
})();
