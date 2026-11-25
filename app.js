/* Tilly — who spent what. Accounts and data live in Supabase; each account only sees its own rows. */
(() => {
  'use strict';
  const SUPABASE_URL = 'https://uvbadnjcisuzgypzqyub.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_Lq6n-ZvzHKyYWGkEHp2EFw_jW2hU4HE';
  const ACCOUNT_FN = SUPABASE_URL + '/functions/v1/account';
  const BILLING_FN = SUPABASE_URL + '/functions/v1/billing';
  const APP_VERSION = '2.2';
  // Pro prices. Stripe charges them in US dollars once card payments are switched on.
  const PRO_PRICE = { month: 2.99, year: 24.99 };
  const FREE_PROFILES = 3, FREE_GOALS = 1;
  // Password-reset links always open the web version, which works on any device.
  const RESET_URL = 'https://tanishq-is-awesome.github.io/family-spending/';
  // ---------- phone app (Capacitor) ----------
  const Cap = window.Capacitor;
  const NATIVE = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
  const PLATFORM = NATIVE ? Cap.getPlatform() : 'web';
  const plugin = (name) => (NATIVE && Cap.registerPlugin ? Cap.registerPlugin(name) : null);
  const Camera = plugin('Camera'), Notes = plugin('LocalNotifications'), Network = plugin('Network'), DocScanner = PLATFORM === 'android' ? plugin('DocumentScanner') : null;
  if (NATIVE) document.documentElement.classList.add('native', 'platform-' + PLATFORM);

  // ---------- tiny helpers ----------
  const $ = (id) => document.getElementById(id);
  function h(tag, props, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'c') e.style.setProperty('--c', v);
      else if (k === 'style') Object.assign(e.style, v);
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k in e && !k.startsWith('aria')) e[k] = v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) e.append(kid);
    return e;
  }
  const ICONS = {
    home: '<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"/>',
    receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
    insights: '<path d="M5 20V10M12 20V4M19 20v-7"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8"/>',
    profiles: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M17.5 14.8c2 .7 3.5 2.4 3.5 5.2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-5-5-9 8"/>',
    cart: '<path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 7H6"/><circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/>',
    bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    fork: '<path d="M7 3v8a2 2 0 0 0 2 2v8"/><path d="M11 3v8a2 2 0 0 1-2 2"/><path d="M17 3c-2 1-3 3.5-3 6s1 4 3 4v8"/>',
    bill: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h4"/>',
    car: '<path d="M5 16V11l2-5h10l2 5v5"/><path d="M4 16h16v3H4z"/>',
    wrench: '<path d="M14.5 5.5a4 4 0 0 0-5.2 5.2L4 16l4 4 5.3-5.3a4 4 0 0 0 5.2-5.2l-2.6 2.6-2.4-.6-.6-2.4z"/>',
    repeat: '<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h16"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>',
    up: '<path d="M7 14l5-5 5 5"/>',
    down: '<path d="M7 10l5 5 5-5"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    star: '<path d="M12 3.5l2.5 5.3 5.8.7-4.3 4 1.1 5.8L12 16.4l-5.1 2.9L8 13.5l-4.3-4 5.8-.7z"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.6"/><circle cx="12" cy="12" r="1.1"/>',
    piggy: '<ellipse cx="12" cy="6.5" rx="7" ry="2.6"/><path d="M5 6.5v4.4c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V6.5"/><path d="M5 10.9v4.4c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6v-4.4"/><path d="M5 15.3v2.2c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6v-2.2"/>',
    tag: '<path d="M3.5 12.2V4.5h7.7l9.3 9.3-7.7 7.7z"/><circle cx="7.8" cy="8.8" r="1.4"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.4 2.4c-.7.3-1 .8-1 1.5v.6"/><path d="M12 17v.2"/>',
    doc: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 16h5"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.6 6.6l8.4 6.4 8.4-6.4"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
    alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.2"/>',
    store: '<path d="M4 9l1.6-5h12.8L20 9M4 9h16v11H4zM9.5 20v-6h5v6"/>',
    calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
    trend: '<path d="M4 17l6-6 4 4 6-7"/><path d="M15 8h5v5"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.6-.8 1.3-1.7-.4-1.1.2-2.3 1.5-2.3H17a4 4 0 0 0 4-4c0-5.5-4-10-9-10z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10.5" cy="7" r="1.2"/><circle cx="15" cy="7.5" r="1.2"/>',
    shield: '<path d="M12 3l7 3v6c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6z"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18"/>',
    chev: '<path d="M9 6l6 6-6 6"/>',
    dots: '<circle cx="6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18" cy="12" r="1.4"/>',
  };
  function icon(name) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'ic'); s.setAttribute('aria-hidden', 'true');
    s.innerHTML = ICONS[name] || ICONS.dots;
    return s;
  }
  document.querySelectorAll('[data-ic]').forEach((n) => n.prepend(icon(n.dataset.ic)));

  const r2 = (x) => Math.round(x * 100) / 100;
  const lsEarly = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const CURRENCIES = ['$', '€', '£', '₹', '¥'];
  const prefs = { currency: CURRENCIES.includes(lsEarly('tilly-currency')) ? lsEarly('tilly-currency') : '$', start: lsEarly('tilly-start') === 'all' ? 'all' : 'latest', reminder: lsEarly('tilly-reminder') === 'on' };
  // ---------- currency ----------
  // Every amount is stored in US dollars. Picking another currency converts what's shown at the
  // latest exchange rate, and amounts typed into the add sheet are converted back to dollars.
  const CUR = { '$': { code: 'USD', dp: 2 }, '€': { code: 'EUR', dp: 2 }, '£': { code: 'GBP', dp: 2 }, '₹': { code: 'INR', dp: 2 }, '¥': { code: 'JPY', dp: 0 } };
  let fx = (() => { try { const v = JSON.parse(lsEarly('tilly-fx') || 'null'); return v && v.rates ? v : null; } catch { return null; } })();
  const fxRate = (sym) => (sym === '$' ? 1 : (fx && fx.rates[CUR[sym].code]) || null);
  const cur = () => (fxRate(prefs.currency) ? prefs.currency : '$');           // falls back to $ until rates arrive
  const rate = () => fxRate(cur());
  const fmtCur = (v, neg = '−') => { const c = CUR[cur()]; return (v < -0.0049 ? neg : '') + cur() + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: c.dp, maximumFractionDigits: c.dp }); };
  const money = (v, neg) => fmtCur(v * rate(), neg);                         // a stored dollar amount, shown in the chosen currency
  const toUsd = (v) => r2(v / rate());                                       // an amount typed in the chosen currency, saved as dollars
  const moneyWhole = (v) => (v < -0.5 ? '−' : '') + cur() + Math.round(Math.abs(v) * rate()).toLocaleString('en-US');
  const unitMoney = (v, unit) => money(v) + (unit === 'lb' ? '/lb' : ' each');
  const inCur = (v) => r2(v * rate());                                       // a dollar amount, in the chosen currency, for form fields
  async function loadRates(force) {
    if (!force && fx && Date.now() - fx.fetched < 12 * 3600e3) return true;
    const codes = Object.values(CUR).map((c) => c.code).filter((c) => c !== 'USD');
    const sources = [
      ['https://api.frankfurter.dev/v1/latest?base=USD&symbols=' + codes.join(','), (j) => ({ rates: j.rates, date: j.date })],
      ['https://open.er-api.com/v6/latest/USD', (j) => ({ rates: j.rates, date: new Date(j.time_last_update_unix * 1000).toISOString().slice(0, 10) })],
    ];
    for (const [url, read] of sources) {
      try {
        const res = await fetch(url, { cache: 'no-store' }); if (!res.ok) continue;
        const got = read(await res.json());
        if (!got.rates || codes.some((c) => !(Number(got.rates[c]) > 0))) continue;
        fx = { rates: Object.fromEntries(codes.map((c) => [c, Number(got.rates[c])])), date: got.date, fetched: Date.now() };
        ls.set('tilly-fx', JSON.stringify(fx));
        return true;
      } catch {}
    }
    return !!fx;
  }
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const fmtDate = (s) => { const [, m, d] = s.split('-').map(Number); return `${MON[m - 1]} ${d}`; };
  const fmtLong = (s) => { const [y, m, d] = s.split('-').map(Number); return `${DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ${MON[m - 1]} ${d}`; };
  const fmtMonth = (k) => { if (k === 'all') return 'All time'; const [y, m] = k.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const sum = (arr, f) => r2(arr.reduce((s, x) => s + Number(x[f] || 0), 0));
  const compact = (v) => (Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : Math.abs(v) >= 1e4 ? Math.round(v / 1e3) + 'k' : Math.abs(v) >= 1e3 ? (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'k' : Math.round(v).toString());
  const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
  const initial = (s) => ((s || '?').replace(/[^\p{L}\p{N}]/gu, '')[0] || '?').toUpperCase();
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const listNames = (a) => (a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
  const fmtDay = (ts) => { const d = new Date(ts); return `${MON[d.getMonth()]} ${d.getDate()}${d.getFullYear() !== new Date().getFullYear() ? ', ' + d.getFullYear() : ''}`; };
  // Item names reduced to something comparable: "Chicken thighs ×2" and "chicken thighs" match.
  const itemKey = (t) => String(t).toLowerCase().replace(/[×x]\s*\d+\s*$/i, '').replace(/\(.*?\)/g, '').replace(/\b\d+(\.\d+)?\s*(oz|lb|lbs|ct|pk|g|kg|ml|l)\b/gi, '').replace(/[^a-z0-9& ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const itemQty = (t) => { const m = String(t).match(/[×x]\s*(\d+)\s*$/i); return m ? Number(m[1]) : 1; };
  const itemName = (t) => String(t).replace(/\s*[×x]\s*\d+\s*$/i, '').replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+/g, ' ').trim();
  // How much was bought, so prices compare fairly: by weight when the receipt shows one, otherwise by count.
  function unitOf(t) {
    const s = String(t), n = itemQty(s), w = s.match(/(\d+(?:\.\d+)?)\s*(lbs?|oz|kg|g)\b/i);
    if (w) {
      const v = parseFloat(w[1]), u = w[2].toLowerCase();
      const lb = u.startsWith('lb') ? v : u === 'oz' ? v / 16 : u === 'kg' ? v * 2.20462 : v / 453.592;
      if (lb > 0) return { qty: lb * n, unit: 'lb' };
    }
    return { qty: n, unit: 'each' };
  }
  // Fees worth avoiding. "Bag" alone counts, but not a product that comes in a bag ("chocolate bag").
  const FEE_RE = /\b(bag (?:charge|fee|tax)|(?:paper|plastic|reusable|grocery|carry ?out|shopping) bags?|delivery (?:fee|charge)|service (?:fee|charge)|convenience fee|small order fee|surcharge|shipping(?: fee| charge)?|late fee|overdraft fee|atm fee|processing fee|booking fee|card fee)\b|^\s*(?:bags?|delivery)\s*(?:[×x]\s*\d+)?\s*$/i;
  // Prices are only compared for goods. Bills, fuel, repairs and restaurant orders change with usage, not price.
  const PRICE_CATS = new Set(['Groceries', 'Shopping', 'Personal', 'Miscellaneous']);
  const median = (a) => { const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : 0; };
  const groupBy = (rows, f) => { const m = new Map(); for (const r of rows) { const k = r[f]; if (!m.has(k)) m.set(k, []); m.get(k).push(r); } return m; };
  const ls = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
  const toast = (msg) => { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), Math.max(2800, String(msg).length * 55)); };
  const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- profiles & categories ----------
  const COLORS = ['pink', 'blue', 'green', 'orange', 'violet', 'teal', 'gold', 'red'];
  const colorVar = (name) => `var(--p-${COLORS.includes(name) ? name : 'blue'})`;
  const CATS = [
    { name: 'Groceries', c: 'var(--c-groceries)', icon: 'cart' },
    { name: 'Shopping', c: 'var(--c-shopping)', icon: 'bag' },
    { name: 'Personal', c: 'var(--c-personal)', icon: 'heart' },
    { name: 'Food & dining', c: 'var(--c-dining)', icon: 'fork' },
    { name: 'Bills', c: 'var(--c-bills)', icon: 'bill' },
    { name: 'Transportation', c: 'var(--c-transport)', icon: 'car' },
    { name: 'Home & repairs', c: 'var(--c-home)', icon: 'wrench' },
    { name: 'Miscellaneous', c: 'var(--c-misc)', icon: 'dots' },
  ];
  const catInfo = (n) => CATS.find((c) => c.name === n) || CATS[CATS.length - 1];
  const GROCERY_STORES = /(harris teeter|lotte|sprouts|food lion|giant|safeway|whole foods|trader joe|costco|aldi|wegmans|mom'?s|h ?mart|patel|farm|kroger|lidl|publix|grocery|market|shoppers|walmart)/i;
  function guessCategory(item, store) {
    const i = String(item || ''), s = String(store || ''), both = i + ' ' + s;
    if (FEE_RE.test(i) || /(deposit|donation|rounding|\bfee\b)/i.test(i)) return 'Miscellaneous';
    if (/(hvac|plumb|\brepair|water heater|lawn|mowing|roof|contractor|handyman|furnace|appliance|home depot|lowe'?s|pest control)/i.test(both)) return 'Home & repairs';
    if (/(\bbill\b|internet|electric|water bill|gas bill|verizon|comcast|xfinity|at&t|t-mobile|insurance|geico|\brent\b|mortgage|subscription|netflix|spotify|hulu|icloud|dominion)/i.test(both)) return 'Bills';
    if (/(ez ?pass|\btoll|fuel|gasoline|\bexxon|\bshell\b|\bbp\b|sunoco|\buber\b(?! ?eats)|\blyft\b|parking|metro|smartrip|car wash|oil change)/i.test(both)) return 'Transportation';
    if (/(restaurant|cafe|starbucks|dunkin|mcdonald|chipotle|pizza|office|doordash|uber ?eats|grubhub|panera|subway|chick-fil-a|taco bell|wendy|burger)/i.test(s) || /\b(meal|lunch|dinner|breakfast)\b/i.test(i)) return 'Food & dining';
    if (/(henna|shampoo|conditioner|\bsoap\b|lotion|toothpaste|toothbrush|deodorant|razor|makeup|cosmetic|hair ?cut|salon|vitamin|medicine|prescription|pharmacy|eye drops|tylenol|advil|floss|sunscreen|face wash|moisturizer)/i.test(i) || /(cvs|walgreens|ulta|sephora|pharmacy)/i.test(s)) return 'Personal';
    if (/(headphone|earbud|charger|cable|shirt|pants|shoes|socks|sweater|clothes|jacket|\btoy\b|\bbook\b|phone case|electronic|towel|bedsheet|decor|\bgift\b|\bpan\b|peeler|firework)/i.test(i) || /(amazon|target|best buy|macy|tj ?maxx|marshalls|ikea|old navy|kohl)/i.test(s)) return 'Shopping';
    if (GROCERY_STORES.test(s) || /(grocer|supermarket|\bmarket\b|instacart|fresh)/i.test(s) || !s) return 'Groceries';
    if (/\b(milk|eggs?|bread|bananas?|apples?|chicken|beef|pork|fish|salmon|yogurt|cheese|butter|rice|pasta|cereal|oats|flour|sugar|coffee|tea|juice|vegetables?|fruit|lettuce|spinach|tomato(es)?|potato(es)?|onions?|carrots?|berries|grapes|avocados?|tofu|beans)\b/i.test(i)) return 'Groceries';
    return 'Miscellaneous';
  }

  // ---------- state ----------
  let sb = null, session = null, mode = null; // mode: 'remote' | 'demo'
  let profiles = [], purchases = [], taxes = [], subscriptions = [], budgets = [], goals = [], ent = null, loaded = false, loadError = false, imported = true, recoveryAt = null;
  let payments = null, demoPro = true, planSeg = 'budgets', editingSlip = null, showHiddenTips = false;
  let offline = false, syncing = false, pendingCount = 0;
  let tab = 'home', month = null, filterProfile = 'all', query = '', editing = false, storeSort = 'high', heroShown = null;
  const openCats = new Set();
  const profileById = (id) => profiles.find((p) => p.id === id);
  const pColor = (id) => colorVar((profileById(id) || {}).color);
  const inMonth = (d) => month === 'all' || month == null || (d || '').slice(0, 7) === month;

  // ---------- data: Supabase ----------
  async function fetchAll(table, cols) {
    let out = [], from = 0;
    for (;;) {
      const { data, error } = await sb.from(table).select(cols).order('id').range(from, from + 999);
      if (error) throw error;
      out = out.concat(data);
      if (data.length < 1000) return out;
      from += 1000;
    }
  }
  const ok = ({ error }) => { if (error) throw error; };
  // Offline: every signed-in account keeps a copy of its data on the device, and
  // changes made without a connection wait in an outbox until they can be sent.
  const userId = () => (session && session.user && session.user.id) || null;
  const keyFor = (kind) => `tilly-${kind}-${userId()}`;
  const readJSON = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
  const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (crypto.getRandomValues(new Uint8Array(1))[0] % 16); return (c === 'x' ? r : (r & 3) | 8).toString(16); }));
  const isNetErr = (e) => !navigator.onLine || /fetch|network|load failed|timed? ?out|offline/i.test(String((e && (e.message || e.details)) || e));
  const outbox = () => readJSON(keyFor('outbox'), []);
  const TABLES = { sp_profiles: 'profiles', sp_purchases: 'purchases', sp_taxes: 'taxes', sp_subscriptions: 'subscriptions', sp_budgets: 'budgets', sp_goals: 'goals' };
  function applyOp(d, op) {
    const t = TABLES[op.table];
    d[t] = d[t] || [];
    if (op.kind === 'insert') { const have = new Set(d[t].map((x) => x.id)); for (const r of op.rows) if (!have.has(r.id)) d[t].push({ ...r }); }
    else if (op.kind === 'update') d[t] = d[t].map((x) => (x.id === op.id ? { ...x, ...op.patch } : x));
    else if (op.kind === 'delete') {
      d[t] = d[t].filter((x) => x.id !== op.id);
      if (op.table === 'sp_profiles') { d.purchases = d.purchases.filter((x) => x.profile_id !== op.id); d.taxes = d.taxes.filter((x) => x.profile_id !== op.id); d.subscriptions = (d.subscriptions || []).filter((x) => x.profile_id !== op.id); d.budgets = (d.budgets || []).filter((b) => !(b.scope === 'profile' && b.target === op.id)); }
    }
  }
  async function execOp(op) {
    if (op.kind === 'insert') ok(await sb.from(op.table).upsert(op.rows.map(({ created_at, ...r }) => (op.table === 'sp_profiles' ? { ...r, created_at } : r)), { onConflict: 'id', ignoreDuplicates: true }));
    else if (op.kind === 'update') ok(await sb.from(op.table).update(op.patch).eq('id', op.id));
    else if (op.kind === 'delete') ok(await sb.from(op.table).delete().eq('id', op.id));
  }
  // send waiting changes in order; stop at the first network failure and try again later
  async function flush() {
    if (syncing || !sb || !userId() || (session && session.offlineOnly)) { pendingCount = outbox().length; return; }
    syncing = true;
    try {
      let box = outbox(), dropped = 0;
      while (box.length) {
        try { await execOp(box[0]); }
        catch (e) { if (isNetErr(e)) { offline = true; break; } console.error('A saved change was refused', e); dropped++; }
        box = box.slice(1); writeJSON(keyFor('outbox'), box);
      }
      pendingCount = box.length;
      if (dropped) toast(dropped === 1 ? "One change couldn't be saved." : `${dropped} changes couldn't be saved.`);
    } finally { syncing = false; drawOffline(); }
  }
  async function mutate(...ops) {
    const d = readJSON(keyFor('cache'), null) || { profiles, purchases, taxes, subscriptions, budgets, goals, ent, imported, recoveryAt };
    for (const op of ops) applyOp(d, op);
    writeJSON(keyFor('cache'), d);
    writeJSON(keyFor('outbox'), outbox().concat(ops));
    pendingCount = outbox().length;
    await flush();
  }
  const remote = {
    async load() {
      await flush();
      try {
        if (session && session.offlineOnly) throw new Error('offline');
        const [pf, pu, tx, im, rc, su, bu, go, en] = await Promise.all([
          fetchAll('sp_profiles', 'id, name, color, created_at'),
          fetchAll('sp_purchases', 'id, profile_id, date, store, item, price, category, receipt'),
          fetchAll('sp_taxes', 'id, profile_id, date, store, tax'),
          sb.from('sp_imports').select('user_id').maybeSingle(),
          sb.from('sp_recovery').select('created_at').maybeSingle(),
          fetchAll('sp_subscriptions', 'id, profile_id, name, amount, cadence, start_date, category, active, charged_through, created_at').catch(() => null),
          fetchAll('sp_budgets', 'id, scope, target, amount, created_at').catch(() => null),
          fetchAll('sp_goals', 'id, name, target, saved, due, color, created_at').catch(() => null),
          sb.from('sp_entitlements').select('status, source, plan, current_period_end, cancel_at_period_end, trial_used').maybeSingle(),
        ]);
        const prev = readJSON(keyFor('cache'), {}) || {};
        const d = {
          profiles: pf.sort((a, b) => a.created_at.localeCompare(b.created_at)),
          purchases: pu.map((x) => ({ ...x, price: Number(x.price) })),
          taxes: tx.map((x) => ({ ...x, tax: Number(x.tax) })),
          subscriptions: su ? su.map((x) => ({ ...x, amount: Number(x.amount) })).sort((a, b) => a.created_at.localeCompare(b.created_at)) : prev.subscriptions || [],
          imported: im && !im.error ? !!im.data : !!prev.imported,
          recoveryAt: rc && !rc.error ? (rc.data ? rc.data.created_at : null) : prev.recoveryAt || null,
          budgets: bu ? bu.map((x) => ({ ...x, amount: Number(x.amount) })) : prev.budgets || [],
          goals: go ? go.map((x) => ({ ...x, target: Number(x.target), saved: Number(x.saved) })).sort((a, b) => a.created_at.localeCompare(b.created_at)) : prev.goals || [],
          ent: en && !en.error ? en.data || null : prev.ent || null,
        };
        for (const op of outbox()) applyOp(d, op); // changes still on their way
        writeJSON(keyFor('cache'), d);
        offline = false;
        return d;
      } catch (e) {
        const d = readJSON(keyFor('cache'), null);
        if (d && isNetErr(e)) { offline = true; return d; }
        throw e;
      }
    },
    async addProfile(name, color) { await mutate({ kind: 'insert', table: 'sp_profiles', rows: [{ id: uuid(), name, color, created_at: new Date().toISOString() }] }); },
    async updateProfile(id, name, color) { await mutate({ kind: 'update', table: 'sp_profiles', id, patch: { name, color } }); },
    async deleteProfile(id) { await mutate({ kind: 'delete', table: 'sp_profiles', id }); },
    async addReceipt(rec) { await mutate(...receiptOps(rec)); },
    async replaceReceipt(old, rec) { await mutate(...dropOps(old), ...receiptOps(rec)); },
    async deleteReceipt(old) { await mutate(...dropOps(old)); },
    async deletePurchase(id) { await mutate({ kind: 'delete', table: 'sp_purchases', id }); },
    async deleteTax(id) { await mutate({ kind: 'delete', table: 'sp_taxes', id }); },
    async setCategory(id, category) { await mutate({ kind: 'update', table: 'sp_purchases', id, patch: { category } }); },
    async addSub(row) { await mutate({ kind: 'insert', table: 'sp_subscriptions', rows: [{ id: uuid(), created_at: new Date().toISOString(), charged_through: null, ...row }] }); },
    async updateSub(id, patch) { await mutate({ kind: 'update', table: 'sp_subscriptions', id, patch }); },
    async deleteSub(id) { await mutate({ kind: 'delete', table: 'sp_subscriptions', id }); },
    async charge(due, through) {
      await mutate(...due.map(({ sub, dates }) => ({ kind: 'insert', table: 'sp_purchases', rows: dates.map((date) => chargeRow(sub, date)) })),
        ...due.map(({ sub }) => ({ kind: 'update', table: 'sp_subscriptions', id: sub.id, patch: { charged_through: through } })));
    },
    async saveBudget(b) {
      if (b.id) await mutate({ kind: 'update', table: 'sp_budgets', id: b.id, patch: { amount: b.amount } });
      else await mutate({ kind: 'insert', table: 'sp_budgets', rows: [{ id: uuid(), scope: b.scope, target: b.target, amount: b.amount, created_at: new Date().toISOString() }] });
    },
    async deleteBudget(id) { await mutate({ kind: 'delete', table: 'sp_budgets', id }); },
    async addGoal(row) { await mutate({ kind: 'insert', table: 'sp_goals', rows: [{ id: uuid(), created_at: new Date().toISOString(), ...row }] }); },
    async updateGoal(id, patch) { await mutate({ kind: 'update', table: 'sp_goals', id, patch }); },
    async deleteGoal(id) { await mutate({ kind: 'delete', table: 'sp_goals', id }); },
    // Pro and support need a connection: they're answered by the server
    async startTrial() { const { data, error } = await sb.rpc('sp_start_trial'); if (error) throw error; return data; },
    async redeemCode(code) { const { data, error } = await sb.rpc('sp_redeem_code', { p_code: code }); if (error) throw error; return data; },
    async sendFeedback(row) { const { error } = await sb.from('sp_feedback').insert(row); if (error) throw error; },
  };
  function receiptOps({ profile_id, date, store, items, tax }) {
    const receipt = 'r' + Date.now().toString(36);
    const ops = [{ kind: 'insert', table: 'sp_purchases', rows: items.map((i) => ({ id: uuid(), profile_id, date, store, item: i.item, price: i.price, category: i.category, receipt })) }];
    if (tax > 0) ops.push({ kind: 'insert', table: 'sp_taxes', rows: [{ id: uuid(), profile_id, date, store, tax, receipt }] });
    return ops;
  }
  const dropOps = (old) => [...old.items.map((i) => ({ kind: 'delete', table: 'sp_purchases', id: i.id })), ...old.taxes.map((t) => ({ kind: 'delete', table: 'sp_taxes', id: t.id }))];
  function clearLocalCopy() { try { localStorage.removeItem(keyFor('cache')); localStorage.removeItem(keyFor('outbox')); } catch {} pendingCount = 0; offline = false; }
  function drawOffline() {
    const el = $('offline-banner'); if (!el) return;
    const show = mode === 'remote' && (offline || pendingCount > 0);
    el.hidden = !show;
    if (!show) return;
    el.textContent = offline
      ? (pendingCount ? `Offline. ${plural(pendingCount, 'change')} saved on this device will sync when you're back online.` : "Offline. Showing what's saved on this device.")
      : `Syncing ${plural(pendingCount, 'change')}…`;
  }
  async function backOnline() {
    if (mode !== 'remote' || !sb) return;
    if (session && session.offlineOnly) { try { const { data } = await sb.auth.getSession(); if (data.session) session = data.session; } catch {} }
    await refresh();
  }
  window.addEventListener('online', backOnline);
  window.addEventListener('offline', () => { if (mode === 'remote') { offline = true; drawOffline(); } });
  if (Network) Network.addListener('networkStatusChange', (st) => { if (st.connected) backOnline(); else if (mode === 'remote') { offline = true; drawOffline(); } }).catch(() => {});

  // ---------- subscriptions: schedule ----------
  // Each subscription repeats from its first charge date. When the app loads, every charge that has
  // come due since the last check is added to Receipts, and charged_through moves up to today.
  const CADENCE = { weekly: { word: 'Every week', per: 'wk', mo: 52 / 12 }, monthly: { word: 'Every month', per: 'mo', mo: 1 }, yearly: { word: 'Every year', per: 'yr', mo: 1 / 12 } };
  const parseIso = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parseIso(s); d.setDate(d.getDate() + n); return iso(d); };
  function occurrence(sub, k) {
    const s = parseIso(sub.start_date);
    if (sub.cadence === 'weekly') { s.setDate(s.getDate() + 7 * k); return iso(s); }
    const months = sub.cadence === 'yearly' ? 12 * k : k, day = s.getDate();
    const d = new Date(s.getFullYear(), s.getMonth() + months, 1);
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
    return iso(d);
  }
  // charge dates after `after` (exclusive) up to `to` (inclusive)
  function occurrencesBetween(sub, after, to, limit = 520) {
    const out = [];
    for (let k = 0; k < 5000 && out.length < limit; k++) { const d = occurrence(sub, k); if (d > to) break; if (d > after) out.push(d); }
    return out;
  }
  const lastChecked = (sub) => sub.charged_through || addDays(sub.start_date, -1);
  // the first charge still to come (today counts if it hasn't been added yet)
  function nextCharge(sub) {
    if (!sub.active) return null;
    const y = addDays(iso(new Date()), -1), after = lastChecked(sub) > y ? lastChecked(sub) : y;
    return occurrencesBetween(sub, after, '9999-12-31', 1)[0] || null;
  }
  function dueCharges(profs) {
    const today = iso(new Date()), ids = new Set(profs.map((p) => p.id));
    return subscriptions.filter((s) => s.active && ids.has(s.profile_id)).map((sub) => ({ sub, dates: occurrencesBetween(sub, lastChecked(sub), today) })).filter((x) => x.dates.length);
  }
  // the same charge always gets the same id, so two devices can't add it twice
  function stableId(text) {
    let hex = '';
    for (const seed of [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b]) {
      let x = seed >>> 0;
      for (let i = 0; i < text.length; i++) { x ^= text.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; }
      hex += x.toString(16).padStart(8, '0');
    }
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${'89ab'[parseInt(hex[16], 16) % 4]}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
  }
  const chargeRow = (sub, date) => ({ id: mode === 'demo' ? 'c' + sub.id + date : stableId(sub.id + '|' + date), profile_id: sub.profile_id, date, store: sub.name, item: `${sub.name} (${CADENCE[sub.cadence].word.toLowerCase()})`, price: sub.amount, category: sub.category, receipt: 'sub:' + sub.id });
  const isSubCharge = (p) => String(p.receipt || '').startsWith('sub:');

  // ---------- data: demo (made-up sample data, kept in memory only) ----------
  const demoDb = { profiles: [], purchases: [], taxes: [], subscriptions: [], budgets: [], goals: [], n: 0 };
  const did = () => 'd' + (++demoDb.n);
  function seedDemo() {
    demoDb.profiles = []; demoDb.purchases = []; demoDb.taxes = []; demoDb.subscriptions = []; demoDb.budgets = []; demoDb.goals = []; demoDb.n = 0; demoPro = true;
    const [maya, jordan, house] = [['Maya', 'pink'], ['Jordan', 'blue'], ['Household', 'green']].map(([name, color], i) => {
      const p = { id: did(), name, color, created_at: '2026-01-0' + (i + 1) }; demoDb.profiles.push(p); return p.id;
    });
    const now = new Date();
    const day = (monthsBack, d) => { const x = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1); const last = monthsBack === 0 ? now.getDate() : new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate(); x.setDate(Math.max(1, Math.min(d, last))); return iso(x); };
    const receipts = [
      [maya, 0, 2, 'Sprouts', 0.84, [['Blueberries 18 oz', 8.99], ['Organic bananas (2.97 lb)', 2.35], ['Chicken thighs ×2', 29.10], ['Atlantic salmon portion', 13.76], ['Carrot juice ×2', 8.98], ['Bag charge ×2', 0.20]]],
      [jordan, 0, 3, 'Food Lion', 0.18, [['Large white eggs', 2.79], ['Broccoli crowns (1.89 lb)', 4.52], ['Organic spring mix', 2.99], ['Green grapes (2.19 lb)', 3.26], ['Greek yogurt ×2', 6.50]]],
      [maya, 0, 6, 'Chipotle', 0.98, [['Burrito bowl', 13.85]]],
      [jordan, 0, 9, 'Starbucks', 0.46, [['Latte', 6.45]]],
      [house, 0, 7, 'Quick Grocer Delivery', 0.88, [['Organic bananas (2.1 lb)', 2.29], ['Large white eggs', 3.99], ['Whole milk', 4.49], ['Delivery fee', 5.99], ['Service fee', 3.49]]],
      [house, 0, 4, 'City Power & Light', 0, [['Electricity bill', 142.37]]],
      [house, 0, 5, 'Fiber Internet Co', 0, [['Internet bill', 69.00]]],
      [maya, 0, 6, 'Corner Pharmacy', 0.60, [['Eye drops', 14.99], ['Sunscreen', 11.49]]],
      [jordan, 0, 8, 'Shell', 0, [['Gasoline', 46.20]]],
      [house, 0, 9, 'Costco', 2.01, [['Quaker oats ×2', 15.98], ['Sweet potatoes ×6', 35.94], ['Organic blueberries', 11.99], ['Bulk carrots ×2', 12.98], ['Paper towels', 22.99], ['Sweater', 16.99]]],
      [jordan, 0, 10, 'Panera', 0.74, [['Lunch', 12.39]]],
      [maya, 0, 11, 'Target', 2.52, [['Wired headphones', 16.37], ['Phone case', 14.99], ['Shampoo', 8.49]]],
      [house, 0, 12, 'Handy Home Repair', 0, [['Water heater repair', 240.00]]],
      [maya, 1, 4, 'Trader Joe\'s', 0.52, [['Sourdough bread', 4.99], ['Almond flour', 8.99], ['Maple syrup', 16.99], ['Dark chocolate ×3', 8.97], ['Mandarin oranges, 3 lb', 4.97]]],
      [jordan, 1, 7, 'EZ Pass', 0, [['Toll top-up', 35.00]]],
      [house, 1, 9, 'City Power & Light', 0, [['Electricity bill', 131.08]]],
      [house, 1, 9, 'Fiber Internet Co', 0, [['Internet bill', 69.00]]],
      [jordan, 1, 13, 'Lotte Mart', 0.26, [['Sweet potatoes (3.39 lb)', 10.14], ['Green cabbage (5.04 lb)', 2.97], ['Honeyglow pineapple', 6.99], ['Pomegranate', 3.02]]],
      [maya, 1, 18, 'Sprouts', 0.71, [['Mini cucumbers ×2', 5.98], ['Chicken thighs ×4', 56.66], ['Yellow bananas (2.72 lb)', 1.60], ['Rewards discount', -4.00]]],
      [jordan, 1, 22, 'Barber', 0, [['Haircut', 24.00]]],
      [house, 1, 26, 'Costco', 1.33, [['Kirkland chocolate bag', 23.99], ['Greek yogurt ×4', 11.96], ['Chicken thighs ×2', 21.98], ['Laundry detergent', 19.99]]],
      [maya, 1, 15, 'Pizza Place', 1.71, [['Large pizza', 24.50]]],
      [jordan, 1, 3, 'Starbucks', 0.46, [['Latte', 6.45]]],
      [jordan, 1, 20, 'Food Lion', 0.21, [['Large white eggs', 2.49], ['Whole milk', 3.89], ['Greek yogurt ×2', 6.50]]],
      [maya, 2, 5, 'Sprouts', 0.66, [['Chicken thighs ×2', 28.40], ['Blueberries 18 oz', 8.49], ['Large white eggs', 3.79]]],
      [jordan, 2, 9, 'Food Lion', 0.15, [['Large white eggs', 2.29], ['Whole milk', 3.79], ['Organic spring mix', 2.99]]],
      [house, 2, 10, 'City Power & Light', 0, [['Electricity bill', 126.40]]],
      [house, 2, 10, 'Fiber Internet Co', 0, [['Internet bill', 69.00]]],
      [house, 2, 16, 'Costco', 1.12, [['Paper towels', 22.99], ['Bulk carrots ×2', 12.98], ['Quaker oats ×2', 15.98], ['Greek yogurt ×4', 11.96]]],
      [jordan, 2, 19, 'Shell', 0, [['Gasoline', 41.75]]],
      [maya, 2, 23, 'Target', 1.46, [['Throw pillow', 18.99], ['Shampoo', 8.49]]],
      [jordan, 2, 27, 'Panera', 0.74, [['Lunch', 11.89]]],
    ];
    for (const [profile_id, back, d, store, tax, items] of receipts) {
      const date = day(back, d);
      for (const [item, price] of items) demoDb.purchases.push({ id: did(), profile_id, date, store, item, price, category: guessCategory(item, store) });
      if (tax) demoDb.taxes.push({ id: did(), profile_id, date, store, tax });
    }
    for (const [profile_id, name, amount, cadence, back, d, category] of [
      [house, 'Streaming service', 15.49, 'monthly', 3, 3, 'Bills'], [maya, 'Music app', 10.99, 'monthly', 2, 8, 'Bills'],
      [jordan, 'Lunch plan', 12.00, 'weekly', 1, 6, 'Food & dining'], [jordan, 'Cloud storage', 29.99, 'yearly', 11, 20, 'Bills']])
      demoDb.subscriptions.push({ id: did(), profile_id, name, amount, cadence, start_date: day(back, d), category, active: true, charged_through: null, created_at: '2026-01-05' });
    demoDb.budgets = [
      { id: did(), scope: 'total', target: '', amount: 1100, created_at: '2026-01-05' },
      { id: did(), scope: 'category', target: 'Groceries', amount: 320, created_at: '2026-01-05' },
      { id: did(), scope: 'category', target: 'Food & dining', amount: 60, created_at: '2026-01-05' },
      { id: did(), scope: 'profile', target: maya, amount: 250, created_at: '2026-01-06' },
    ];
    const by = (m) => iso(new Date(now.getFullYear(), now.getMonth() + m, 1));
    demoDb.goals = [
      { id: did(), name: 'Summer trip', target: 1800, saved: 640, due: by(7), color: 'teal', created_at: '2026-01-06' },
      { id: did(), name: 'Emergency fund', target: 3000, saved: 2150, due: null, color: 'green', created_at: '2026-01-07' },
    ];
  }
  const demo = {
    async load() { return { profiles: demoDb.profiles.slice(), purchases: demoDb.purchases.slice(), taxes: demoDb.taxes.slice(), subscriptions: demoDb.subscriptions.map((x) => ({ ...x })), budgets: demoDb.budgets.map((x) => ({ ...x })), goals: demoDb.goals.map((x) => ({ ...x })) }; },
    async addProfile(name, color) { demoDb.profiles.push({ id: did(), name, color, created_at: new Date().toISOString() }); },
    async updateProfile(id, name, color) { Object.assign(demoDb.profiles.find((p) => p.id === id), { name, color }); },
    async deleteProfile(id) { demoDb.profiles = demoDb.profiles.filter((p) => p.id !== id); demoDb.purchases = demoDb.purchases.filter((p) => p.profile_id !== id); demoDb.taxes = demoDb.taxes.filter((p) => p.profile_id !== id); demoDb.subscriptions = demoDb.subscriptions.filter((p) => p.profile_id !== id); demoDb.budgets = demoDb.budgets.filter((b) => !(b.scope === 'profile' && b.target === id)); },
    async addReceipt({ profile_id, date, store, items, tax }) {
      for (const i of items) demoDb.purchases.push({ id: did(), profile_id, date, store, item: i.item, price: i.price, category: i.category });
      if (tax > 0) demoDb.taxes.push({ id: did(), profile_id, date, store, tax });
    },
    async replaceReceipt(old, rec) { await demo.deleteReceipt(old); await demo.addReceipt(rec); },
    async deleteReceipt(old) { const ids = new Set([...old.items, ...old.taxes].map((x) => x.id)); demoDb.purchases = demoDb.purchases.filter((x) => !ids.has(x.id)); demoDb.taxes = demoDb.taxes.filter((x) => !ids.has(x.id)); },
    async deletePurchase(id) { demoDb.purchases = demoDb.purchases.filter((p) => p.id !== id); },
    async deleteTax(id) { demoDb.taxes = demoDb.taxes.filter((p) => p.id !== id); },
    async setCategory(id, category) { demoDb.purchases.find((p) => p.id === id).category = category; },
    async addSub(row) { demoDb.subscriptions.push({ id: did(), created_at: new Date().toISOString(), charged_through: null, ...row }); },
    async updateSub(id, patch) { Object.assign(demoDb.subscriptions.find((x) => x.id === id), patch); },
    async deleteSub(id) { demoDb.subscriptions = demoDb.subscriptions.filter((x) => x.id !== id); },
    async charge(due, through) {
      for (const { sub, dates } of due) {
        for (const date of dates) { const r = chargeRow(sub, date); if (!demoDb.purchases.some((x) => x.id === r.id)) demoDb.purchases.push(r); }
        demoDb.subscriptions.find((x) => x.id === sub.id).charged_through = through;
      }
    },
    async saveBudget(b) {
      if (b.id) demoDb.budgets.find((x) => x.id === b.id).amount = b.amount;
      else demoDb.budgets.push({ id: did(), scope: b.scope, target: b.target, amount: b.amount, created_at: new Date().toISOString() });
    },
    async deleteBudget(id) { demoDb.budgets = demoDb.budgets.filter((x) => x.id !== id); },
    async addGoal(row) { demoDb.goals.push({ id: did(), created_at: new Date().toISOString(), ...row }); },
    async updateGoal(id, patch) { Object.assign(demoDb.goals.find((x) => x.id === id), patch); },
    async deleteGoal(id) { demoDb.goals = demoDb.goals.filter((x) => x.id !== id); },
    async startTrial() { demoPro = true; return { ok: true }; },
    async redeemCode() { return { error: 'demo' }; },
    async sendFeedback() { throw { code: 'demo' }; },
  };
  const db = () => (mode === 'demo' ? demo : remote);

  async function refresh() {
    try {
      let d = await db().load();
      subscriptions = d.subscriptions || [];
      const due = dueCharges(d.profiles || []);
      if (due.length) { try { await db().charge(due, iso(new Date())); d = await db().load(); subscriptions = d.subscriptions || []; } catch (e) { console.error('subscription charges', e); } }
      profiles = d.profiles; purchases = d.purchases; taxes = d.taxes; budgets = d.budgets || []; goals = d.goals || [];
      if (mode === 'remote') { imported = !!d.imported; recoveryAt = d.recoveryAt || null; ent = d.ent || null; }
      loaded = true; loadError = false;
      const months = monthList();
      if (month == null) month = prefs.start === 'all' ? 'all' : months[0] || 'all';
      else if (month !== 'all' && !months.includes(month)) month = months[0] || 'all';
      if (filterProfile !== 'all' && !profileById(filterProfile)) filterProfile = 'all';
    } catch (e) {
      console.error(e);
      loadError = true;
    }
    applyAccent();
    render();
    drawOffline();
    scheduleReminder();
    if (loaded) afterLoad();
  }
  const monthList = () => [...new Set([...purchases, ...taxes].map((x) => (x.date || '').slice(0, 7)).filter(Boolean))].sort().reverse();

  // ---------- monthly reminder (phone app) ----------
  const REMINDER_ID = 4101;
  async function scheduleReminder() {
    if (!Notes) return;
    try {
      await Notes.cancel({ notifications: [{ id: REMINDER_ID }] });
      if (!prefs.reminder || mode !== 'remote' || !loaded) return;
      const now = new Date(), key = iso(now).slice(0, 7), name = MONTHS[now.getMonth()];
      const ps = purchases.filter((p) => p.date.slice(0, 7) === key), ts = taxes.filter((t) => t.date.slice(0, 7) === key);
      const top = profiles.map((p) => ({ p, t: sum(ps.filter((x) => x.profile_id === p.id), 'price') })).sort((a, b) => b.t - a.t)[0];
      const body = ps.length
        ? `Tilly recorded ${money(r2(sum(ps, 'price') + sum(ts, 'tax')))} for ${name}${top && top.t > 0 && profiles.length > 1 ? `. Top spender: ${top.p.name} (${money(top.t)})` : ''}. Tap to see the breakdown and add any receipts you missed.`
        : `${name} is over. Add any receipts you still have so your totals stay complete.`;
      await Notes.schedule({ notifications: [{
        id: REMINDER_ID, title: `Your ${name} spending`, body,
        schedule: { at: new Date(now.getFullYear(), now.getMonth() + 1, 1, 9, 0, 0), allowWhileIdle: true },
        isExactNotification: false, extra: { tab: 'insights', month: key },
      }] });
    } catch (e) { console.warn('Could not schedule the monthly reminder', e); }
  }
  if (Notes) Notes.addListener('localNotificationActionPerformed', (a) => {
    const ex = a && a.notification && a.notification.extra;
    if (ex && mode === 'remote') { if (ex.month) month = ex.month; setTab(ex.tab || 'insights'); }
  }).catch(() => {});
  async function setReminder(on) {
    if (on && Notes) {
      let st = await Notes.checkPermissions().catch(() => ({ display: 'denied' }));
      if (st.display !== 'granted') st = await Notes.requestPermissions().catch(() => ({ display: 'denied' }));
      if (st.display !== 'granted') { toast("Notifications are off for Tilly. Turn them on in your phone's Settings."); on = false; }
    }
    setPref('reminder', on ? 'on' : 'off'); prefs.reminder = on;
    await scheduleReminder();
    if (on) toast('Reminder set for the 1st of next month');
    render();
  }

  // ---------- shared view pieces ----------
  const avatar = (name, c, cls = '') => h('span', { class: 'avatar ' + cls, c, text: initial(name), 'aria-hidden': 'true' });
  const dot = (c) => h('i', { class: 'dot', c });
  function card(title, note, ...body) {
    return h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('div', null, h('h2', { text: title }), note && h('p', { class: 'note', text: note }))), ...body);
  }
  function rmButton(onConfirm) {
    const b = h('button', { class: 'rm', text: 'Remove' });
    b.addEventListener('click', async () => {
      if (!b.classList.contains('armed')) {
        b.classList.add('armed'); b.textContent = 'Confirm';
        setTimeout(() => { if (b.isConnected && !b.disabled) { b.classList.remove('armed'); b.textContent = 'Remove'; } }, 4000);
        return;
      }
      b.disabled = true; b.textContent = '…';
      try { await onConfirm(); toast('Removed'); await refresh(); }
      catch { b.disabled = false; b.textContent = 'Remove'; b.classList.remove('armed'); toast("Couldn't remove it. Try again."); }
    });
    return b;
  }
  function catSelect(value, onChange) {
    const sel = h('select', { class: 'cat-select', 'aria-label': 'Category' }, CATS.map((c) => new Option(c.name, c.name)));
    sel.value = catInfo(value).name;
    if (onChange) sel.addEventListener('change', () => onChange(sel.value));
    return sel;
  }
  function buildSlips(ps, ts) {
    const m = new Map();
    const key = (x) => `${x.date}|${x.store || ''}|${x.profile_id}`;
    const get = (x) => m.get(key(x)) || (m.set(key(x), { date: x.date, store: x.store || '', profile_id: x.profile_id, items: [], taxes: [] }), m.get(key(x)));
    for (const p of ps) get(p).items.push(p);
    for (const t of ts) get(t).taxes.push(t);
    return [...m.values()].sort((a, b) => b.date.localeCompare(a.date) || a.store.localeCompare(b.store));
  }
  function slipEl(s, { compact = false, edit = false } = {}) {
    const p = profileById(s.profile_id) || { name: '?', color: 'blue' };
    const it = sum(s.items, 'price'), tt = sum(s.taxes, 'tax'), c = colorVar(p.color);
    const slip = h('article', { class: 'slip' + (compact ? ' compact' : '') },
      h('div', { class: 'slip-head' },
        avatar(s.store || '?', c),
        h('span', { class: 'slip-store', text: s.store || 'No store' }),
        h('span', { class: 'slip-total', text: money(r2(it + tt)) }),
        h('span', { class: 'slip-meta' }, h('span', { class: 'who', c }, dot(c), p.name), h('span', { text: fmtLong(s.date) + (compact ? ' · ' + plural(s.items.length, 'item') : '') }))));
    if (compact) return slip;
    const lines = h('div', { class: 'slip-lines' });
    for (const x of s.items.slice().sort((a, b) => String(a.item).localeCompare(String(b.item)))) {
      const nm = h('span', { class: 'nm' }, h('span', { text: x.item }));
      nm.append(edit
        ? catSelect(x.category, async (v) => { try { await db().setCategory(x.id, v); toast(`Moved to ${v}`); await refresh(); } catch { toast("Couldn't change the category."); } })
        : h('span', { class: 'tag', c: catInfo(x.category).c, text: catInfo(x.category).name }));
      lines.append(h('div', { class: 'slip-line' }, nm, h('span', { class: 'p' + (x.price < 0 ? ' neg' : ''), text: money(x.price) }), edit ? rmButton(() => db().deletePurchase(x.id)) : h('span')));
    }
    for (const t of s.taxes) lines.append(h('div', { class: 'slip-line tax' }, h('span', { text: 'Tax' }), h('span', { class: 'p', text: money(t.tax) }), edit ? rmButton(() => db().deleteTax(t.id)) : h('span')));
    if (!s.partial) lines.append(h('div', { class: 'slip-line sum' + (s.taxes.length ? '' : ' tax') }, h('span', { text: 'Total' }), h('span', { class: 'p', text: money(r2(it + tt)) }), h('span')));
    if (edit && !s.partial) {
      const subOnly = s.items.length > 0 && s.items.every(isSubCharge);
      lines.append(h('div', { class: 'slip-actions' },
        subOnly ? h('span', { class: 'note', text: 'Added by a subscription' }) : h('button', { class: 'btn ghost small', onclick: () => openAdd(s) }, icon('edit'), 'Edit receipt'),
        armButton('danger-link', 'Delete receipt', 'Tap again to delete it', async () => { await db().deleteReceipt(s); toast('Receipt deleted'); await refresh(); })));
    }
    slip.append(lines);
    return slip;
  }
  function animateNumber(el, to) {
    const from = heroShown; heroShown = to;
    if (reduceMotion || from == null || from === to) { el.textContent = money(to); return; }
    const t0 = performance.now(), dur = 500;
    const step = (t) => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = money(from + (to - from) * e); if (k < 1 && el.isConnected) requestAnimationFrame(step); else el.textContent = money(to); };
    requestAnimationFrame(step);
  }

  // In the first week of a month, Home shows a short recap of the month before.
  function recapCard() {
    const now = new Date();
    if (now.getDate() > 7) return null;
    const last = new Date(now.getFullYear(), now.getMonth() - 1, 1), key = iso(last).slice(0, 7);
    if (ls.get('tilly-recap-seen') === key + ':' + (userId() || mode)) return null;
    const ps = purchases.filter((p) => p.date.slice(0, 7) === key);
    if (!ps.length) return null;
    const total = r2(sum(ps, 'price') + sum(taxes.filter((t) => t.date.slice(0, 7) === key), 'tax'));
    const parts = profiles.map((p) => ({ p, t: sum(ps.filter((x) => x.profile_id === p.id), 'price') })).filter((x) => x.t > 0).sort((a, b) => b.t - a.t);
    const el = h('section', { class: 'card recap' },
      h('div', { class: 'recap-top' }, h('span', { class: 'recap-kicker', text: `${MONTHS[last.getMonth()]} recap` }),
        h('button', { class: 'x small', 'aria-label': 'Hide recap', text: '×', onclick: () => { ls.set('tilly-recap-seen', key + ':' + (userId() || mode)); el.remove(); } })),
      h('p', { class: 'recap-num', text: money(total) }),
      h('p', { class: 'note', text: parts.slice(0, 3).map((x) => `${x.p.name} ${money(x.t)}`).join(' · ') + (parts.length > 3 ? ' · …' : '') }),
      h('button', { class: 'btn ghost small', style: { marginTop: '10px' }, text: `See ${MONTHS[last.getMonth()]}`, onclick: () => { month = key; setTab('insights'); } }));
    return el;
  }

  // The barcode on the Home receipt opens a QR code holding a plain-text summary of the month.
  function monthSummary(key, ps, ts) {
    const m = (v) => money(v, '-');
    const items = sum(ps, 'price'), tax = sum(ts, 'tax');
    const rows = profiles.map((p) => ({ n: p.name, t: sum(ps.filter((x) => x.profile_id === p.id), 'price') })).filter((x) => x.t !== 0).sort((a, b) => b.t - a.t);
    return [`Tilly - ${fmtMonth(key)}`, ...rows.map((r) => `${r.n}: ${m(r.t)}`), `Tax: ${m(tax)}`, `Total: ${m(r2(items + tax))}`, `${plural(ps.length, 'item')}`].join('\n');
  }
  let qrSummary = '';
  function openQr(key, ps, ts) {
    qrSummary = monthSummary(key, ps, ts);
    $('qr-title').textContent = key === 'all' ? 'Share all-time totals' : `Share ${fmtMonth(key)}`;
    $('qr-text').textContent = qrSummary;
    const box = $('qr-box'); box.textContent = '';
    if (window.qrcode) {
      qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];
      const qr = qrcode(0, 'M'); qr.addData(qrSummary, 'Byte'); qr.make();
      const n = qr.getModuleCount(), q = 2, size = n + q * 2;
      let d = '';
      for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (qr.isDark(y, x)) d += `M${x + q} ${y + q}h1v1h-1z`;
      box.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="QR code of the summary"><path fill="#14161f" d="${d}"/></svg>`;
    }
    $('qr-share').hidden = !navigator.share;
    openSheet('sheet-qr');
  }
  $('qr-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(qrSummary); toast('Summary copied'); } catch (e) { toast("Couldn't copy. Select the text instead."); }
  });
  $('qr-share').addEventListener('click', async () => { try { await navigator.share({ title: 'Tilly', text: qrSummary }); } catch (e) {} });

  // ---------- HOME ----------
  // The month's receipt prints out of a till at the top. It prints once per visit; after that it's just there.
  let printed = false;
  function homeWidgets() {
    const ws = [], tb = budgets.find((b) => b.scope === 'total'), goPlan = () => { planSeg = 'budgets'; setTab('plan'); };
    if (tb) {
      const st = budgetState(tb);
      ws.push(h('button', { class: 'widget w-budget ' + st.status, onclick: goPlan },
        h('span', { class: 'w-label' }, h('i', { class: 'w-dot', 'aria-hidden': 'true' }), `${MONTHS[new Date().getMonth()]} budget`),
        h('span', { class: 'w-value' }, moneyWhole(Math.abs(st.left)), h('small', { text: st.left >= 0 ? ' left' : ' over' })),
        budgetBar(tb, st),
        h('span', { class: 'w-sub', text: st.left > 0 && st.daysLeft ? `${moneyWhole(st.perDay)} a day for ${plural(st.daysLeft, 'day')}` : STATUS_TXT[st.status] })));
    } else {
      ws.push(h('button', { class: 'widget w-empty', onclick: goPlan },
        h('span', { class: 'w-label' }, icon('target'), 'Monthly budget'),
        h('span', { class: 'w-value small', text: 'Set a budget' }),
        h('span', { class: 'w-sub', text: 'See what you can spend each day.' })));
    }
    const tips = visibleTips(), total = tips.reduce((t, x) => t + (x.save || 0), 0), top = tips.find((x) => x.save >= 1) || tips[0];
    ws.push(h('button', { class: 'widget w-save', onclick: () => setTab('insights') },
      h('span', { class: 'w-label' }, icon('piggy'), 'Ways to save'),
      total >= 1 ? h('span', { class: 'w-value' }, '~' + moneyWhole(total), h('small', { text: ' a month' })) : h('span', { class: 'w-value small', text: top ? plural(tips.length, 'tip') : 'No tips yet' }),
      h('span', { class: 'w-sub clamp', text: top ? top.title : 'Add a few receipts and Tilly starts looking.' })));
    return h('div', { class: 'widgets' }, ws);
  }
  function homeCategories(ps) {
    const total = sum(ps, 'price');
    const rows = CATS.map((c) => ({ c, t: sum(ps.filter((p) => catInfo(p.category).name === c.name), 'price') })).filter((x) => x.t > 0).sort((a, b) => b.t - a.t);
    if (!rows.length || total <= 0) return null;
    const top = rows.slice(0, 4), rest = rows.slice(4).reduce((t, x) => t + x.t, 0), max = top[0].t;
    return h('button', { class: 'card where', onclick: () => setTab('insights') },
      h('span', { class: 'where-head' }, h('b', { text: 'Where it went' }), h('span', { class: 'note', text: 'Before tax' })),
      ...top.map((x) => h('span', { class: 'where-row', c: x.c.c },
        h('span', { class: 'cat-icon sm' }, icon(x.c.icon)),
        h('span', { class: 'where-name', text: x.c.name }),
        h('span', { class: 'where-amt', text: money(x.t) }),
        h('span', { class: 'where-bar' }, h('i', { style: { width: Math.max(3, (x.t / max) * 100) + '%' } })))),
      rest > 0 ? h('span', { class: 'note', text: `${rows.length - 4} more ${rows.length - 4 === 1 ? 'category' : 'categories'}: ${money(rest)}` }) : null);
  }
  function receiptRow(s) {
    const p = profileById(s.profile_id) || { name: '?', color: 'blue' }, c = colorVar(p.color);
    const total = r2(sum(s.items, 'price') + sum(s.taxes, 'tax'));
    return h('button', { class: 'rrow', onclick: () => { filterProfile = 'all'; query = (s.store || '').toLowerCase(); setTab('receipts'); } },
      avatar(s.store || '?', c),
      h('span', { class: 'rrow-main' }, h('b', { text: s.store || 'No store' }), h('small', null, h('span', { class: 'who', c }, dot(c), p.name), `${fmtDate(s.date)}, ${plural(s.items.length, 'item')}`)),
      h('span', { class: 'rrow-amt', text: money(total) }));
  }
  function viewHome() {
    const out = [];
    if (!profiles.length) {
      out.push(h('section', { class: 'card welcome' },
        h('span', { class: 'avatar xl round', c: 'var(--accent)' }, icon('profiles')),
        h('h2', { text: 'Start with a profile' }),
        h('p', { text: 'A profile is anyone or anything you want a separate total for: you, a partner, the household, a side business.' }),
        h('button', { class: 'btn primary', text: 'Create your first profile', onclick: () => openProfileSheet(null) }),
        mode === 'remote' && !imported && h('button', { class: 'link', text: 'Used the Family Spending app before? Bring your data over', onclick: () => setTab('settings') })));
      return out;
    }
    const ps = purchases.filter((p) => inMonth(p.date)), ts = taxes.filter((t) => inMonth(t.date));
    const items = sum(ps, 'price'), tax = sum(ts, 'tax');
    const dates = ps.map((p) => p.date).sort();
    const range = dates.length ? (dates[0] === dates[dates.length - 1] ? fmtDate(dates[0]) : `${fmtDate(dates[0])} – ${fmtDate(dates[dates.length - 1])}`) : fmtMonth(month);
    const totals = profiles.map((p) => ({ p, total: sum(ps.filter((x) => x.profile_id === p.id), 'price'), n: ps.filter((x) => x.profile_id === p.id).length }));
    const pos = totals.filter((t) => t.total > 0), posSum = pos.reduce((s, t) => s + t.total, 0);

    const num = h('p', { class: 'receipt-num' });
    const split = h('div', { class: 'split', role: 'img', 'aria-label': 'Share of spending by profile' }, pos.map((t) => h('i', { c: colorVar(t.p.color), style: { width: (t.total / posSum) * 100 + '%' }, title: `${t.p.name} ${money(t.total)}` })));
    const receipt = h('section', { class: 'receipt' + (printed || reduceMotion ? '' : ' printing'), id: 'hero' },
      h('div', { class: 'receipt-top' }, h('span', { text: 'Tilly' }), h('span', { text: range })),
      h('p', { class: 'receipt-label', text: `Total spent, ${fmtMonth(month)}` }),
      num,
      h('p', { class: 'receipt-break', text: ps.length ? `items ${money(items)} + tax ${money(tax)}` : 'No receipts yet. Tap + to add one.' }),
      h('hr', { class: 'rule' }),
      pos.length ? split : null,
      pos.length ? h('div', { class: 'split-key' }, pos.map((t) => h('span', null, dot(colorVar(t.p.color)), t.p.name, h('b', { text: pct(t.total, posSum) + '%' })))) : null,
      ps.length ? h('button', { class: 'barcode-btn', type: 'button', 'aria-label': 'Show a QR code of this month\'s totals', onclick: () => openQr(month, ps, ts) },
        h('div', { class: 'barcode', 'aria-hidden': 'true' }), h('span', { text: 'Tap to share' })) : h('div', { class: 'barcode', 'aria-hidden': 'true' }));
    printed = true;
    animateNumber(num, r2(items + tax));
    out.push(h('div', { class: 'home-grid' },
      h('div', { class: 'till' }, h('span', { class: 'till-slot', 'aria-hidden': 'true' }), h('div', { class: 'paper' }, receipt)),
      h('div', { class: 'home-side' }, homeWidgets(), homeCategories(ps), recapCard())));

    out.push(h('div', { class: 'section-head' }, h('h2', { class: 'section-title', text: 'Who spent what' }), h('span', { class: 'note', text: 'Before tax' })));
    const max = Math.max(1, ...totals.map((t) => t.total));
    out.push(h('div', { class: 'pscroll', role: 'list' },
      totals.map((t) => h('button', { class: 'pcard', role: 'listitem', c: colorVar(t.p.color), onclick: () => { filterProfile = t.p.id; setTab('receipts'); } },
        avatar(t.p.name, colorVar(t.p.color), 'round solid'),
        h('span', { class: 'pcard-name', text: t.p.name }),
        h('span', { class: 'pcard-amt', text: money(t.total) }),
        h('span', { class: 'tile-bar' }, h('i', { style: { width: Math.max(0, (t.total / max) * 100) + '%' } })),
        h('span', { class: 'pcard-sub', text: `${pct(Math.max(0, t.total), Math.max(posSum, 0.01))}% of the month, ${plural(t.n, 'item')}` }))),
      h('button', { class: 'pcard new', role: 'listitem', onclick: () => openProfileSheet(null) }, h('span', { class: 'plus' }, icon('plus')), h('span', { text: 'New profile' }), !isPro() && profiles.length >= FREE_PROFILES ? proChip('tiny') : null)));

    const slips = buildSlips(ps, ts).slice(0, 5);
    out.push(h('div', { class: 'section-head' }, h('h2', { class: 'section-title', text: 'Latest receipts' }), slips.length ? h('button', { class: 'link', text: 'See all', onclick: () => { filterProfile = 'all'; setTab('receipts'); } }) : null));
    out.push(slips.length ? h('div', { class: 'rlist' }, slips.map(receiptRow)) : h('div', { class: 'card empty', text: `Nothing in ${fmtMonth(month)} yet. Tap + to add a receipt.` }));
    return out;
  }

  // ---------- RECEIPTS ----------
  function receiptList() {
    const box = h('div', { class: 'slips', id: 'slip-list' });
    const mine = (x) => inMonth(x.date) && (filterProfile === 'all' || x.profile_id === filterProfile);
    let list = buildSlips(purchases.filter(mine), taxes.filter(mine));
    if (query) list = list.map((s) => {
      if (s.store.toLowerCase().includes(query)) return s;
      const its = s.items.filter((i) => i.item.toLowerCase().includes(query) || catInfo(i.category).name.toLowerCase().includes(query));
      return its.length ? { ...s, items: its, taxes: [], partial: true } : null;
    }).filter(Boolean);
    if (!list.length) box.append(h('div', { class: 'card empty', text: query ? 'No items match that search.' : `No receipts in ${fmtMonth(month)}. Tap + to add one.` }));
    for (const s of list) box.append(slipEl(s, { edit: editing }));
    return box;
  }
  function viewReceipts() {
    const chip = (id, label, c) => h('button', { class: 'chip', c, 'aria-pressed': String(filterProfile === id), onclick: () => { filterProfile = id; render(); } }, c ? dot(c) : null, label);
    const search = h('input', { class: 'input search', id: 'receipt-search', type: 'search', placeholder: 'Search items, stores, categories', 'aria-label': 'Search receipts', value: query });
    search.addEventListener('input', () => { query = search.value.trim().toLowerCase(); $('slip-list').replaceWith(receiptList()); });
    const mine = (x) => inMonth(x.date) && (filterProfile === 'all' || x.profile_id === filterProfile);
    const total = r2(sum(purchases.filter(mine), 'price') + sum(taxes.filter(mine), 'tax'));
    return [
      h('div', { class: 'section-head' }, h('h2', { class: 'section-title', text: 'Receipts' }), h('span', { class: 'note mono', text: money(total) + ' with tax' })),
      h('div', { class: 'chips', role: 'group', 'aria-label': 'Filter by profile' }, chip('all', 'Everyone'), profiles.map((p) => chip(p.id, p.name, colorVar(p.color)))),
      h('div', { class: 'tools' }, search, h('button', { class: 'toggle', 'aria-pressed': String(editing), text: editing ? 'Done' : 'Edit', onclick: () => { editing = !editing; render(); } })),
      receiptList(),
    ];
  }

  // ---------- INSIGHTS ----------
  function viewInsights() {
    const ps = purchases.filter((p) => inMonth(p.date)), ts = taxes.filter((t) => inMonth(t.date));
    if (!purchases.length) return [h('div', { class: 'card empty', text: 'Insights show up here once you add a receipt.' })];
    const all = sum(ps, 'price');
    const totalOf = (key) => r2(sum(purchases.filter((p) => p.date.slice(0, 7) === key), 'price') + sum(taxes.filter((t) => t.date.slice(0, 7) === key), 'tax'));
    const prevKey = month === 'all' ? null : iso(new Date(+month.slice(0, 4), +month.slice(5, 7) - 2, 1)).slice(0, 7);
    const prevPs = prevKey ? purchases.filter((p) => p.date.slice(0, 7) === prevKey) : [];
    const prevName = prevKey ? MONTHS[+prevKey.slice(5, 7) - 1] : '';
    const legend = () => h('div', { class: 'legend' }, profiles.map((p) => h('span', null, dot(colorVar(p.color)), p.name)));

    // ---- overview ----
    const now = new Date(), thisKey = iso(now).slice(0, 7);
    const spent = r2(all + sum(ts, 'tax'));
    const prevTotal = prevKey ? totalOf(prevKey) : 0;
    let spanDays;
    if (month === 'all') { const ds = ps.map((p) => p.date).sort(); spanDays = ds.length ? Math.round((parseIso(ds[ds.length - 1]) - parseIso(ds[0])) / 864e5) + 1 : 1; }
    else spanDays = month === thisKey ? now.getDate() : new Date(+month.slice(0, 4), +month.slice(5, 7), 0).getDate();
    const perDay = spent / Math.max(1, spanDays);
    const inMonthDays = month === 'all' ? 0 : new Date(+month.slice(0, 4), +month.slice(5, 7), 0).getDate();
    const receiptsN = new Set(ps.map((p) => p.receipt || `${p.date}|${p.store}|${p.profile_id}`)).size;
    const delta = (cur, prev, label) => {
      if (!(prev > 0)) return null;
      const d = (cur - prev) / prev, up = d > 0.005, down = d < -0.005;
      return h('span', { class: 'delta ' + (up ? 'up' : down ? 'down' : '') }, up || down ? icon(up ? 'up' : 'down') : null, `${Math.abs(Math.round(d * 100))}% vs ${label}`);
    };
    const kpi = (label, value, sub) => h('div', { class: 'kpi' }, h('span', { class: 'k-label', text: label }), h('span', { class: 'k-val', text: value }), sub ? h('span', { class: 'k-sub' }, sub) : null);
    const biggest = ps.filter((p) => !isSubCharge(p)).slice().sort((a, b) => b.price - a.price)[0];
    const projected = month === thisKey && now.getDate() < inMonthDays ? r2(perDay * inMonthDays) : null;
    const overview = h('section', { class: 'card' },
      h('div', { class: 'kpis' },
        kpi(month === 'all' ? 'Spent, all time' : 'Spent with tax', money(spent), month === thisKey && prevKey ? delta(spent, totalOf(prevKey) * (now.getDate() / Math.max(1, new Date(+prevKey.slice(0, 4), +prevKey.slice(5, 7), 0).getDate())), `${prevName} so far`) : delta(spent, prevTotal, prevName)),
        kpi('Per day', money(perDay), month === 'all' ? `over ${plural(spanDays, 'day')}` : `over ${plural(spanDays, 'day')}`),
        projected != null ? kpi('On pace for', money(projected), `by ${MON[now.getMonth()]} ${inMonthDays}`) : kpi(prevKey ? `${prevName} total` : 'Months tracked', prevKey ? money(prevTotal) : String(new Set(purchases.map((p) => p.date.slice(0, 7))).size), null),
        kpi('Receipts', String(receiptsN), plural(ps.length, 'item'))),
      biggest ? h('p', { class: 'k-foot' }, 'Biggest purchase: ', h('b', { text: biggest.item }), ` at ${biggest.store || 'a store'}, ${money(biggest.price)} on ${fmtDate(biggest.date)}`) : null);

    // ---- highlights: short plain-language findings ----
    const notes = [];
    const catTotals = (arr) => { const m = {}; for (const p of arr) { const c = catInfo(p.category).name; m[c] = (m[c] || 0) + p.price; } return m; };
    const ct = catTotals(ps), pct0 = catTotals(prevPs);
    const topCat = Object.entries(ct).sort((a, b) => b[1] - a[1])[0];
    if (topCat && all > 0) notes.push([catInfo(topCat[0]).icon, catInfo(topCat[0]).c, `${topCat[0]} took the biggest share: ${money(topCat[1])}, ${pct(topCat[1], all)}% of what you spent before tax.`]);
    if (prevPs.length) {
      const ch = Object.keys({ ...ct, ...pct0 }).map((c) => ({ c, d: (ct[c] || 0) - (pct0[c] || 0) })).filter((x) => Math.abs(x.d) >= 5).sort((a, b) => Math.abs(b.d) - Math.abs(a.d))[0];
      if (ch) notes.push([ch.d > 0 ? 'up' : 'down', ch.d > 0 ? 'var(--bad)' : 'var(--good)', `${ch.c} ${ch.d > 0 ? 'went up' : 'came down'} ${money(Math.abs(ch.d))} from ${prevName}${month === thisKey ? ' (the month isn\'t over yet)' : ''}.`]);
    }
    const visits = {}; for (const p of ps) if (!isSubCharge(p) && p.store) (visits[p.store] = visits[p.store] || new Set()).add(p.date);
    const topStore = Object.entries(visits).sort((a, b) => b[1].size - a[1].size)[0];
    if (topStore && topStore[1].size > 1) notes.push(['cart', 'var(--accent)', `You shopped at ${topStore[0]} ${topStore[1].size} times, spending ${money(sum(ps.filter((p) => p.store === topStore[0]), 'price'))}.`]);
    const subSpent = sum(ps.filter(isSubCharge), 'price');
    if (subSpent > 0) notes.push(['repeat', 'var(--c-bills)', `Subscriptions were ${money(subSpent)}, ${pct(subSpent, all)}% of spending.`]);
    else if (subscriptions.some((x) => x.active)) notes.push(['repeat', 'var(--c-bills)', `Your subscriptions cost about ${money(subscriptions.filter((x) => x.active).reduce((t, x) => t + perMonth(x), 0))} a month.`]);
    const wk = [0, 0, 0, 0, 0, 0, 0]; for (const p of ps) if (!isSubCharge(p)) wk[parseIso(p.date).getDay()] += p.price;
    const wd = wk.indexOf(Math.max(...wk));
    if (ps.length >= 8 && wk[wd] > 0) notes.push(['insights', 'var(--c-shopping)', `${['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'][wd]} are your biggest spending day (${pct(wk[wd], all)}% of the total).`]);
    const highlights = notes.length ? card('Highlights', null, h('ul', { class: 'hl' }, notes.slice(0, 5).map(([ic, c, t]) => h('li', { c }, h('span', { class: 'hl-ic' }, icon(ic)), h('span', { text: t }))))) : null;

    // ---- trend: the last 12 months with data ----
    const have = [...new Set(purchases.map((p) => p.date.slice(0, 7)).concat(taxes.map((t) => t.date.slice(0, 7))))].sort();
    const keys = [];
    if (have.length) { const last = have[have.length - 1] > thisKey ? have[have.length - 1] : thisKey; let [y, m] = last.split('-').map(Number);
      for (let i = 0; i < 12; i++) { const k = `${y}-${String(m).padStart(2, '0')}`; if (k < have[0]) break; keys.unshift(k); if (--m === 0) { m = 12; y--; } } }
    const tvals = keys.map((k) => ({ k, v: totalOf(k) })), tmax = Math.max(1, ...tvals.map((x) => x.v));
    const done = tvals.filter((x) => x.k !== thisKey), avg = done.length ? done.reduce((t, x) => t + x.v, 0) / done.length : 0;
    const trend = card('Monthly trend', avg ? `With tax. Average ${money(avg)} a month${keys.includes(thisKey) ? ', not counting this month' : ''}. Tap a month to open it.` : 'With tax. Tap a month to open it.',
      h('div', { class: 'trend', style: { gridTemplateColumns: `repeat(${tvals.length}, minmax(0, 1fr))` } },
        avg ? h('i', { class: 'trend-avg', style: { bottom: `calc(26px + ${(avg / tmax) * 130}px)` }, title: 'Average' }) : null,
        tvals.map((x) => h('button', { class: 'tbar', disabled: !x.v, 'aria-current': String(month === x.k), 'aria-label': `${fmtMonth(x.k)}: ${money(x.v)}`, onclick: () => { month = month === x.k ? 'all' : x.k; render(); window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }); } },
          h('span', { class: 'tval', text: cur() + compact(x.v * rate()) }),
          h('span', { class: 'tcol' + (x.k === thisKey ? ' partial' : '') }, h('i', { style: { height: Math.max(3, (x.v / tmax) * 130) + 'px' } })),
          h('span', { class: 'tlbl', text: MON[+x.k.slice(5, 7) - 1] })))));

    // ---- what you buy most ----
    const norm = itemKey, qty = itemQty;
    const im = new Map();
    for (const p of ps) { if (isSubCharge(p) || p.price <= 0) continue; const k = norm(p.item); if (!k || /^(bag|bag charge|lunch|tax)$/.test(k)) continue; const o = im.get(k) || { name: itemName(p.item), n: 0, total: 0, stores: new Set() }; o.n += qty(p.item); o.total += p.price; o.stores.add(p.store); im.set(k, o); }
    const top = [...im.values()].filter((o) => o.n > 1).sort((a, b) => b.n - a.n || b.total - a.total).slice(0, 8);
    const buys = top.length ? card('What you buy most', 'Items bought more than once, before tax.', h('div', { class: 'buys' }, top.map((o) => h('div', { class: 'buy' },
      h('span', { class: 'buy-n', text: '×' + o.n }), h('span', { class: 'buy-name' }, o.name, h('small', { text: `${[...o.stores].slice(0, 2).join(', ')} · about ${money(o.total / o.n)} each` })), h('span', { class: 'buy-amt', text: money(o.total) }))))) : null;

    // categories
    const cats = h('div', { class: 'cats' });
    const rows = CATS.map((c) => ({ c, its: ps.filter((p) => catInfo(p.category).name === c.name) })).filter((r) => r.its.length).map((r) => ({ ...r, total: sum(r.its, 'price') })).sort((a, b) => b.total - a.total);
    const cmax = Math.max(1, ...rows.map((r) => r.total));
    for (const r of rows) {
      const open = openCats.has(r.c.name);
      const was = pct0[r.c.name] || 0, diff = r.total - was;
      const chg = prevPs.length && Math.abs(diff) >= 1 ? h('span', { class: 'chg ' + (diff > 0 ? 'up' : 'down') }, icon(diff > 0 ? 'up' : 'down'), money(Math.abs(diff))) : null;
      const sub = h('span', { class: 'cat-sub' }, chg, h('span', { text: plural(r.its.length, 'item') }),
        profiles.map((p) => { const t = sum(r.its.filter((x) => x.profile_id === p.id), 'price'); return t ? h('span', null, dot(colorVar(p.color)), money(t)) : null; }).filter(Boolean).slice(0, 4));
      cats.append(h('button', { class: 'cat-row', c: r.c.c, 'aria-expanded': String(open), onclick: () => { open ? openCats.delete(r.c.name) : openCats.add(r.c.name); render(); } },
        h('span', { class: 'cat-icon' }, icon(r.c.icon)),
        h('span', { class: 'cat-name' }, r.c.name, h('span', { class: 'chev', text: '›', 'aria-hidden': 'true' })),
        h('span', { class: 'cat-amt', text: money(r.total) }),
        sub, h('span', { class: 'cat-share', text: pct(r.total, all) + '%' }),
        h('span', { class: 'cat-bar' }, h('i', { style: { width: Math.max(2, (Math.max(0, r.total) / cmax) * 100) + '%' } }))));
      if (open) cats.append(h('div', { class: 'cat-items' }, r.its.slice().sort((a, b) => b.date.localeCompare(a.date) || b.price - a.price).map((x) =>
        h('div', { class: 'cat-item' }, h('span', { class: 'd', text: fmtDate(x.date) }), h('span', { class: 'n' }, x.item, h('small', { text: `${(profileById(x.profile_id) || {}).name || ''} · ${x.store || ''}` })), h('span', { class: 'p', text: money(x.price) })))));
    }
    if (!rows.length) cats.append(h('p', { class: 'empty', text: `Nothing in ${fmtMonth(month)}.` }));

    // tax
    const stat = (cls, a, b, c, d) => h('div', { class: 'stat ' + cls }, a, h('span', { text: b }), h('span', { text: c }), h('span', { text: d }));
    const stats = h('div', { class: 'stats' }, stat('head', h('span', { text: 'Who' }), 'Items', 'Tax', 'With tax'));
    for (const p of profiles) {
      const i = sum(ps.filter((x) => x.profile_id === p.id), 'price'), t = sum(ts.filter((x) => x.profile_id === p.id), 'tax');
      stats.append(stat('', h('span', { class: 'nm' }, dot(colorVar(p.color)), h('b', { text: p.name })), money(i), money(t), money(r2(i + t))));
    }
    stats.append(stat('total', h('span', { text: 'Everyone' }), money(all), money(sum(ts, 'tax')), money(r2(all + sum(ts, 'tax')))));

    // months
    const mm = new Map();
    const get = (k) => mm.get(k) || (mm.set(k, { k, by: {}, tax: 0, total: 0 }), mm.get(k));
    for (const p of purchases) { const o = get(p.date.slice(0, 7)); o.by[p.profile_id] = (o.by[p.profile_id] || 0) + p.price; o.total += p.price; }
    for (const t of taxes) get(t.date.slice(0, 7)).tax += t.tax;
    const months = h('div', { class: 'months' }, [...mm.values()].sort((a, b) => b.k.localeCompare(a.k)).map((r) =>
      h('button', { class: 'month-row', 'aria-current': String(month === r.k), onclick: () => { month = month === r.k ? 'all' : r.k; render(); window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }); } },
        h('span', { class: 'mname', text: fmtMonth(r.k) }), h('span', { class: 'mtot', text: money(r2(r.total + r.tax)) }),
        h('span', { class: 'msub' }, profiles.filter((p) => r.by[p.id]).slice(0, 5).map((p) => h('span', null, dot(colorVar(p.color)), money(r2(r.by[p.id])))), h('span', { text: 'tax ' + money(r2(r.tax)) })))));

    // stores & days
    const group = (keyFn) => { const m = new Map(); for (const p of ps) { const k = keyFn(p); const o = m.get(k) || { k, by: {}, total: 0 }; o.by[p.profile_id] = (o.by[p.profile_id] || 0) + p.price; o.total += p.price; m.set(k, o); } return [...m.values()].map((o) => ({ ...o, total: r2(o.total) })); };
    const cmp = { high: (a, b) => b.total - a.total, low: (a, b) => a.total - b.total, az: (a, b) => a.k.localeCompare(b.k) }[storeSort];
    const srows = group((p) => p.store || 'No store').sort(cmp), smax = Math.max(1, ...srows.map((r) => r.total));
    const stores = h('div', { class: 'stores' }, srows.map((r) => h('div', { class: 'store' },
      avatar(r.k, 'var(--accent)'), h('span', { class: 'store-name', text: r.k }), h('span', { class: 'store-amt', text: money(r.total) }),
      h('div', { class: 'track' }, profiles.filter((p) => r.by[p.id] > 0).map((p) => h('i', { c: colorVar(p.color), style: { width: (r.by[p.id] / smax) * 100 + '%' }, title: `${p.name} ${money(r2(r.by[p.id]))}` }))))));
    const sortSeg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Sort stores' }, [['high', 'Most'], ['low', 'Least'], ['az', 'A–Z']].map(([k, label]) => h('button', { 'aria-pressed': String(storeSort === k), text: label, onclick: () => { storeSort = k; render(); } })));
    const storeCard = h('section', { class: 'card' }, h('div', { class: 'card-head' }, h('div', null, h('h2', { text: 'By store' }), h('p', { class: 'note', text: 'Before tax, split by profile.' })), sortSeg), srows.length ? stores : h('p', { class: 'empty', text: `Nothing in ${fmtMonth(month)}.` }), legend());

    const drows = group((p) => p.date).sort((a, b) => a.k.localeCompare(b.k)), dmax = Math.max(1, ...drows.map((r) => r.total));
    const days = h('div', { class: 'days' }, drows.map((r) => h('div', { class: 'day', title: `${fmtDate(r.k)}: ${money(r.total)}` },
      h('span', { class: 'day-amt', text: cur() + Math.round(r.total * rate()).toLocaleString('en-US') }),
      h('div', { class: 'day-col' }, profiles.filter((p) => r.by[p.id] > 0).map((p) => h('i', { c: colorVar(p.color), style: { height: Math.max(2, (r.by[p.id] / dmax) * 110) + 'px' } }))),
      h('span', { class: 'day-lbl', text: fmtDate(r.k) }))));

    return [
      h('div', { class: 'section-head' }, h('h2', { class: 'section-title', text: 'Insights' }), h('span', { class: 'note', text: fmtMonth(month) })),
      savingsCard(),
      overview,
      highlights,
      trend,
      priceTrackerCard(),
      card('By category', `Before tax${prevPs.length ? `, with the change from ${prevName}` : ''}. Tap a category to see what's in it.`, cats),
      buys,
      storeCard,
      card('By day', 'Before tax, split by profile.', drows.length ? days : h('p', { class: 'empty', text: `Nothing in ${fmtMonth(month)}.` }), legend()),
      card('Tax', 'Sales tax from receipts, kept separate from item totals.', stats),
      card('Month by month', 'With tax. Tap a month to view it.', months),
      h('section', { class: 'card report-card' },
        h('div', { class: 'card-head' }, h('div', null, h('h2', { text: 'Monthly report' }), h('p', { class: 'note', text: NATIVE ? 'Open Tilly on the web to save a report as a PDF.' : `A one-page summary of ${fmtMonth(month === 'all' ? thisMonth() : month)} to save as a PDF or print.` })), isPro() ? null : proChip()),
        h('button', { class: 'btn ghost', disabled: NATIVE, onclick: printReport }, icon('download'), 'Save as PDF')),
    ];
  }

  // ---------- SUBSCRIPTIONS ----------
  const perMonth = (s) => s.amount * CADENCE[s.cadence].mo;
  function viewSubs() {
    const head = h('div', { class: 'section-head' }, h('h2', { class: 'section-title', text: 'Subscriptions' }),
      h('button', { class: 'btn primary small', onclick: () => openSubSheet(null) }, icon('plus'), 'New'));
    if (!subscriptions.length) return [head, h('section', { class: 'card welcome' },
      h('span', { class: 'avatar xl round', c: 'var(--accent)' }, icon('repeat')),
      h('h2', { text: 'Track what renews' }),
      h('p', { text: 'Add streaming, the gym, your phone plan or anything else that charges you weekly, monthly or yearly. Tilly adds each charge to Receipts on its date, so your totals stay complete.' }),
      h('button', { class: 'btn primary', text: 'Add a subscription', onclick: () => openSubSheet(null) }))];

    const today = iso(new Date()), in30 = addDays(today, 30);
    const live = subscriptions.filter((s) => s.active && profileById(s.profile_id));
    const mo = live.reduce((t, s) => t + perMonth(s), 0);
    const byP = profiles.map((p) => ({ p, t: live.filter((s) => s.profile_id === p.id).reduce((t, s) => t + perMonth(s), 0) })).filter((x) => x.t > 0);
    const summary = h('section', { class: 'receipt sub-hero' },
      h('div', { class: 'receipt-top' }, h('span', { text: 'Recurring' }), h('span', { text: `${live.length} active` })),
      h('p', { class: 'receipt-label', text: 'About a month' }),
      h('p', { class: 'receipt-num', text: money(mo) }),
      h('p', { class: 'receipt-break', text: `${money(mo * 12)} a year` }),
      byP.length ? h('hr', { class: 'rule' }) : null,
      byP.length ? h('div', { class: 'split' }, byP.map((x) => h('i', { c: colorVar(x.p.color), style: { width: (x.t / mo) * 100 + '%' } }))) : null,
      byP.length ? h('div', { class: 'split-key' }, byP.map((x) => h('span', null, dot(colorVar(x.p.color)), x.p.name, h('b', { text: money(x.t) })))) : null);

    const upcoming = [];
    for (const s of live) { const after = addDays(today, -1) > lastChecked(s) ? addDays(today, -1) : lastChecked(s); for (const d of occurrencesBetween(s, after, in30, 10)) upcoming.push({ s, d }); }
    upcoming.sort((a, b) => a.d.localeCompare(b.d) || b.s.amount - a.s.amount);
    const soon = card('Next 30 days', upcoming.length ? `${plural(upcoming.length, 'charge')} · ${money(upcoming.reduce((t, x) => t + x.s.amount, 0))}` : null,
      upcoming.length ? h('div', { class: 'upcoming' }, upcoming.slice(0, 12).map(({ s, d }) => {
        const days = Math.round((parseIso(d) - parseIso(today)) / 864e5);
        return h('div', { class: 'up-row' },
          h('span', { class: 'up-date' }, h('b', { text: String(parseIso(d).getDate()) }), h('small', { text: MON[parseIso(d).getMonth()] })),
          h('span', { class: 'up-name' }, s.name, h('small', { text: days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days` })),
          h('span', { class: 'up-amt', text: money(s.amount) }));
      })) : h('p', { class: 'empty', text: 'Nothing renews in the next 30 days.' }));

    const rows = subscriptions.slice().sort((a, b) => (b.active - a.active) || perMonth(b) - perMonth(a));
    const list = card('All subscriptions', 'Each charge is added to Receipts automatically. Tap one to edit or pause it.',
      h('div', { class: 'sub-list' }, rows.map((s) => {
        const p = profileById(s.profile_id), nx = nextCharge(s);
        return h('button', { class: 'sub-row' + (s.active ? '' : ' paused'), onclick: () => openSubSheet(s) },
          h('span', { class: 'avatar round solid', c: pColor(s.profile_id), text: initial(s.name) }),
          h('span', { class: 'sub-main' }, h('b', { text: s.name }), h('small', { text: [p ? p.name : '', CADENCE[s.cadence].word, s.active ? (nx ? 'Next ' + fmtDate(nx) : '') : 'Paused'].filter(Boolean).join(' · ') })),
          h('span', { class: 'sub-amt' }, money(s.amount), h('small', { text: '/' + CADENCE[s.cadence].per })));
      })));
    return [head, summary, soon, list];
  }

  let subEditing = null, subCadence = 'monthly', subFor = null, subActive = true;
  const subCat = catSelect('Bills'); subCat.id = 'sub-cat'; subCat.classList.add('input'); $('sub-cat-slot').replaceWith(subCat);
  function drawSubForm() {
    $('sub-cadence').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === subCadence)));
    $('sub-active').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.v === 'on') === subActive)));
    $('sub-who').replaceChildren(...profiles.map((p) => h('button', { type: 'button', class: 'chip', c: colorVar(p.color), 'aria-pressed': String(subFor === p.id), onclick: () => { subFor = p.id; drawSubForm(); } }, dot(colorVar(p.color)), p.name)));
    $('sub-amount-label').textContent = `Amount (${CUR[cur()].code})`;
    const start = $('sub-start').value, today = iso(new Date());
    let note = '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(start) && !subEditing && start <= today) {
      const n = occurrencesBetween({ start_date: start, cadence: subCadence }, addDays(start, -1), today).length;
      note = `${plural(n, 'charge')} from ${fmtDate(start)} up to today will be added to Receipts. Pick a later date to skip past charges.`;
    } else if (subEditing && !subEditing.active && subActive) note = 'Charges from while it was paused are skipped.';
    else if (subEditing) note = 'Changes apply to future charges. Past charges stay in Receipts.';
    $('sub-note').textContent = note;
  }
  function openSubSheet(s) {
    if (!profiles.length) { toast('Create a profile first'); openProfileSheet(null); return; }
    subEditing = s;
    $('sub-title').textContent = s ? 'Edit subscription' : 'New subscription';
    $('sub-save').textContent = s ? 'Save changes' : 'Add subscription';
    $('sub-name').value = s ? s.name : '';
    $('sub-amount').value = s ? (s.amount * rate()).toFixed(CUR[cur()].dp) : '';
    $('sub-start').value = s ? s.start_date : iso(new Date());
    $('sub-start-label').textContent = s ? 'Started' : 'First charge';
    subCadence = s ? s.cadence : 'monthly'; subActive = s ? s.active : true;
    subFor = s ? s.profile_id : (subFor && profileById(subFor) ? subFor : profiles[0].id);
    subCat.value = s ? catInfo(s.category).name : 'Bills';
    $('sub-active-row').hidden = !s;
    $('sub-err').textContent = '';
    const del = $('sub-delete'); del.hidden = !s; del.dataset.armed = ''; del.textContent = 'Delete subscription';
    $('sub-suggest').replaceChildren(...(s ? [] : [['Netflix', 'Bills'], ['Spotify', 'Bills'], ['Gym', 'Personal'], ['Phone plan', 'Bills'], ['Car insurance', 'Transportation'], ['iCloud', 'Bills']]
      .filter(([n]) => !subscriptions.some((x) => x.name.toLowerCase() === n.toLowerCase()))
      .map(([n, c]) => h('button', { type: 'button', text: n, onclick: () => { $('sub-name').value = n; subCat.value = c; if (n === 'Car insurance') subCadence = 'yearly'; drawSubForm(); $('sub-amount').focus(); } }))));
    drawSubForm();
    openSheet('sheet-sub');
    if (!s) $('sub-name').focus();
  }
  $('sub-cadence').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { subCadence = b.dataset.v; drawSubForm(); } });
  $('sub-active').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { subActive = b.dataset.v === 'on'; drawSubForm(); } });
  $('sub-start').addEventListener('input', drawSubForm);
  $('sub-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('sub-name').value.trim(), amt = Number($('sub-amount').value), start = $('sub-start').value;
    const err = (m) => { $('sub-err').textContent = m; };
    if (!name) return err('Give it a name.');
    if (!($('sub-amount').value !== '' && amt >= 0)) return err('Enter how much it costs.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return err('Pick the date of a charge.');
    if (!subFor) return err('Pick whose it is.');
    const row = { name, amount: toUsd(amt), cadence: subCadence, start_date: start, profile_id: subFor, category: subCat.value };
    $('sub-save').disabled = true;
    try {
      if (subEditing) {
        const patch = { ...row, active: subActive };
        if (subActive && !subEditing.active) patch.charged_through = addDays(iso(new Date()), -1);   // skip the paused stretch
        if (start !== subEditing.start_date && start > iso(new Date())) patch.charged_through = null;
        await db().updateSub(subEditing.id, patch);
      } else await db().addSub({ ...row, active: true });
      closeSheets(); toast(subEditing ? 'Subscription saved' : `${name} added`); await refresh();
    } catch { err("Couldn't save it. Try again."); }
    $('sub-save').disabled = false;
  });
  $('sub-delete').addEventListener('click', async () => {
    const del = $('sub-delete'); if (!subEditing) return;
    if (!del.dataset.armed) { del.dataset.armed = '1'; del.textContent = `Tap again to delete ${subEditing.name}. Past charges stay in Receipts.`; return; }
    del.disabled = true;
    try { await db().deleteSub(subEditing.id); closeSheets(); toast('Subscription deleted'); await refresh(); }
    catch { $('sub-err').textContent = "Couldn't delete it. Try again."; }
    del.disabled = false;
  });

  // ---------- TILLY PRO ----------
  // Pro comes from a 14-day trial, a code, or a paid plan. The server decides (sp_entitlements);
  // the app only reads it, and the database itself enforces the free plan's limits.
  const LIVE = ['trialing', 'active', 'past_due'];
  function proActive(e) {
    if (!e || !LIVE.includes(e.status)) return false;
    if (!e.current_period_end) return true;
    const grace = e.source === 'stripe' ? 3 * 864e5 : 0;
    return new Date(e.current_period_end).getTime() > Date.now() - grace;
  }
  const isPro = () => (mode === 'demo' ? demoPro : proActive(ent));
  const daysUntil = (ts) => Math.max(0, Math.ceil((new Date(ts).getTime() - Date.now()) / 864e5));
  const proChip = (cls = '') => h('span', { class: 'pro-chip ' + cls, text: 'PRO' });
  const PRO_FEATURES = [
    ['save', 'piggy', 'Every way to save', 'Cheaper stores for things you buy often, price rises, and your full savings plan.'],
    ['prices', 'tag', 'Price tracker', 'The price history of everything you buy, at every store.'],
    ['budgets', 'target', 'Budgets for everything', 'A budget for each category and each person, with alerts before you go over.'],
    ['goals', 'star', 'Unlimited savings goals', 'Save for as many things as you like, with a monthly plan for each.'],
    ['profiles', 'profiles', 'Unlimited profiles', 'Track as many people, pets or side businesses as you need.'],
    ['report', 'doc', 'Monthly PDF reports', 'A clean summary of any month to keep, print or share.'],
    ['colors', 'palette', 'Pro colors', 'Six more accent colors to make Tilly yours.'],
  ];
  async function callBilling(action, extra) {
    const headers = { 'content-type': 'application/json' };
    if (session && session.access_token) headers.authorization = 'Bearer ' + session.access_token;
    const res = await fetch(BILLING_FN, { method: 'POST', headers, body: JSON.stringify({ action, ...extra }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw { code: d.error || 'server_error' };
    return d;
  }
  let paymentsErr = false;
  async function loadPayments() {
    if ((payments != null && !paymentsErr) || mode !== 'remote') return payments;
    try { payments = !!(await callBilling('config')).payments; paymentsErr = false; } catch { payments = false; paymentsErr = true; }
    return payments;
  }
  function requirePro(feature) { if (isPro()) return true; openPaywall(feature); return false; }

  let payPlan = 'year', payFeature = null;
  function drawPaywall() {
    const pro = isPro(), e = ent || {}, demoMode = mode === 'demo';
    const trialing = !demoMode && pro && e.source === 'trial';
    const canTrial = demoMode ? !pro : !pro && !e.trial_used;
    const live = !demoMode && payments === true;
    const canBuy = live && (!pro || trialing);
    $('pro-title').textContent = trialing ? 'Keep Pro after your trial' : 'Spend smarter with Tilly Pro';
    $('pro-sub').textContent = trialing
      ? `Your free trial ends ${fmtDay(e.current_period_end)}. Subscribe to keep every Pro feature.`
      : 'Find cheaper stores, catch price rises and keep every category on budget.';
    $('pro-feats').replaceChildren(...PRO_FEATURES.map(([k, ic, t, d]) => h('li', { class: k === payFeature ? 'hi' : '' },
      h('span', { class: 'pf-ic' }, icon(ic)), h('div', null, h('strong', { text: t }), h('span', { text: d })))));
    const save = Math.round((1 - PRO_PRICE.year / (PRO_PRICE.month * 12)) * 100);
    const opt = (k, title, price, sub, badge) => h('button', { type: 'button', role: 'radio', class: 'plan-opt', 'aria-checked': String(payPlan === k), onclick: () => { payPlan = k; drawPaywall(); } },
      h('span', { class: 'po-radio', 'aria-hidden': 'true' }),
      h('span', { class: 'po-main' }, h('b', { text: title }), h('small', { text: sub })),
      h('span', { class: 'po-price' }, badge ? h('em', { text: badge }) : null, h('b', { class: 'mono', text: price })));
    $('plan-pick').replaceChildren(
      opt('year', 'Yearly', `$${PRO_PRICE.year}`, `$${(PRO_PRICE.year / 12).toFixed(2)} a month, billed once a year`, `Save ${save}%`),
      opt('month', 'Monthly', `$${PRO_PRICE.month}`, 'Billed every month'));
    $('plan-pick').hidden = !canBuy;
    $('pro-trial').hidden = !canTrial;
    $('pro-trial').textContent = demoMode ? 'Turn on Pro in the demo' : 'Start 14-day free trial';
    $('pro-buy').hidden = !canBuy;
    $('pro-buy').className = 'btn ' + (canTrial ? 'ghost' : 'primary');
    $('pro-buy').textContent = `Subscribe for $${PRO_PRICE[payPlan]} a ${payPlan}`;
    let soonText = '';
    if (demoMode) soonText = pro ? 'Every Pro feature is on in the demo. In your own account, Pro is free for 14 days.' : '';
    else if (canTrial) soonText = 'No card needed. The trial ends by itself and never charges you.';
    else if (!canBuy && (trialing || !pro)) soonText = payments == null ? 'Checking for paid plans…' : trialing ? 'Paid plans open soon. Until then, enjoy your trial, or use a Pro code.' : 'Paid plans open soon. Have a code? Use it below.';
    $('pro-soon').hidden = !soonText; $('pro-soon').textContent = soonText;
    $('pro-code-toggle').hidden = demoMode || !$('pro-code-row').hidden;
    $('pro-fine').hidden = demoMode;
  }
  async function openPaywall(feature) {
    payFeature = feature || null;
    $('pro-err').textContent = ''; $('pro-ok').textContent = '';
    $('pro-code').value = ''; $('pro-code-row').hidden = true;
    drawPaywall();
    openSheet('sheet-pro');
    if (mode === 'remote' && (payments == null || paymentsErr)) { await loadPayments(); if (!$('sheet-pro').hidden) drawPaywall(); }
  }
  $('pro-trial').addEventListener('click', async () => {
    const b = $('pro-trial'), err = $('pro-err');
    b.disabled = true; err.textContent = '';
    try {
      const r = await db().startTrial();
      if (r && r.error) throw { code: r.error };
      closeSheets();
      if (mode === 'remote') await refresh(); else { applyAccent(); render(); }
      toast(mode === 'demo' ? 'Pro is on in the demo' : 'Your 14-day Pro trial has started. Enjoy!');
    } catch (e) {
      const c = e && e.code;
      err.textContent = c === 'trial_used' ? 'This account has already used its free trial.'
        : c === 'already_pro' ? 'You already have Pro.'
        : isNetErr(e) ? "You're offline. Connect to the internet to start your trial."
        : "Couldn't start the trial. Try again.";
    }
    b.disabled = false;
  });
  $('pro-buy').addEventListener('click', async () => {
    if (mode !== 'remote') return;
    const b = $('pro-buy'), err = $('pro-err');
    b.disabled = true; err.textContent = '';
    try { const { url } = await callBilling('checkout', { plan: payPlan }); if (url) { location.href = url; return; } throw {}; }
    catch (e) {
      const c = e && e.code;
      err.textContent = c === 'payments_off' ? "Paid plans aren't open yet." : c === 'already_subscribed' ? 'You already have a subscription. Manage it in Settings.'
        : c === 'already_lifetime' ? 'You already have Pro for life.' : "Couldn't open checkout. Check your connection and try again.";
    }
    b.disabled = false;
  });
  $('pro-code-toggle').addEventListener('click', () => { $('pro-code-row').hidden = false; $('pro-code-toggle').hidden = true; $('pro-code').focus(); });
  $('pro-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); redeemCode(); } });
  $('pro-redeem').addEventListener('click', redeemCode);
  async function redeemCode() {
    const code = $('pro-code').value.trim(), err = $('pro-err'), b = $('pro-redeem');
    err.textContent = '';
    if (code.replace(/[^A-Za-z0-9]/g, '').length < 4) { err.textContent = 'Enter the code exactly as you got it.'; return; }
    if (mode !== 'remote') { err.textContent = 'Codes work in your own account.'; return; }
    b.disabled = true;
    try {
      const r = await db().redeemCode(code);
      if (r && r.error) throw { code: r.error };
      closeSheets(); await refresh();
      toast(r.plan === 'lifetime' ? 'Pro is yours for life. Enjoy!' : `Pro is on until ${fmtDay(r.ends)}`);
    } catch (e) {
      const c = e && e.code;
      err.textContent = c === 'bad_code' ? "That code didn't work. Check it and try again." : c === 'expired' ? 'That code has expired.'
        : c === 'used_up' ? 'That code has already been used.' : c === 'already_redeemed' ? "You've already used this code."
        : c === 'already_lifetime' ? 'You already have Pro for life.' : c === 'subscribed' ? 'You have a Pro subscription. You can use codes after it ends.'
        : isNetErr(e) ? "You're offline. Connect to the internet to use a code." : "Couldn't use the code. Try again.";
    }
    b.disabled = false;
  }
  async function openPortal(btn) {
    if (btn) btn.disabled = true;
    try { const { url } = await callBilling('portal'); if (url) { location.href = url; return; } throw {}; }
    catch (e) { toast(e && e.code === 'no_subscription' ? "There's no subscription on this account." : "Couldn't open your subscription settings. Try again."); }
    if (btn) btn.disabled = false;
  }
  // Back from Stripe Checkout: Pro turns on once Stripe tells the server, usually within seconds.
  async function afterCheckout() {
    toast('Payment received. Turning on Pro…');
    for (let i = 0; i < 8 && !isPro(); i++) { await new Promise((r) => setTimeout(r, 2500)); await refresh(); }
    toast(isPro() ? 'Welcome to Tilly Pro!' : "Pro can take a minute to turn on. Reopen Tilly if it hasn't yet.");
  }

  // Pro accent colors (saved on this device; they switch back when Pro ends)
  // Gold is everyone's color; Pro adds six more. Tilly is always dark, so each one is tuned for charcoal.
  const ACCENTS = [['gold', 'Gold', '#E8B04B'], ['emerald', 'Emerald', '#5FD3A2'], ['coral', 'Coral', '#FF9A85'], ['violet', 'Violet', '#B79CF5'], ['lagoon', 'Lagoon', '#63CFDC'], ['rose', 'Rose', '#F28BB1'], ['graphite', 'Silver', '#D4D2CC']];
  const curAccent = () => { const a = ls.get('tilly-accent') || 'gold'; return ACCENTS.some((x) => x[0] === a) ? a : 'gold'; };
  function applyAccent() {
    let a = curAccent();
    if (a !== 'gold' && (mode === 'demo' || loaded) && !isPro()) a = 'gold';
    const root = document.documentElement;
    if (a === 'gold') root.removeAttribute('data-accent'); else root.setAttribute('data-accent', a);
  }

  // ---------- BUDGETS ----------
  // Monthly budgets for everything, a category, or a person. They count the calendar month
  // and start over on the 1st. The overall budget is free; the rest need Pro.
  const thisMonth = () => iso(new Date()).slice(0, 7);
  const daysIn = (key) => new Date(+key.slice(0, 4), +key.slice(5, 7), 0).getDate();
  function spentFor(b, key) {
    const ps = purchases.filter((p) => p.date.slice(0, 7) === key), ts = taxes.filter((t) => t.date.slice(0, 7) === key);
    if (b.scope === 'category') return r2(sum(ps.filter((p) => catInfo(p.category).name === b.target), 'price'));
    if (b.scope === 'profile') return r2(sum(ps.filter((p) => p.profile_id === b.target), 'price') + sum(ts.filter((t) => t.profile_id === b.target), 'tax'));
    return r2(sum(ps, 'price') + sum(ts, 'tax'));
  }
  const budgetLive = (b) => b.scope === 'total' || (isPro() && (b.scope !== 'profile' || !!profileById(b.target)));
  function budgetState(b, key = thisMonth()) {
    const spent = spentFor(b, key), isNow = key === thisMonth(), n = daysIn(key);
    const day = isNow ? new Date().getDate() : n, frac = day / n;
    const left = r2(b.amount - spent), daysLeft = isNow ? n - day + 1 : 0, used = b.amount > 0 ? spent / b.amount : 0;
    const status = spent > b.amount ? 'over' : isNow && used > frac + 0.1 && used > 0.25 ? 'fast' : used >= 0.8 ? 'close' : 'ok';
    return { spent, left, used, frac, daysLeft, perDay: daysLeft > 0 && left > 0 ? left / daysLeft : 0, status };
  }
  const budgetName = (b) => (b.scope === 'total' ? 'Everything' : b.scope === 'category' ? b.target : (profileById(b.target) || { name: 'A removed profile' }).name);
  const budgetColor = (b) => (b.scope === 'category' ? catInfo(b.target).c : b.scope === 'profile' ? pColor(b.target) : 'var(--accent)');
  const STATUS_TXT = { ok: 'On track', close: 'Getting close', fast: 'Spending fast', over: 'Over budget' };
  const statusColor = (st) => (st === 'over' ? 'var(--bad)' : st === 'fast' || st === 'close' ? 'var(--warn)' : 'var(--good)');
  // average monthly spending for a budget over the last few full months that have receipts
  function monthlyAverage(b, n = 3) {
    const now = new Date(), have = new Set(purchases.map((p) => p.date.slice(0, 7)));
    const keys = []; for (let i = 1; i <= n; i++) keys.push(iso(new Date(now.getFullYear(), now.getMonth() - i, 1)).slice(0, 7));
    const ks = keys.filter((k) => have.has(k));
    return ks.length ? ks.reduce((t, k) => t + spentFor(b, k), 0) / ks.length : 0;
  }
  function ring(frac, color, label, sub, size = 'md') {
    const r = 52, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, frac || 0));
    const el = h('div', { class: 'ring ' + size, c: color });
    el.innerHTML = `<svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="${r}" class="ring-track"/><circle cx="60" cy="60" r="${r}" class="ring-fill" stroke-dasharray="${(c * f).toFixed(1)} ${c.toFixed(1)}"/></svg>`;
    el.append(h('div', { class: 'ring-mid' }, h('b', { text: label }), sub ? h('small', { text: sub }) : null));
    return el;
  }
  function budgetBar(b, st) {
    return h('div', { class: 'bbar ' + st.status, c: budgetColor(b), role: 'img', 'aria-label': `${money(st.spent)} of ${money(b.amount)} spent` },
      h('i', { style: { width: Math.min(100, st.used * 100) + '%' } }),
      st.frac < 1 ? h('span', { class: 'pace', style: { left: st.frac * 100 + '%' }, title: "Where you'd be at an even pace" }) : null);
  }
  const allowance = (st) => (st.left > 0 && st.daysLeft ? `About ${money(st.perDay)} a day for the next ${plural(st.daysLeft, 'day')}` : st.status === 'over' ? 'Hold off on extras until the 1st to keep it small.' : 'Budgets start over on the 1st.');
  function totalBudgetCard(b) {
    const st = budgetState(b), key = thisMonth();
    return h('section', { class: 'card bud-hero' },
      ring(st.used, statusColor(st.status), pct(st.spent, b.amount) + '%', 'used', 'lg'),
      h('div', { class: 'bud-lines' },
        h('span', { class: 'bud-status ' + st.status, text: STATUS_TXT[st.status] }),
        h('p', { class: 'bud-big' }, h('b', { class: 'mono', text: money(Math.abs(st.left)) }), st.left >= 0 ? ' left' : ' over'),
        h('p', { class: 'note', text: `${money(st.spent)} of ${money(b.amount)} in ${MONTHS[+key.slice(5) - 1]}` }),
        h('p', { class: 'bud-day', text: allowance(st) }),
        h('button', { class: 'link', text: 'Change amount', onclick: () => openBudgetSheet(b) })));
  }
  function viewBudgets() {
    const total = budgets.find((b) => b.scope === 'total');
    const others = budgets.filter((b) => b.scope !== 'total' && (b.scope !== 'profile' || profileById(b.target)));
    const out = [h('div', { class: 'section-head' }, h('h2', { class: 'section-title', text: `${MONTHS[new Date().getMonth()]} budgets` }),
      h('button', { class: 'btn primary small', onclick: () => openBudgetSheet(null, total ? 'category' : 'total') }, icon('plus'), 'New'))];
    if (total) out.push(totalBudgetCard(total));
    else {
      const avg = monthlyAverage({ scope: 'total', target: '' }), sugg = avg >= 50 ? Math.max(10, Math.round((avg * 0.95) / 10) * 10) : 0;
      out.push(h('section', { class: 'card welcome' },
        h('span', { class: 'avatar xl round', c: 'var(--accent)' }, icon('target')),
        h('h2', { text: 'Set a monthly budget' }),
        h('p', { text: sugg ? `You've spent about ${money(avg)} a month lately. A budget of ${moneyWhole(sugg)}, 5% less, would save about ${moneyWhole(avg - sugg)} a month, and Tilly shows each day how much you can spend.` : 'Pick an amount for the month. Tilly shows what\'s left and how much you can spend each day to stay on track.' }),
        h('button', { class: 'btn primary', text: sugg ? `Set a ${moneyWhole(sugg)} budget` : 'Set a budget', onclick: () => openBudgetSheet(null, 'total', '', sugg || null) }),
        sugg ? h('button', { class: 'link', text: 'Choose my own amount', onclick: () => openBudgetSheet(null, 'total') }) : null));
    }
    const pro = isPro();
    const row = (b) => {
      const st = budgetState(b);
      return h('button', { class: 'bud-row' + (pro ? '' : ' off'), onclick: () => (pro ? openBudgetSheet(b) : openPaywall('budgets')) },
        b.scope === 'category' ? h('span', { class: 'cat-icon', c: catInfo(b.target).c }, icon(catInfo(b.target).icon)) : avatar(budgetName(b), budgetColor(b), 'round solid'),
        h('span', { class: 'bud-name' }, budgetName(b), h('small', { text: st.left >= 0 ? `${money(st.left)} left` : `${money(-st.left)} over` })),
        h('span', { class: 'bud-amt' }, h('b', { text: money(st.spent) }), h('small', { text: 'of ' + money(b.amount) })),
        budgetBar(b, st));
    };
    if (others.length) {
      const cats = others.filter((b) => b.scope === 'category'), people = others.filter((b) => b.scope === 'profile');
      out.push(h('section', { class: 'card' },
        h('div', { class: 'card-head' }, h('div', null, h('h2', { text: 'Categories and people' }), h('p', { class: 'note', text: pro ? 'The line on each bar shows where an even pace would put you today.' : 'These budgets are paused. They come back with Pro.' })), pro ? null : proChip()),
        cats.length ? h('div', { class: 'bud-list' }, cats.map(row)) : null,
        people.length ? h('div', { class: 'bud-list' + (cats.length ? ' sep' : '') }, people.map(row)) : null,
        h('button', { class: 'btn ghost small add-more', onclick: () => openBudgetSheet(null, 'category') }, icon('plus'), 'Add a budget')));
    } else {
      out.push(h('section', { class: 'card teaser' },
        h('div', { class: 'card-head' }, h('div', null, h('h2', { text: 'Budgets for each category and person' }), h('p', { class: 'note', text: 'Give groceries, eating out or each person their own limit, and get a heads-up before any of them goes over.' })), pro ? null : proChip()),
        h('div', { class: 'teaser-chips' }, CATS.slice(0, 5).map((c) => h('span', { class: 'tag', c: c.c, text: c.name }))),
        h('button', { class: 'btn ' + (pro ? 'primary' : 'ghost'), onclick: () => openBudgetSheet(null, 'category') }, pro ? 'Add a category budget' : 'Try it with Pro')));
    }
    return out;
  }
  // how full each live budget is, to warn when a new receipt pushes one past 80% or 100%
  function budgetLevels() { const m = {}; for (const b of budgets) if (budgetLive(b)) m[b.id] = budgetState(b).used; return m; }
  function budgetAlert(before) {
    const after = budgetLevels();
    for (const b of budgets) {
      if (!(b.id in after)) continue;
      const was = before[b.id] || 0, now = after[b.id];
      const what = b.scope === 'total' ? 'your monthly budget' : `the ${budgetName(b)} budget`;
      if (was <= 1 && now > 1) return `Heads up: you're over ${what}.`;
      if (was < 0.8 && now >= 0.8) return `Heads up: you've used ${Math.round(now * 100)}% of ${what}.`;
    }
    return null;
  }

  let bdEditing = null, bdScope = 'total', bdTarget = '';
  function drawBudgetForm() {
    const pro = isPro();
    $('bd-scope').querySelectorAll('button').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.dataset.v === bdScope));
      b.disabled = !!bdEditing && b.dataset.v !== bdScope;
      const chip = b.querySelector('.pro-chip'); if (chip) chip.remove();
      if (b.dataset.v !== 'total' && !pro) b.append(proChip('tiny'));
    });
    $('bd-target-row').hidden = bdScope === 'total';
    const taken = new Set(budgets.filter((x) => x.scope === bdScope && (!bdEditing || x.id !== bdEditing.id)).map((x) => x.target));
    if (bdScope === 'category') {
      $('bd-target-label').textContent = 'Which category?';
      $('bd-target').replaceChildren(...CATS.filter((c) => !taken.has(c.name) || c.name === bdTarget).map((c) => h('button', { type: 'button', class: 'chip', c: c.c, disabled: !!bdEditing && c.name !== bdTarget, 'aria-pressed': String(bdTarget === c.name), onclick: () => { bdTarget = c.name; drawBudgetForm(); } }, dot(c.c), c.name)));
    } else if (bdScope === 'profile') {
      $('bd-target-label').textContent = 'Whose budget?';
      $('bd-target').replaceChildren(...profiles.filter((p) => !taken.has(p.id) || p.id === bdTarget).map((p) => h('button', { type: 'button', class: 'chip', c: colorVar(p.color), disabled: !!bdEditing && p.id !== bdTarget, 'aria-pressed': String(bdTarget === p.id), onclick: () => { bdTarget = p.id; drawBudgetForm(); } }, dot(colorVar(p.color)), p.name)));
    }
    $('bd-amount-label').textContent = `Each month (${CUR[cur()].code})`;
    const ready = bdScope === 'total' || bdTarget;
    const avg = ready ? monthlyAverage({ scope: bdScope, target: bdTarget }) : 0;
    $('bd-hint').textContent = !ready ? '' : avg >= 1 ? `Lately you've spent about ${money(avg)} a month on ${bdScope === 'total' ? 'everything' : bdScope === 'category' ? bdTarget.toLowerCase() : (profileById(bdTarget) || {}).name || 'this'}.` : 'Budgets start over on the 1st of each month.';
  }
  function openBudgetSheet(b, scope = 'total', target = '', amount = null) {
    if (!b && scope !== 'total' && !requirePro('budgets')) return;
    if (!b && scope === 'total') b = budgets.find((x) => x.scope === 'total') || null;
    bdEditing = b; bdScope = b ? b.scope : scope; bdTarget = b ? b.target : target;
    $('bd-title').textContent = b ? `${budgetName(b)} budget` : 'New budget';
    $('bd-amount').value = b ? Math.round(inCur(b.amount)) : amount ? Math.round(inCur(amount)) : '';
    $('bd-err').textContent = '';
    const del = $('bd-delete'); del.hidden = !b; del.dataset.armed = ''; del.textContent = 'Delete budget';
    $('bd-save').textContent = b ? 'Save budget' : 'Create budget';
    drawBudgetForm();
    openSheet('sheet-budget');
  }
  $('bd-scope').addEventListener('click', (e) => {
    const btn = e.target.closest('button'); if (!btn || bdEditing) return;
    if (btn.dataset.v !== 'total' && !isPro()) { closeTop(); openPaywall('budgets'); return; }
    if (btn.dataset.v === 'total') { const t = budgets.find((x) => x.scope === 'total'); if (t) { openBudgetSheet(t); return; } }
    bdScope = btn.dataset.v; bdTarget = ''; drawBudgetForm();
  });
  $('bd-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const amt = Number($('bd-amount').value), err = $('bd-err');
    if (bdScope !== 'total' && !bdTarget) { err.textContent = bdScope === 'category' ? 'Pick a category.' : 'Pick a person.'; return; }
    if (!(amt > 0)) { err.textContent = 'Enter a monthly amount.'; return; }
    const same = budgets.find((x) => x.scope === bdScope && x.target === (bdScope === 'total' ? '' : bdTarget));
    $('bd-save').disabled = true;
    try {
      await db().saveBudget({ id: (bdEditing || same || {}).id, scope: bdScope, target: bdScope === 'total' ? '' : bdTarget, amount: toUsd(amt) });
      closeSheets(); toast('Budget saved'); await refresh();
    } catch { err.textContent = "Couldn't save the budget. Try again."; }
    $('bd-save').disabled = false;
  });
  $('bd-delete').addEventListener('click', async () => {
    const del = $('bd-delete'); if (!bdEditing) return;
    if (!del.dataset.armed) { del.dataset.armed = '1'; del.textContent = 'Tap again to delete this budget'; return; }
    del.disabled = true;
    try { await db().deleteBudget(bdEditing.id); closeSheets(); toast('Budget deleted'); await refresh(); }
    catch { $('bd-err').textContent = "Couldn't delete the budget. Try again."; }
    del.disabled = false;
  });

  // ---------- SAVINGS GOALS ----------
  const GOAL_COLORS = ['green', 'teal', 'blue', 'violet', 'pink', 'orange', 'gold', 'red'];
  const fmtDue = (s) => { const [y, m, d] = s.split('-').map(Number); return `${MON[m - 1]} ${d}${y !== new Date().getFullYear() ? ', ' + y : ''}`; };
  function goalPlan(g) {
    const left = Math.max(0, r2(g.target - g.saved)), done = g.saved >= g.target, today = iso(new Date());
    let perMonth = 0, late = false, months = 0;
    if (g.due && !done) {
      const d = parseIso(g.due), now = new Date();
      late = g.due < today;
      months = Math.max(1, (d.getFullYear() - now.getFullYear()) * 12 + d.getMonth() - now.getMonth() + (d.getDate() >= now.getDate() ? 0 : -1) + 1);
      perMonth = left / months;
    }
    return { left, done, perMonth, months, late, frac: g.target > 0 ? g.saved / g.target : 0 };
  }
  function goalCard(g) {
    const pl = goalPlan(g), c = colorVar(g.color);
    const note = pl.done ? 'Goal reached. Nice work!' : g.due ? (pl.late ? `Was due ${fmtDue(g.due)}. ${money(pl.left)} to go.` : `${money(pl.left)} to go. Save about ${money(pl.perMonth)} a month to make it by ${fmtDue(g.due)}.`) : `${money(pl.left)} to go.`;
    return h('section', { class: 'card goal' + (pl.done ? ' done' : ''), c },
      h('div', { class: 'goal-top' },
        ring(pl.frac, c, pl.done ? '✓' : pct(g.saved, g.target) + '%', null, 'sm'),
        h('div', { class: 'goal-info' }, h('h3', { text: g.name }), h('p', { class: 'goal-amt' }, h('b', { class: 'mono', text: money(g.saved) }), h('span', { text: ' of ' + money(g.target) })), h('p', { class: 'note', text: note }))),
      h('div', { class: 'goal-actions' },
        h('button', { class: 'btn primary small', onclick: () => openMoneySheet(g, 'add') }, icon('plus'), 'Add money'),
        g.saved > 0 ? h('button', { class: 'btn ghost small', text: 'Take out', onclick: () => openMoneySheet(g, 'take') }) : null,
        h('button', { class: 'btn ghost small', text: 'Edit', onclick: () => openGoalSheet(g) })));
  }
  function viewGoals() {
    const out = [h('div', { class: 'section-head' }, h('h2', { class: 'section-title', text: 'Savings goals' }),
      h('button', { class: 'btn primary small', onclick: () => openGoalSheet(null) }, icon('plus'), 'New'))];
    if (!goals.length) {
      out.push(h('section', { class: 'card welcome' },
        h('span', { class: 'avatar xl round', c: 'var(--good)' }, icon('piggy')),
        h('h2', { text: 'Save for something' }),
        h('p', { text: 'A trip, a new phone, a rainy-day fund. Set a goal and a date, and Tilly tells you how much to put away each month.' }),
        h('button', { class: 'btn primary', text: 'Create a goal', onclick: () => openGoalSheet(null) })));
      return out;
    }
    out.push(...goals.map(goalCard));
    const open = goals.find((g) => g.saved < g.target), tips = visibleTips(), extra = tips.reduce((t, x) => t + (x.save || 0), 0);
    if (open && extra >= 5) {
      const pl = goalPlan(open), planned = pl.late ? 0 : pl.perMonth || 0, months = Math.max(1, Math.ceil(pl.left / (extra + planned)));
      const how = planned > 0 && pl.months > months
        ? `Adding it to the ${moneyWhole(planned)} a month you need for ${open.name} would get you there in about ${plural(months, 'month')} instead of ${pl.months}.`
        : `Putting it toward ${open.name} each month would get you there in about ${plural(months, 'month')}.`;
      out.push(h('section', { class: 'card save-link' },
        h('span', { class: 'hl-ic', c: 'var(--good)' }, icon('piggy')),
        h('div', null, h('strong', { text: `Put your savings toward ${open.name}` }),
          h('p', { class: 'note', text: `Tilly found about ${moneyWhole(extra)} a month you could save. ${how}` }),
          h('button', { class: 'link', text: 'See ways to save', onclick: () => setTab('insights') }))));
    }
    if (!isPro() && goals.length >= FREE_GOALS) out.push(h('p', { class: 'fine', text: 'Free accounts have 1 goal. Pro has no limit.' }));
    return out;
  }
  let goalEditing = null, goalColor = 'green';
  $('goal-colors').append(...GOAL_COLORS.map((c) => h('button', { type: 'button', class: 'swatch', role: 'radio', c: colorVar(c), 'data-color': c, 'aria-label': c, onclick: () => { goalColor = c; drawGoalForm(); } })));
  function drawGoalForm() {
    $('goal-colors').querySelectorAll('.swatch').forEach((s) => s.setAttribute('aria-checked', String(s.dataset.color === goalColor)));
    const code = CUR[cur()].code;
    $('goal-target-label').textContent = `Goal amount (${code})`; $('goal-saved-label').textContent = `Saved so far (${code})`;
    const t = Number($('goal-target').value), sv = Number($('goal-saved').value) || 0, due = $('goal-due').value;
    let note = '';
    if (t > sv && /^\d{4}-\d{2}-\d{2}$/.test(due) && due > iso(new Date())) {
      const pl = goalPlan({ target: t, saved: sv, due });
      note = `That's about ${fmtCur(pl.perMonth)} a month.`;
    }
    $('goal-note').textContent = note;
  }
  function openGoalSheet(g) {
    if (!g && !isPro() && goals.length >= FREE_GOALS) { openPaywall('goals'); return; }
    goalEditing = g;
    $('goal-title').textContent = g ? 'Edit goal' : 'New goal';
    $('goal-save').textContent = g ? 'Save goal' : 'Create goal';
    $('goal-name').value = g ? g.name : '';
    $('goal-target').value = g ? Math.round(inCur(g.target)) : '';
    $('goal-saved').value = g ? inCur(g.saved) : '';
    $('goal-due').value = g && g.due ? g.due : '';
    goalColor = g ? g.color : GOAL_COLORS.find((c) => !goals.some((x) => x.color === c)) || 'green';
    $('goal-err').textContent = '';
    const del = $('goal-delete'); del.hidden = !g; del.dataset.armed = ''; del.textContent = 'Delete goal';
    $('goal-suggest').replaceChildren(...(g ? [] : ['Emergency fund', 'Vacation', 'New phone', 'Holiday gifts', 'Car'].filter((n) => !goals.some((x) => x.name.toLowerCase() === n.toLowerCase())).map((n) => h('button', { type: 'button', text: n, onclick: () => { $('goal-name').value = n; $('goal-target').focus(); } }))));
    drawGoalForm();
    openSheet('sheet-goal');
    if (!g) $('goal-name').focus();
  }
  ['goal-target', 'goal-saved', 'goal-due'].forEach((id) => $(id).addEventListener('input', drawGoalForm));
  $('goal-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('goal-name').value.trim(), t = Number($('goal-target').value), sv = Number($('goal-saved').value) || 0, due = $('goal-due').value, err = $('goal-err');
    if (!name) { err.textContent = 'Give the goal a name.'; return; }
    if (!(t > 0)) { err.textContent = 'Enter how much you want to save.'; return; }
    if (sv < 0) { err.textContent = "Saved so far can't be negative."; return; }
    const row = { name, target: toUsd(t), saved: toUsd(sv), due: /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null, color: goalColor };
    $('goal-save').disabled = true;
    try {
      if (goalEditing) await db().updateGoal(goalEditing.id, row); else await db().addGoal(row);
      closeSheets(); toast(goalEditing ? 'Goal saved' : `${name} goal created`); await refresh();
    } catch { err.textContent = "Couldn't save the goal. Try again."; }
    $('goal-save').disabled = false;
  });
  $('goal-delete').addEventListener('click', async () => {
    const del = $('goal-delete'); if (!goalEditing) return;
    if (!del.dataset.armed) { del.dataset.armed = '1'; del.textContent = `Tap again to delete ${goalEditing.name}`; return; }
    del.disabled = true;
    try { await db().deleteGoal(goalEditing.id); closeSheets(); toast('Goal deleted'); await refresh(); }
    catch { $('goal-err').textContent = "Couldn't delete the goal. Try again."; }
    del.disabled = false;
  });
  let moneyGoal = null, moneyDir = 'add';
  function drawMoneyForm() {
    const g = moneyGoal; if (!g) return;
    $('money-dir').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === moneyDir)));
    $('money-title').textContent = moneyDir === 'add' ? `Add to ${g.name}` : `Take out of ${g.name}`;
    $('money-amount-label').textContent = `Amount (${CUR[cur()].code})`;
    const v = Number($('money-amount').value) || 0, next = Math.max(0, inCur(g.saved) + (moneyDir === 'add' ? v : -v));
    $('money-note').textContent = v > 0 ? `${fmtCur(next)} of ${fmtCur(inCur(g.target))} afterwards.` : `${fmtCur(inCur(g.saved))} saved so far.`;
    $('money-save').textContent = moneyDir === 'add' ? 'Add money' : 'Take it out';
  }
  function openMoneySheet(g, dir) {
    moneyGoal = g; moneyDir = dir;
    $('money-amount').value = ''; $('money-err').textContent = '';
    const steps = CUR[cur()].dp === 0 ? [1000, 2500, 5000, 10000] : [10, 25, 50, 100];
    $('money-quick').replaceChildren(...steps.map((n) => h('button', { type: 'button', text: cur() + n.toLocaleString('en-US'), onclick: () => { $('money-amount').value = n; drawMoneyForm(); } })));
    drawMoneyForm();
    openSheet('sheet-money');
    $('money-amount').focus();
  }
  $('money-dir').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) { moneyDir = b.dataset.v; drawMoneyForm(); } });
  $('money-amount').addEventListener('input', drawMoneyForm);
  $('money-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const g = moneyGoal, v = Number($('money-amount').value);
    if (!g) return;
    if (!(v > 0)) { $('money-err').textContent = 'Enter an amount.'; return; }
    const saved = Math.max(0, r2(g.saved + (moneyDir === 'add' ? toUsd(v) : -toUsd(v))));
    $('money-save').disabled = true;
    try {
      await db().updateGoal(g.id, { saved });
      closeSheets();
      toast(saved >= g.target && g.saved < g.target ? `You reached ${g.name}!` : moneyDir === 'add' ? `Added to ${g.name}` : `Taken out of ${g.name}`);
      await refresh();
    } catch { $('money-err').textContent = "Couldn't save it. Try again."; }
    $('money-save').disabled = false;
  });

  // ---------- WAYS TO SAVE ----------
  // Looks through recent receipts for habits worth changing. Each estimate is a monthly amount
  // in dollars worked out only from the user's own data. Tips without a clear number get none.
  function priceBook(since) {
    const m = new Map();
    for (const p of purchases) {
      if (p.date < since || isSubCharge(p) || !(p.price > 0) || !p.store || FEE_RE.test(p.item) || !PRICE_CATS.has(catInfo(p.category).name)) continue;
      const k = itemKey(p.item); if (k.length < 3) continue;
      const u = unitOf(p.item); if (!(u.qty > 0)) continue;
      const key = k + '|' + u.unit;
      if (!m.has(key)) m.set(key, { key, name: itemName(p.item), unit: u.unit, rows: [] });
      m.get(key).rows.push({ date: p.date, store: p.store, unitPrice: p.price / u.qty, qty: u.qty, price: p.price, item: p.item });
    }
    for (const o of m.values()) o.rows.sort((a, b) => a.date.localeCompare(b.date));
    return m;
  }
  const tipsKey = () => 'tilly-hidden-tips-' + (userId() || mode);
  const hiddenTips = () => new Set(readJSON(tipsKey(), []));
  function hideTip(id) { const s = hiddenTips(); s.add(id); writeJSON(tipsKey(), [...s]); toast('Tip hidden'); render(); }
  function savingsTips() {
    const today = iso(new Date()), now = new Date(), key = thisMonth();
    const since90 = addDays(today, -89), since180 = addDays(today, -179);
    const recent = purchases.filter((p) => p.date >= since90 && p.date <= today);
    if (!recent.length) return [];
    const first = recent.reduce((m, p) => (p.date < m ? p.date : m), today);
    const span = Math.max(30, Math.round((parseIso(today) - parseIso(first)) / 864e5) + 1);
    const monthly = (v) => (v * 30.4) / span;
    const spanTxt = span >= 85 ? 'the last 3 months' : `the last ${plural(span, 'day')}`;
    const tips = [], add = (t) => tips.push({ save: 0, pro: false, ...t });
    const live = subscriptions.filter((s) => s.active && profileById(s.profile_id));

    // 1. fees and bags
    const fees = recent.filter((p) => p.price > 0 && FEE_RE.test(p.item) && !isSubCharge(p)), feeSum = sum(fees, 'price');
    if (feeSum >= 1) add({ id: 'fees', icon: 'tag', c: 'var(--c-misc)', title: 'Skip the fees', save: monthly(feeSum),
      body: `You paid ${money(feeSum)} in bag, delivery and service fees over ${spanTxt} (${plural(fees.length, 'charge')}). Bringing your own bags and picking orders up yourself avoids most of them.` });

    // 2. subscriptions
    if (live.length) {
      const mo = live.reduce((t, s) => t + perMonth(s), 0), small = live.slice().sort((a, b) => perMonth(a) - perMonth(b))[0];
      add({ id: 'subs-review', icon: 'repeat', c: 'var(--c-bills)', save: perMonth(small),
        title: live.length > 1 ? `Check your ${live.length} subscriptions` : `Check ${live[0].name}`,
        body: live.length > 1
          ? `Together they cost ${money(mo)} a month, or ${money(mo * 12)} a year. Cancel any you haven't used in the past month. Even the smallest, ${small.name}, is ${money(perMonth(small))} a month.`
          : `It costs ${money(mo)} a month, or ${money(mo * 12)} a year. If you don't use it every week, pausing it saves that much.`,
        action: ['Review subscriptions', () => { planSeg = 'subs'; setTab('plan'); }] });
      const monthlySubs = live.filter((s) => s.cadence === 'monthly' && s.amount >= 4);
      if (monthlySubs.length) {
        const m = monthlySubs.reduce((t, s) => t + s.amount, 0);
        add({ id: 'subs-yearly', icon: 'calendar', c: 'var(--c-bills)', title: 'Pay yearly where you can', save: (m * 2) / 12,
          body: `Many services charge about two months less when you pay for a year up front. If ${listNames(monthlySubs.map((s) => s.name))} ${monthlySubs.length === 1 ? 'offers' : 'offer'} a yearly plan, switching saves around ${money(m * 2)} a year.` });
      }
    }

    // 3. categories running higher than usual (month so far vs. the same days in recent months)
    const dayN = now.getDate(), early = dayN < 10;
    const cmpKey = early ? iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)).slice(0, 7) : key;
    const upTo = early ? 31 : dayN;
    const haveMonths = new Set(purchases.map((p) => p.date.slice(0, 7)));
    const base = [1, 2, 3].map((i) => iso(new Date(+cmpKey.slice(0, 4), +cmpKey.slice(5, 7) - 1 - i, 1)).slice(0, 7)).filter((k) => haveMonths.has(k));
    if (base.length >= 2) {
      const highs = [];
      for (const c of CATS) {
        if (c.name === 'Home & repairs' || c.name === 'Bills') continue; // one-off and fixed costs aren't habits
        const its = (k) => purchases.filter((p) => p.date.slice(0, 7) === k && +p.date.slice(8, 10) <= upTo && catInfo(p.category).name === c.name && !isSubCharge(p));
        const usual = base.reduce((t, k) => t + sum(its(k), 'price'), 0) / base.length;
        const cur_ = its(cmpKey), got = sum(cur_, 'price'), biggest = cur_.reduce((m, p) => Math.max(m, p.price), 0);
        if (usual >= 10 && got > usual * 1.25 && got - usual >= 15 && biggest < got * 0.6) highs.push({ c, usual, got });
      }
      highs.sort((a, b) => (b.got - b.usual) - (a.got - a.usual));
      for (const x of highs.slice(0, 2)) {
        const have = budgets.find((b) => b.scope === 'category' && b.target === x.c.name);
        add({ id: `high-${x.c.name}-${cmpKey}`, icon: x.c.icon, c: x.c.c, title: `${x.c.name} is running high`, save: x.got - x.usual,
          body: early
            ? `You spent ${money(x.got)} on ${x.c.name.toLowerCase()} last month, against your usual ${money(x.usual)}. Getting back to normal saves about ${money(x.got - x.usual)} a month.`
            : `So far this month you've spent ${money(x.got)} on ${x.c.name.toLowerCase()}, against about ${money(x.usual)} by this point in a usual month.`,
          action: have ? ['See budget', () => { planSeg = 'budgets'; setTab('plan'); }] : ['Set a budget', () => openBudgetSheet(null, 'category', x.c.name, Math.round(x.usual / 5) * 5 || null)] });
      }
    }

    // 4. eating out
    const visits = new Map();
    for (const p of recent) if (catInfo(p.category).name === 'Food & dining' && !isSubCharge(p) && p.price > 0) { const k = p.date + '|' + (p.store || ''); visits.set(k, (visits.get(k) || 0) + p.price); }
    const vAvg = visits.size ? [...visits.values()].reduce((a, b) => a + b, 0) / visits.size : 0, perMo = monthly(visits.size);
    if (perMo >= 2.5 && vAvg >= 5) add({ id: 'dining', icon: 'fork', c: 'var(--c-dining)', title: 'Eat out a little less', save: 2 * vAvg,
      body: `You eat or drink out about ${Math.round(perMo)} times a month, at around ${money(vAvg)} a visit. Skipping two of those a month saves about ${money(2 * vAvg)}.` });

    // 5. no budget yet
    if (!budgets.some((b) => b.scope === 'total')) {
      const avg = monthlyAverage({ scope: 'total', target: '' });
      if (avg >= 50) {
        const sugg = Math.max(10, Math.round((avg * 0.95) / 10) * 10);
        add({ id: 'budget', icon: 'target', c: 'var(--accent)', title: 'Give yourself a budget', save: avg - sugg,
          body: `You've spent about ${money(avg)} a month lately. A budget of ${moneyWhole(sugg)}, 5% less, shows you each day how much you can spend and stay on track.`,
          action: ['Set budget', () => openBudgetSheet(null, 'total', '', sugg)] });
      }
    }

    // 6. on pace to go over the budget
    const tb = budgets.find((b) => b.scope === 'total');
    if (tb) {
      const st = budgetState(tb), proj = st.spent / Math.max(st.frac, 1 / 31);
      if (st.status === 'over' || (dayN >= 5 && st.frac < 1 && proj > tb.amount * 1.05)) add({ id: `pace-${key}`, icon: 'alert', c: 'var(--bad)',
        title: st.status === 'over' ? "You're over budget this month" : "You're on pace to go over budget",
        body: st.status === 'over' ? `You've spent ${money(st.spent)} against a ${money(tb.amount)} budget. Holding off on extras until the 1st keeps the overage small.`
          : `At this pace you'll spend about ${money(proj)} this month, ${money(proj - tb.amount)} over budget. Keeping to ${money(st.perDay)} a day gets you back on track.`,
        action: ['See budget', () => { planSeg = 'budgets'; setTab('plan'); }] });
    }

    // 7. lots of quick grocery runs
    const trips = new Map();
    for (const p of purchases) if (p.date >= addDays(today, -29) && p.date <= today && catInfo(p.category).name === 'Groceries' && !isSubCharge(p)) { const k = p.date + '|' + p.store; trips.set(k, (trips.get(k) || 0) + p.price); }
    const small = [...trips.values()].filter((v) => v < 15);
    if (small.length >= 4) add({ id: `trips-${key}`, icon: 'cart', c: 'var(--c-groceries)', title: 'Fewer quick grocery runs',
      body: `You made ${small.length} grocery stops under ${money(15)} in the last 30 days, ${money(small.reduce((a, b) => a + b, 0))} in all. One planned shop a week, with a list, means fewer extra stops and fewer extras in the cart.` });

    // ---- Pro: the same item for less at another store ----
    const book = priceBook(since180), swaps = [];
    for (const it of book.values()) {
      const stores = groupBy(it.rows, 'store');
      if (stores.size < 2) continue;
      const meds = [...stores].map(([store, rows]) => ({ store, med: median(rows.slice(-5).map((r) => r.unitPrice)), qty: rows.filter((r) => r.date >= since90).reduce((t, r) => t + r.qty, 0) }));
      const cheap = meds.reduce((a, b) => (b.med < a.med ? b : a));
      let save = 0, worst = null;
      for (const m of meds) if (m !== cheap && m.med > cheap.med * 1.08 && m.med - cheap.med >= 0.1) { save += (m.med - cheap.med) * monthly(m.qty); if (!worst || m.med > worst.med) worst = m; }
      if (worst && save >= 0.25) swaps.push({ ...it, cheap, worst, save });
    }
    swaps.sort((a, b) => b.save - a.save);
    if (swaps.length) {
      const top = swaps.slice(0, 3);
      add({ id: 'swap-' + top.map((x) => x.key).join('+'), pro: true, icon: 'store', c: 'var(--good)', save: top.reduce((t, x) => t + x.save, 0),
        title: top.length > 1 ? 'Buy these where they cost less' : `Buy ${top[0].name.toLowerCase()} at ${top[0].cheap.store}`,
        body: 'You buy these at more than one store, and one store is cheaper:',
        list: top.map((x) => `${x.name}: ${unitMoney(x.cheap.med, x.unit)} at ${x.cheap.store}, ${unitMoney(x.worst.med, x.unit)} at ${x.worst.store}`),
        foot: 'Sizes and brands can differ, so check the label.',
        action: ['Open price tracker', () => openPriceList()] });
    }
    // ---- Pro: prices that went up ----
    const rises = [];
    for (const it of book.values()) for (const [store, rows] of groupBy(it.rows, 'store')) {
      if (rows.length < 2) continue;
      const a = rows[0], b = rows[rows.length - 1];
      if (b.date > a.date && b.unitPrice > a.unitPrice * 1.08 && b.unitPrice - a.unitPrice >= 0.1) rises.push({ ...it, store, from: a.unitPrice, to: b.unitPrice, since: a.date, up: b.unitPrice / a.unitPrice - 1 });
    }
    rises.sort((x, y) => y.up - x.up);
    if (rises.length) add({ id: `rises-${key}`, pro: true, icon: 'trend', c: 'var(--bad)', title: rises.length > 1 ? 'Prices that went up' : `${rises[0].name} went up`,
      body: 'These now cost more than when you first bought them here. Worth checking another store or brand:',
      list: rises.slice(0, 3).map((x) => `${x.name} at ${x.store}: ${unitMoney(x.from, x.unit)} to ${unitMoney(x.to, x.unit)}, up ${Math.round(x.up * 100)}% since ${fmtDate(x.since)}`) });
    // ---- Pro: unplanned buys ----
    const wants = purchases.filter((p) => p.date >= addDays(today, -29) && p.date <= today && ['Shopping', 'Miscellaneous'].includes(catInfo(p.category).name) && p.price >= 20 && !isSubCharge(p));
    if (wants.length >= 2) add({ id: `wants-${key}`, pro: true, icon: 'bag', c: 'var(--c-shopping)', title: 'Try a 48-hour pause',
      body: `You bought ${wants.length} non-essentials over ${money(20)} in the last 30 days, ${money(sum(wants, 'price'))} in all. Waiting two days before buying things you didn't plan on makes it easier to skip the ones you don't really need.` });

    return tips.sort((a, b) => (b.save || 0) - (a.save || 0));
  }
  // tips the user can see: not hidden, and Pro tips only with Pro
  const visibleTips = () => { const hid = hiddenTips(), pro = isPro(); return savingsTips().filter((t) => !hid.has(t.id) && (pro || !t.pro)); };
  function tipEl(t, locked) {
    return h('li', { class: 'tip' + (locked ? ' locked' : ''), c: t.c },
      h('span', { class: 'hl-ic' }, icon(t.icon)),
      h('div', { class: 'tip-main' },
        h('div', { class: 'tip-top' }, h('strong', { text: t.title }), t.save >= 1 ? h('span', { class: 'tip-save', text: `~${moneyWhole(t.save)}/mo` }) : null),
        h('p', { text: t.body }),
        t.list ? h('ul', { class: 'tip-list' }, t.list.map((x) => h('li', { text: x }))) : null,
        t.foot ? h('p', { class: 'tip-foot', text: t.foot }) : null,
        locked ? null : h('div', { class: 'tip-actions' },
          t.action ? h('button', { class: 'link', text: t.action[0], onclick: t.action[1] }) : null,
          h('button', { class: 'link muted', text: 'Hide', 'aria-label': `Hide the tip "${t.title}"`, onclick: () => hideTip(t.id) }))));
  }
  function savingsCard() {
    const all = savingsTips(), hid = hiddenTips(), pro = isPro();
    const shown = all.filter((t) => !hid.has(t.id) && (pro || !t.pro));
    const locked = pro ? [] : all.filter((t) => t.pro && !hid.has(t.id));
    const hiddenN = all.filter((t) => hid.has(t.id)).length;
    const total = shown.reduce((t, x) => t + (x.save || 0), 0), lockedTotal = locked.reduce((t, x) => t + (x.save || 0), 0);
    const el = h('section', { class: 'card save-card' },
      h('div', { class: 'save-hero' },
        h('span', { class: 'save-kicker' }, icon('piggy'), 'Ways to save'),
        total >= 1 ? h('p', { class: 'save-num' }, 'About ', h('b', { class: 'mono', text: moneyWhole(total) }), ' a month') : h('p', { class: 'save-num small', text: shown.length ? 'Habits worth a look' : 'Nothing to cut right now' }),
        h('p', { class: 'note', text: total >= 1 ? `That's about ${moneyWhole(total * 12)} a year, based on your receipts from the last 3 months. Estimates, not promises.` : shown.length ? 'Based on your receipts from the last 3 months.' : 'Tilly checks your last 3 months of receipts for fees, pricey stores and categories running high. Keep adding receipts and tips will show up here.' })));
    if (shown.length) el.append(h('ul', { class: 'tips' }, shown.map((t) => tipEl(t))));
    if (locked.length) el.append(h('div', { class: 'tip-lock' },
      h('span', { class: 'lock-ic' }, icon('lock')),
      h('div', null, h('strong', { text: `Pro found ${plural(locked.length, 'more way')} to save` }), h('span', { text: lockedTotal >= 1 ? `About ${moneyWhole(lockedTotal)} a month more, from things like cheaper stores for what you buy often.` : 'Like price rises on things you buy often.' })),
      h('button', { class: 'btn primary small', text: 'Unlock', onclick: () => openPaywall('save') })));
    if (hiddenN) el.append(showHiddenTips
      ? h('div', null, h('ul', { class: 'tips hidden-tips' }, all.filter((t) => hid.has(t.id)).map((t) => h('li', { class: 'tip muted' }, h('span', { class: 'hl-ic', c: t.c }, icon(t.icon)), h('div', { class: 'tip-main' }, h('strong', { text: t.title }), h('div', { class: 'tip-actions' }, h('button', { class: 'link', text: 'Show again', onclick: () => { const s = hiddenTips(); s.delete(t.id); writeJSON(tipsKey(), [...s]); render(); } })))))),
        h('button', { class: 'link muted', text: 'Done', onclick: () => { showHiddenTips = false; render(); } }))
      : h('button', { class: 'link muted', text: `${plural(hiddenN, 'hidden tip')}`, onclick: () => { showHiddenTips = true; render(); } }));
    return el;
  }
  // ---------- PRICE TRACKER (Pro) ----------
  let priceQuery = '', priceAll = false;
  function priceItems() {
    return [...priceBook(addDays(iso(new Date()), -364)).values()].filter((o) => o.rows.length >= 2)
      .sort((a, b) => b.rows.length - a.rows.length || b.rows[b.rows.length - 1].date.localeCompare(a.rows[a.rows.length - 1].date));
  }
  function priceRow(o, pro) {
    const last = o.rows[o.rows.length - 1], low = o.rows.reduce((a, b) => (b.unitPrice < a.unitPrice ? b : a));
    // change since the last time at the same store, so different stores aren't mixed up
    const same = o.rows.filter((r) => r.store === last.store), prev = same.length >= 2 ? same[same.length - 2] : null, d = prev ? last.unitPrice - prev.unitPrice : 0;
    return h('button', { class: 'price-row', onclick: () => (pro ? openItem(o) : openPaywall('prices')) },
      h('span', { class: 'pr-name' }, o.name, h('small', { text: low === last || low.unitPrice === last.unitPrice ? `Last at ${last.store}, the lowest you've paid` : `Last at ${last.store} · lowest ${unitMoney(low.unitPrice, o.unit)} at ${low.store}` })),
      h('span', { class: 'pr-price' }, h('b', { class: 'mono', text: unitMoney(last.unitPrice, o.unit) }),
        Math.abs(d) >= 0.01 ? h('small', { class: 'chg ' + (d > 0 ? 'up' : 'down') }, icon(d > 0 ? 'up' : 'down'), money(Math.abs(d))) : h('small', { text: `Bought ${o.rows.length} times` })));
  }
  function priceTrackerCard() {
    const items = priceItems();
    if (!items.length) return null;
    const pro = isPro();
    const head = h('div', { class: 'card-head' }, h('div', null, h('h2', { text: 'Price tracker' }), h('p', { class: 'note', text: `${plural(items.length, 'item')} you've bought more than once in the last year. Prices are per item, or per pound when the receipt shows a weight.` })), pro ? null : proChip());
    if (!pro) return h('section', { class: 'card' }, head,
      h('div', { class: 'price-list locked', 'aria-hidden': 'true' }, items.slice(0, 3).map((o) => priceRow(o, false))),
      h('div', { class: 'lock-over' }, h('p', { text: 'See every price you paid, where each item is cheapest, and what went up.' }), h('button', { class: 'btn primary small', onclick: () => openPaywall('prices') }, icon('lock'), 'Unlock the price tracker')));
    const box = h('div', { class: 'price-list', id: 'price-list' });
    const draw = () => {
      const q = priceQuery.toLowerCase(), list = items.filter((o) => !q || o.name.toLowerCase().includes(q));
      box.replaceChildren(...(list.length ? list.slice(0, priceAll || q ? 60 : 6).map((o) => priceRow(o, true)) : [h('p', { class: 'empty', text: 'No items match.' })]));
      more.hidden = priceAll || !!q || list.length <= 6;
    };
    const search = h('input', { class: 'input search', type: 'search', placeholder: 'Search items', 'aria-label': 'Search the price tracker', value: priceQuery });
    search.addEventListener('input', () => { priceQuery = search.value.trim(); draw(); });
    const more = h('button', { class: 'link', text: `Show all ${items.length}`, onclick: () => { priceAll = true; draw(); } });
    draw();
    return h('section', { class: 'card', id: 'price-card' }, head, items.length > 6 ? h('div', { class: 'tools', style: { marginBottom: '8px' } }, search) : null, box, more);
  }
  function openPriceList() {
    if (!requirePro('prices')) return;
    priceAll = true; setTab('insights');
    requestAnimationFrame(() => { const c = $('price-card'); if (c) c.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' }); });
  }
  function openItem(o) {
    const stores = [...groupBy(o.rows, 'store')].map(([store, rows]) => ({ store, n: rows.length, med: median(rows.map((r) => r.unitPrice)), last: rows[rows.length - 1] })).sort((a, b) => a.med - b.med);
    const max = Math.max(...o.rows.map((r) => r.unitPrice)), body = $('item-body');
    $('item-title').textContent = o.name;
    body.replaceChildren(
      h('p', { class: 'note', text: o.unit === 'lb' ? 'Prices per pound, worked out from the weight on each receipt.' : 'Prices per item, worked out from the quantity on each receipt.' }),
      h('div', { class: 'item-stores' }, stores.map((s, i) => h('div', { class: 'item-store' + (i === 0 && stores.length > 1 ? ' best' : '') },
        h('span', null, h('b', { text: s.store }), h('small', { text: `${plural(s.n, 'purchase')} · last ${fmtDate(s.last.date)}` })),
        h('span', { class: 'mono', text: unitMoney(s.med, o.unit) }),
        i === 0 && stores.length > 1 ? h('em', { text: 'Cheapest' }) : null))),
      h('h3', { class: 'item-h', text: 'Every purchase' }),
      h('div', { class: 'item-hist' }, o.rows.slice().reverse().map((r) => h('div', { class: 'ih-row' },
        h('span', { class: 'ih-d', text: fmtDate(r.date) }),
        h('span', { class: 'ih-s' }, r.store, h('small', { text: r.item })),
        h('span', { class: 'ih-bar' }, h('i', { style: { width: Math.max(4, (r.unitPrice / max) * 100) + '%' } })),
        h('span', { class: 'mono ih-p', text: unitMoney(r.unitPrice, o.unit) })))));
    openSheet('sheet-item');
  }

  // ---------- MONTHLY REPORT (Pro) ----------
  function printReport() {
    if (!requirePro('report')) return;
    if (NATIVE) { toast('Open Tilly on the web to save a report as a PDF.'); return; }
    const key = month && month !== 'all' ? month : thisMonth();
    const ps = purchases.filter((p) => p.date.slice(0, 7) === key), ts = taxes.filter((t) => t.date.slice(0, 7) === key);
    const items = sum(ps, 'price'), tax = sum(ts, 'tax');
    const table = (head, rows) => h('table', null, h('thead', null, h('tr', null, head.map((x, i) => h('th', { class: i ? 'n' : '', text: x })))), h('tbody', null, rows.map((r) => h('tr', null, r.map((x, i) => h('td', { class: i ? 'n' : '', text: x }))))));
    const byP = profiles.map((p) => { const i = sum(ps.filter((x) => x.profile_id === p.id), 'price'), t = sum(ts.filter((x) => x.profile_id === p.id), 'tax'); return [p.name, money(i), money(t), money(r2(i + t))]; }).filter((r) => r[3] !== money(0));
    const byC = CATS.map((c) => ({ c, t: sum(ps.filter((p) => catInfo(p.category).name === c.name), 'price') })).filter((x) => x.t !== 0).sort((a, b) => b.t - a.t).map((x) => [x.c.name, money(x.t), pct(x.t, items) + '%']);
    const st = new Map(); for (const p of ps) st.set(p.store || 'No store', (st.get(p.store || 'No store') || 0) + p.price);
    const byS = [...st].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => [k, money(v)]);
    const sections = [
      h('header', null, h('div', { class: 'rp-brand', text: 'Tilly' }), h('h1', { text: `${fmtMonth(key)} spending report` }), h('p', { text: `Made ${fmtDay(new Date())} · amounts in ${CUR[cur()].code}` })),
      h('div', { class: 'rp-kpis' }, [['Total with tax', money(r2(items + tax))], ['Items', money(items)], ['Tax', money(tax)], ['Receipts', String(buildSlips(ps, ts).length)]].map(([a, b]) => h('div', null, h('small', { text: a }), h('b', { text: b })))),
      h('h2', { text: 'By person' }), table(['Profile', 'Items', 'Tax', 'Total'], byP),
      h('h2', { text: 'By category' }), table(['Category', 'Spent', 'Share'], byC),
      h('h2', { text: 'Top stores' }), table(['Store', 'Spent'], byS),
    ];
    if (key === thisMonth()) {
      const live = budgets.filter(budgetLive);
      if (live.length) sections.push(h('h2', { text: 'Budgets' }), table(['Budget', 'Spent', 'Budget', 'Left'], live.map((b) => { const s = budgetState(b); return [budgetName(b), money(s.spent), money(b.amount), money(s.left)]; })));
      const tips = visibleTips().slice(0, 5);
      if (tips.length) sections.push(h('h2', { text: 'Ways to save' }), h('ul', null, tips.map((t) => h('li', null, h('b', { text: t.title }), t.save >= 1 ? ` (about ${moneyWhole(t.save)} a month). ` : '. ', t.body, t.list ? ' ' + t.list.join('; ') + '.' : ''))));
    }
    if (subscriptions.some((s) => s.active)) sections.push(h('h2', { text: 'Subscriptions' }), table(['Name', 'Price', 'Every'], subscriptions.filter((s) => s.active).map((s) => [s.name, money(s.amount), s.cadence.replace('ly', '').replace('dai', 'day')])));
    sections.push(h('footer', { text: 'Made with Tilly. Totals come from the receipts you added and may not include everything you spent.' }));
    $('report').replaceChildren(...sections);
    setTimeout(() => window.print(), 50);
  }

  // ---------- PLAN (budgets, goals, subscriptions) ----------
  function viewPlan() {
    const seg = h('div', { class: 'seg wide three plan-seg', role: 'tablist', 'aria-label': 'Plan' },
      [['budgets', 'Budgets'], ['goals', 'Goals'], ['subs', 'Subscriptions']].map(([k, t]) => h('button', { role: 'tab', 'aria-selected': String(planSeg === k), text: t, onclick: () => { planSeg = k; render(); } })));
    return [h('div', { class: 'section-head' }, h('h2', { class: 'section-title', text: 'Plan' })), seg, ...(planSeg === 'goals' ? viewGoals() : planSeg === 'subs' ? viewSubs() : viewBudgets())];
  }

  // ---------- SETTINGS ----------
  async function callAccount(action, extra, withAuth) {
    const headers = { 'content-type': 'application/json' };
    if (withAuth) headers.authorization = 'Bearer ' + session.access_token;
    const res = await fetch(ACCOUNT_FN, { method: 'POST', headers, body: JSON.stringify({ action, ...extra }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw { code: d.error || 'server_error' };
    return d;
  }
  const setPref = (k, v) => { prefs[k] = v; ls.set('tilly-' + k, v); };
  const setRow = (label, sub, control) => h('div', { class: 'set-row' }, h('div', { class: 'set-label' }, label, sub ? h('small', { text: sub }) : null), control);
  const segPick = (label, options, value, onPick) => h('div', { class: 'seg', role: 'group', 'aria-label': label }, options.map(([k, text]) => h('button', { 'aria-pressed': String(value === k), text, onclick: () => onPick(k) })));
  // a button that needs a second tap before it does something that can't be undone
  function armButton(cls, label, armedLabel, fn) {
    const b = h('button', { class: cls, text: label });
    b.addEventListener('click', async () => {
      if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = armedLabel; setTimeout(() => { if (b.isConnected && !b.disabled) { b.dataset.armed = ''; b.textContent = label; } }, 5000); return; }
      b.disabled = true;
      try { await fn(); } catch { toast("That didn't work. Check your connection and try again."); }
      if (b.isConnected) { b.disabled = false; b.dataset.armed = ''; b.textContent = label; }
    });
    return b;
  }
  function exportCsv() {
    const safe = (v) => { const t = String(v == null ? '' : v); return /^[=+\-@]/.test(t) ? "'" + t : t; };
    const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const name = (id) => (profileById(id) || {}).name || '';
    const conv = cur() !== '$', dp = CUR[cur()].dp, code = CUR[cur()].code;
    const amt = (v) => conv ? [v.toFixed(2), (v * rate()).toFixed(dp)] : [v.toFixed(2)];
    const rows = [['Date', 'Profile', 'Store', 'Item', 'Category', 'Amount (USD)', ...(conv ? [`Amount (${code})`] : [])]];
    for (const p of purchases.slice().sort((x, y) => x.date.localeCompare(y.date))) rows.push([p.date, safe(name(p.profile_id)), safe(p.store), safe(p.item), catInfo(p.category).name, ...amt(p.price)]);
    for (const t of taxes.slice().sort((x, y) => x.date.localeCompare(y.date))) rows.push([t.date, safe(name(t.profile_id)), safe(t.store), 'Sales tax', 'Tax', ...amt(t.tax)]);
    const url = URL.createObjectURL(new Blob([rows.map((r) => r.map(q).join(',')).join('\r\n')], { type: 'text/csv' }));
    const a = h('a', { href: url, download: `tilly-export-${iso(new Date())}.csv` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast(`Exported ${plural(rows.length - 1, 'row')}`);
  }
  function showCode(code, note) {
    $('code-value').textContent = code;
    $('code-note').textContent = note || 'This code is the only way to get back in if you forget your password. Write it down or save it in your password manager. It is shown only once.';
    $('code-copy').textContent = 'Copy code';
    $('sheet-code').hidden = false; $('code-done').focus();
  }
  $('code-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('code-value').textContent); $('code-copy').textContent = 'Copied'; }
    catch { const r = document.createRange(); r.selectNodeContents($('code-value')); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); $('code-copy').textContent = 'Selected. Copy it now'; }
  });
  $('code-done').addEventListener('click', () => { $('sheet-code').hidden = true; $('code-value').textContent = ''; setTimeout(maybeWelcome, 0); });

  function download(name, type, text) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = h('a', { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  function exportJson() {
    const data = { app: 'Tilly', version: APP_VERSION, exported_at: new Date().toISOString(), note: 'All amounts are in US dollars.', profiles, purchases, taxes, subscriptions, budgets, goals };
    download(`tilly-backup-${iso(new Date())}.json`, 'application/json', JSON.stringify(data, null, 2));
    toast('Backup downloaded');
  }
  function proCard() {
    const pro = isPro();
    if (mode === 'demo') return h('section', { class: 'card pro-card' + (pro ? ' on' : '') },
      h('div', { class: 'pro-card-top' }, h('span', { class: 'pro-mark' }, icon('star')), h('div', null, h('h2', { text: 'Tilly Pro' }), h('p', { class: 'note', text: 'The demo can show Tilly with or without Pro.' })), proChip()),
      setRow('Preview as', pro ? 'Every Pro feature is on.' : 'Pro features show what you would unlock.', segPick('Preview as', [['free', 'Free'], ['pro', 'Pro']], pro ? 'pro' : 'free', (k) => { demoPro = k === 'pro'; applyAccent(); render(); })));
    const e = ent || {}, actions = [];
    let title, sub;
    if (!pro) {
      title = 'Free plan';
      sub = e.trial_used ? 'Your Pro trial has ended. Everything you added is still here.' : 'Try every Pro feature free for 14 days. No card needed.';
      actions.push(h('button', { class: 'btn primary small', onclick: () => openPaywall() }, icon('star'), e.trial_used ? 'See Pro' : 'Try Pro free'));
    } else if (e.source === 'trial') {
      title = `Pro trial · ${plural(daysUntil(e.current_period_end), 'day')} left`;
      sub = `Ends ${fmtDay(e.current_period_end)}. It never charges you.`;
      actions.push(h('button', { class: 'btn primary small', text: 'Keep Pro', onclick: () => openPaywall() }));
    } else if (e.source === 'stripe') {
      title = `Pro · ${e.plan === 'month' ? 'monthly' : 'yearly'}`;
      sub = e.status === 'past_due' ? "Your last payment didn't go through. Update your card to keep Pro." : e.cancel_at_period_end ? `Cancelled. Pro stays on until ${fmtDay(e.current_period_end)}.` : `Renews ${fmtDay(e.current_period_end)}.`;
      actions.push(h('button', { class: 'btn ghost small', text: 'Manage subscription', onclick: (ev) => openPortal(ev.currentTarget) }));
    } else if (!e.current_period_end) { title = 'Pro for life'; sub = 'Every Pro feature, for good. Thank you!'; }
    else { title = 'Pro'; sub = `On until ${fmtDay(e.current_period_end)}.`; }
    const codeBtn = h('button', { class: 'link', text: 'Have a code?', onclick: () => { openPaywall(); $('pro-code-row').hidden = false; $('pro-code-toggle').hidden = true; $('pro-code').focus(); } });
    return h('section', { class: 'card pro-card' + (pro ? ' on' : '') },
      h('div', { class: 'pro-card-top' }, h('span', { class: 'pro-mark' }, icon('star')), h('div', null, h('h2', { text: title }), h('p', { class: 'note', text: sub })), proChip()),
      actions.length || !pro || e.source === 'trial' ? h('div', { class: 'pro-card-actions' }, ...actions, !pro || e.source === 'trial' ? codeBtn : null) : null);
  }
  function accentRow() {
    const pro = isPro(), on = pro || mode === 'demo' ? curAccent() : 'gold';
    return setRow(h('span', { class: 'lbl-pro' }, 'Accent color', pro ? null : proChip('tiny')), pro ? 'The color of buttons and highlights.' : 'Six more colors come with Pro.',
      h('div', { class: 'accent-pick', role: 'radiogroup', 'aria-label': 'Accent color' }, ACCENTS.map(([k, name, hex]) => h('button', {
        type: 'button', class: 'swatch sm', role: 'radio', 'aria-checked': String(on === k), 'aria-label': name, title: name, c: hex,
        onclick: () => { if (k !== 'gold' && !requirePro('colors')) return; ls.set('tilly-accent', k); applyAccent(); render(); } }))));
  }
  function helpCard() {
    const row = (ic, label, fn) => h('button', { class: 'list-link', onclick: fn }, h('span', { class: 'll-ic' }, icon(ic)), h('span', { text: label }), icon('chev'));
    return card('Help & support', null,
      h('div', { class: 'list-links' },
        row('help', 'Help and common questions', () => openSheet('sheet-help')),
        row('mail', 'Contact support', () => openSupport()),
        row('spark', "What's new", () => openSheet('sheet-new')),
        row('doc', 'Terms of Service', () => openDoc('terms')),
        row('shield', 'Privacy Policy', () => openDoc('privacy'))),
      h('p', { class: 'fine version', text: `Tilly ${APP_VERSION}${NATIVE ? ' · ' + (PLATFORM === 'ios' ? 'iPhone' : 'Android') + ' app' : ''}` }));
  }
  function viewSettings() {
    // profiles
    const list = h('div', { class: 'plist' }, profiles.map((p) => {
      const n = purchases.filter((x) => x.profile_id === p.id);
      return h('div', { class: 'prow' }, avatar(p.name, colorVar(p.color), 'round solid'),
        h('div', { style: { minWidth: 0 } }, h('div', { class: 'prow-name', text: p.name }), h('div', { class: 'prow-sub', text: `${money(sum(n, 'price'))} · ${plural(n.length, 'item')}` })),
        h('button', { class: 'btn ghost small', text: 'Edit', onclick: () => openProfileSheet(p) }));
    }));
    if (!profiles.length) list.append(h('p', { class: 'empty', text: 'No profiles yet.' }));
    const out = [
      h('div', { class: 'section-head' }, h('h2', { class: 'section-title', text: 'Settings' })),
      proCard(),
      card('Profiles', 'Rename, recolor or delete a profile, or add a new one.', list, h('button', { class: 'btn primary', style: { marginTop: '14px' }, onclick: () => openProfileSheet(null) }, icon('plus'), 'New profile')),
      card('Appearance', null, accentRow()),
      card('Preferences', 'Saved on this device.',
        setRow('Currency', cur() === '$' ? 'Amounts are saved in US dollars. Pick another currency to convert everything at the latest exchange rate.' : `Converted from US dollars at 1 USD = ${rate().toLocaleString('en-US', { maximumFractionDigits: 4 })} ${CUR[cur()].code}${fx && fx.date ? ` (rate from ${fmtDate(fx.date)})` : ''}. New receipts are entered in ${CUR[cur()].code}.`, (() => {
          const sel = h('select', { class: 'set-select', 'aria-label': 'Currency' }, CURRENCIES.map((c) => new Option(`${c} ${CUR[c].code}`, c))); sel.value = cur();
          sel.addEventListener('change', async () => {
            const want = sel.value;
            if (want !== '$' && !(await loadRates(!fx))) { sel.value = cur(); toast("Couldn't get exchange rates. Connect to the internet and try again."); return; }
            setPref('currency', want); heroShown = null; render();
          });
          return sel; })()),
        setRow('Open on', 'Which month shows first when you open Tilly.', segPick('Open on', [['latest', 'Latest month'], ['all', 'All time']], prefs.start, (k) => { setPref('start', k); month = k === 'all' ? 'all' : monthList()[0] || 'all'; render(); }))),
      card('Notifications', null,
        NATIVE
          ? setRow('Monthly reminder', "On the 1st at 9 AM, with last month's total.", segPick('Monthly reminder', [['off', 'Off'], ['on', 'On']], prefs.reminder ? 'on' : 'off', (k) => setReminder(k === 'on')))
          : setRow('Monthly reminder', 'Get it in the Tilly phone app. Here, Home shows a recap of last month during the first week.', null)),
      card('Your data', null,
        setRow('Export', 'Download every receipt as a spreadsheet file (CSV).', h('button', { class: 'btn ghost small', text: 'Export', disabled: !purchases.length, onclick: exportCsv })),
        setRow('Full backup', 'Everything in your account in one file (JSON).', h('button', { class: 'btn ghost small', text: 'Download', onclick: exportJson })),
        setRow(h('span', { class: 'lbl-pro' }, 'Monthly report', isPro() ? null : proChip('tiny')), NATIVE ? 'Open Tilly on the web to save a PDF report.' : 'A one-page PDF of the month you have open.', h('button', { class: 'btn ghost small', text: 'Make PDF', disabled: NATIVE || !purchases.length, onclick: printReport }))),
    ];
    if (mode === 'demo') {
      out.push(helpCard());
      out.push(card('Like what you see?', 'Create a free account to track your own receipts.', h('button', { class: 'btn primary', text: 'Create account', onclick: () => leaveDemo(true) }), h('button', { class: 'btn ghost', style: { marginTop: '10px' }, text: 'Leave the demo', onclick: () => leaveDemo(false) })));
      return out;
    }
    const newCode = async () => { const d = await callAccount('new_recovery_code', {}, true); recoveryAt = new Date().toISOString(); render(); showCode(d.recovery_code, recoveryWas ? 'Your old code no longer works. Save this new one somewhere safe. It is shown only once.' : null); };
    const recoveryWas = !!recoveryAt;
    const codeBtn = recoveryAt
      ? armButton('btn ghost small', 'Replace', 'Tap again: the old code stops working', newCode)
      : h('button', { class: 'btn primary small', text: 'Create', onclick: async (e) => { e.target.disabled = true; try { await newCode(); } catch { e.target.disabled = false; toast("Couldn't create a code. Try again."); } } });
    out.push(card('Account', null,
      !recoveryAt ? h('p', { class: 'warn-note', style: { marginBottom: '12px' }, text: "You don't have a recovery code yet. Create one so you can reset your password if you forget it." }) : null,
      setRow('Email', (session && session.user && session.user.email) || '', null),
      setRow('Password', null, h('button', { class: 'btn ghost small', text: 'Change', onclick: () => openPasswordSheet(false) })),
      setRow('Recovery code', recoveryAt ? `Created ${fmtDate(recoveryAt.slice(0, 10))}. Use it to reset a forgotten password.` : 'Not set up yet.', codeBtn),
      setRow('Sign out', 'On this device.', h('button', { class: 'btn ghost small', text: 'Sign out', onclick: signOut })),
      setRow('Delete account', 'Removes your account, profiles and every receipt for good.', armButton('danger-link', 'Delete', 'Tap again to delete everything', async () => {
        await callAccount('delete_account', { confirm: 'DELETE' }, true);
        clearLocalCopy();
        if (Notes) Notes.cancel({ notifications: [{ id: REMINDER_ID }] }).catch(() => {});
        try { await sb.auth.signOut({ scope: 'local' }); } catch {}
        session = null; mode = null; showAuth('up'); toast('Your account was deleted');
      }))));
    if (!imported) {
      const input = h('input', { class: 'input', type: 'password', placeholder: 'Family passcode', 'aria-label': 'Family passcode', autocomplete: 'off' });
      const status = h('p', { class: 'status', 'aria-live': 'polite' });
      const btn = h('button', { class: 'btn primary', text: 'Import' });
      btn.addEventListener('click', async () => {
        if (!input.value.trim()) { status.className = 'status err'; status.textContent = 'Enter the family passcode first.'; return; }
        btn.disabled = true; status.className = 'status'; status.replaceChildren(h('span', { class: 'spin' }), 'Bringing your receipts over…');
        try {
          const d = await callAccount('import_legacy', { passcode: input.value.trim() }, true);
          toast(`Imported ${d.purchases} items`);
          month = null; await refresh(); setTab('home');
        } catch (e) {
          btn.disabled = false; status.className = 'status err';
          status.textContent = e.code === 'wrong_passcode' ? "That passcode didn't match." : e.code === 'already_imported' ? 'This account already imported that data.' : "Couldn't import right now. Check your connection and try again.";
        }
      });
      out.push(card('Coming from Family Spending?', 'Enter the family passcode from the old app to copy its receipts into this account. Mom and Dad are added as profiles.', h('div', { class: 'import-row' }, input, btn), status));
    }
    out.push(helpCard());
    return out;
  }

  // ---------- render ----------
  function renderMonthSelect() {
    const s = $('month'), months = monthList();
    s.replaceChildren(new Option('All time', 'all'), ...months.map((m) => new Option(fmtMonth(m), m)));
    s.value = month || 'all';
  }
  function render() {
    renderMonthSelect();
    document.querySelectorAll('.tabs [data-tab]').forEach((b) => b.setAttribute('aria-current', b.dataset.tab === tab ? 'page' : 'false'));
    const view = $('view');
    const keepFocus = document.activeElement && document.activeElement.id === 'receipt-search';
    if (loadError && !loaded) { view.replaceChildren(h('div', { class: 'card empty' }, h('p', { text: "Couldn't load your receipts. Check your connection." }), h('button', { class: 'btn primary', style: { marginTop: '12px' }, text: 'Try again', onclick: refresh }))); return; }
    if (!loaded) { view.replaceChildren(h('div', { class: 'card empty' }, h('span', { class: 'spin' }), 'Loading your receipts…')); return; }
    $('open-settings').setAttribute('aria-current', tab === 'settings' ? 'page' : 'false');
    $('month').closest('.pill-select').hidden = tab === 'plan' || tab === 'settings';
    $('pro-badge').hidden = !isPro(); $('pro-badge-side').hidden = !isPro();
    view.dataset.tab = tab; document.body.dataset.tab = tab;
    const kids = tab === 'receipts' ? viewReceipts() : tab === 'insights' ? viewInsights() : tab === 'settings' ? viewSettings() : tab === 'plan' ? viewPlan() : viewHome();
    view.replaceChildren(...kids.filter(Boolean));
    if (keepFocus && $('receipt-search')) { const i = $('receipt-search'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  }
  function setTab(name) {
    if (name === 'profiles') name = 'settings';
    if (['subs', 'budgets', 'goals'].includes(name)) { planSeg = name; name = 'plan'; }
    if (!['home', 'receipts', 'plan', 'insights', 'settings'].includes(name)) name = 'home';
    const changed = tab !== name;
    tab = name; editing = false;
    if (name !== 'receipts') query = '';
    if (location.hash.slice(1) !== name) history.replaceState(null, '', '#' + name);
    render();
    if (changed) window.scrollTo(0, 0);
  }
  document.querySelectorAll('.tabs [data-tab]').forEach((b) => b.addEventListener('click', () => { if (b.dataset.tab === 'receipts' && tab !== 'receipts') filterProfile = 'all'; setTab(b.dataset.tab); }));
  $('month').addEventListener('change', (e) => { month = e.target.value; render(); });
  $('open-settings').addEventListener('click', () => setTab('settings'));
  $('pro-badge').addEventListener('click', () => setTab('settings'));
  $('pro-badge-side').addEventListener('click', () => setTab('settings'));
  const topBar = document.querySelector('.top');
  const markScrolled = () => topBar.classList.toggle('scrolled', window.scrollY > 4);
  window.addEventListener('scroll', markScrolled, { passive: true }); markScrolled();
  window.addEventListener('hashchange', () => { if ($('app').hidden) return; const t = location.hash.slice(1); if (t && t !== tab) setTab(t); });

  // ---------- sheets ----------
  function openSheet(id) {
    const el = $(id);
    if (el.hidden) el.parentNode.append(el); // newest on top
    el.hidden = false;
    const x = el.querySelector('[data-close]'); if (x) x.focus();
  }
  const closeSheets = () => document.querySelectorAll('.sheet-bg').forEach((s) => (s.hidden = true));
  const openSheetEls = () => [...document.querySelectorAll('.sheet-bg')].filter((s) => !s.hidden);
  function closeTop() { const open = openSheetEls(), top = open[open.length - 1]; if (top && !('sticky' in top.dataset)) top.hidden = true; return !!top; }
  document.querySelectorAll('.sheet-bg').forEach((bg) => {
    bg.addEventListener('click', (e) => { if (e.target === bg && !('sticky' in bg.dataset)) bg.hidden = true; });
    bg.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => { bg.hidden = true; }));
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeTop(); });

  // profile editor
  let pfEditing = null, pfColor = 'pink';
  function drawPfPreview() {
    const a = $('pf-avatar'); a.textContent = initial($('pf-name').value); a.className = 'avatar xl solid'; a.style.setProperty('--c', colorVar(pfColor));
    $('pf-colors').querySelectorAll('.swatch').forEach((s) => s.setAttribute('aria-checked', String(s.dataset.color === pfColor)));
  }
  $('pf-colors').append(...COLORS.map((c) => h('button', { type: 'button', class: 'swatch', role: 'radio', c: colorVar(c), 'data-color': c, 'aria-label': c, onclick: () => { pfColor = c; drawPfPreview(); } })));
  $('pf-name').addEventListener('input', drawPfPreview);
  function openProfileSheet(p) {
    if (!p && !isPro() && profiles.length >= FREE_PROFILES) { openPaywall('profiles'); return; }
    pfEditing = p;
    $('pf-title').textContent = p ? 'Edit profile' : 'New profile';
    $('pf-save').textContent = p ? 'Save changes' : 'Create profile';
    $('pf-name').value = p ? p.name : '';
    pfColor = p ? p.color : (COLORS.find((c) => !profiles.some((x) => x.color === c)) || COLORS[profiles.length % COLORS.length]);
    $('pf-err').textContent = '';
    const del = $('pf-delete'); del.hidden = !p; del.textContent = 'Delete profile'; del.dataset.armed = '';
    const used = profiles.map((x) => x.name.toLowerCase());
    $('pf-suggest').replaceChildren(...(p ? [] : ['Me', 'Partner', 'Household', 'Kids', 'Business'].filter((n) => !used.includes(n.toLowerCase())).map((n) => h('button', { type: 'button', text: n, onclick: () => { $('pf-name').value = n; drawPfPreview(); } }))));
    drawPfPreview();
    openSheet('sheet-profile');
    if (!p) $('pf-name').focus();
  }
  $('pf-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('pf-name').value.trim();
    if (!name) { $('pf-err').textContent = 'Give the profile a name.'; return; }
    if (profiles.some((x) => x.name.toLowerCase() === name.toLowerCase() && (!pfEditing || x.id !== pfEditing.id))) { $('pf-err').textContent = 'You already have a profile with that name.'; return; }
    $('pf-save').disabled = true;
    try {
      if (pfEditing) await db().updateProfile(pfEditing.id, name, pfColor); else await db().addProfile(name, pfColor);
      closeSheets(); toast(pfEditing ? 'Profile saved' : `${name} added`); await refresh();
    } catch { $('pf-err').textContent = "Couldn't save the profile. Try again."; }
    $('pf-save').disabled = false;
  });
  $('pf-delete').addEventListener('click', async () => {
    const del = $('pf-delete'); if (!pfEditing) return;
    const n = purchases.filter((x) => x.profile_id === pfEditing.id).length;
    if (!del.dataset.armed) { del.dataset.armed = '1'; del.textContent = n ? `Tap again to delete ${pfEditing.name} and ${plural(n, 'item')}` : `Tap again to delete ${pfEditing.name}`; return; }
    del.disabled = true;
    try { await db().deleteProfile(pfEditing.id); closeSheets(); toast('Profile deleted'); await refresh(); }
    catch { $('pf-err').textContent = "Couldn't delete the profile. Try again."; }
    del.disabled = false;
  });

  // add receipt
  let addFor = null, photo = null, receiptTotal = null;
  function drawAddWho() {
    $('add-who').replaceChildren(...profiles.map((p) => h('button', { type: 'button', class: 'chip', c: colorVar(p.color), 'aria-pressed': String(addFor === p.id), onclick: () => { addFor = p.id; drawAddWho(); updateSum(); } }, dot(colorVar(p.color)), p.name)));
  }
  function showReview(on) { $('review').hidden = !on; if (on) updateSum(); }
  function openAdd(slip) {
    if (!loaded) return;
    if (!profiles.length) { toast('Create a profile first'); openProfileSheet(null); return; }
    editingSlip = slip || null;
    photo = null; receiptTotal = null;
    $('add-title').textContent = slip ? 'Edit receipt' : 'Add a receipt';
    $('add-photo').hidden = !!slip;
    $('preview').hidden = true; $('scan-status').textContent = ''; $('scan-status').className = 'status';
    $('lines').replaceChildren();
    $('r-store').value = slip ? slip.store : ''; $('r-date').value = slip ? slip.date : iso(new Date());
    $('r-tax').value = slip ? inCur(sum(slip.taxes, 'tax')).toFixed(CUR[cur()].dp) : '0';
    if (slip) for (const it of slip.items.slice().sort((a, b) => String(a.item).localeCompare(String(b.item)))) addLine(it.item, inCur(it.price), it.category);
    $('save-status').textContent = ''; $('save-status').className = 'status';
    addFor = slip ? slip.profile_id : filterProfile !== 'all' && tab === 'receipts' ? filterProfile : profiles.length === 1 ? profiles[0].id : null;
    drawAddWho();
    showReview(!!slip);
    openSheet('sheet-add');
  }
  $('open-add').addEventListener('click', () => openAdd(null));
  function setPhoto(blob) {
    photo = blob;
    const img = $('preview-img'); if (img.src && img.src.startsWith('blob:')) URL.revokeObjectURL(img.src); img.src = URL.createObjectURL(blob);
    $('preview').hidden = false; $('scan-status').textContent = ''; $('scan-status').className = 'status';
    $('scan').click(); // start reading right away
  }
  function onPhoto(e) {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if (f) setPhoto(f);
  }
  // Phone app: the native camera (on Android, Google's document scanner, which finds
  // the receipt's edges and flattens it), or the photo library.
  async function nativePhoto(source) {
    const cancelled = (e) => /cancel|0006|0011|no image|not selected/i.test(String((e && (e.message || e.code)) || ''));
    try {
      let uri = null;
      if (source === 'camera' && DocScanner) {
        try {
          const { available } = await DocScanner.isGoogleDocumentScannerModuleAvailable();
          if (available) {
            const r = await DocScanner.scanDocument({ galleryImportAllowed: false, pageLimit: 1, resultFormats: 'JPEG', scannerMode: 'FULL' });
            uri = r.scannedImages && r.scannedImages[0];
            if (!uri) return;
          } else DocScanner.installGoogleDocumentScannerModule().catch(() => {});
        } catch (e) { if (cancelled(e)) return; }
      }
      if (!uri) {
        const r = source === 'camera'
          ? await Camera.takePhoto({ quality: 85, correctOrientation: true, editable: 'in-app' })
          : ((await Camera.chooseFromGallery({ mediaType: 0, limit: 1, editable: 'in-app', quality: 85 })).results || [])[0];
        if (!r) return;
        uri = r.webPath || r.uri;
      }
      const blob = await fetch(Cap.convertFileSrc(uri)).then((res) => res.blob());
      setPhoto(blob);
    } catch (e) {
      if (cancelled(e)) return;
      const denied = /denied|permission|0003|0005/i.test(String((e && (e.message || e.code)) || ''));
      toast(denied ? `Tilly needs ${source === 'camera' ? 'camera' : 'photo'} access. Turn it on in your phone's Settings.` : "Couldn't get the photo. Try again, or type the items.");
    }
  }
  if (NATIVE && Camera) {
    document.querySelector('label[for="cam"]').addEventListener('click', (e) => { e.preventDefault(); nativePhoto('camera'); });
    document.querySelector('label[for="pick"]').addEventListener('click', (e) => { e.preventDefault(); nativePhoto('gallery'); });
  }
  $('cam').addEventListener('change', onPhoto);
  $('pick').addEventListener('change', onPhoto);
  function addLine(item = '', price = '', category = null) {
    const name = h('input', { class: 'input', type: 'text', value: item, placeholder: 'Item', 'aria-label': 'Item', maxLength: 200 });
    const p = h('input', { class: 'input price', type: 'number', step: '0.01', inputMode: 'decimal', value: price === '' ? '' : Number(price).toFixed(CUR[cur()].dp === 0 ? 0 : 2), placeholder: '0.00', 'aria-label': 'Price' });
    const x = h('button', { type: 'button', class: 'rm', text: '✕', 'aria-label': 'Remove line' });
    const cs = catSelect(category || guessCategory(item, $('r-store').value)); cs.dataset.auto = category ? '' : '1';
    cs.addEventListener('change', () => { cs.dataset.auto = ''; });
    name.addEventListener('change', () => { if (cs.dataset.auto) cs.value = guessCategory(name.value, $('r-store').value); });
    const row = h('div', { class: 'line' }, name, p, x, cs);
    x.addEventListener('click', () => { row.remove(); updateSum(); });
    name.addEventListener('input', updateSum); p.addEventListener('input', updateSum);
    $('lines').append(row);
    return name;
  }
  $('add-line').addEventListener('click', () => addLine().focus());
  const readLines = () => [...$('lines').children].map((r) => ({ item: r.children[0].value.trim(), price: r.children[1].value === '' ? NaN : Number(r.children[1].value), category: r.children[3].value }));
  $('r-store').addEventListener('change', () => { for (const r of $('lines').children) { const cs = r.children[3]; if (cs.dataset.auto) cs.value = guessCategory(r.children[0].value, $('r-store').value); } });
  function updateSum() {
    const lines = readLines().filter((l) => l.item || !isNaN(l.price));
    const items = r2(lines.reduce((s, l) => s + (isNaN(l.price) ? 0 : l.price), 0)), tax = Number($('r-tax').value) || 0;
    const row = (a, b, strong) => h('div', null, h(strong ? 'strong' : 'span', { text: a }), h(strong ? 'strong' : 'span', { class: 'mono', text: b }));
    $('sum').replaceChildren(row(`Items (${lines.length})`, fmtCur(items)), row('Tax', fmtCur(tax)), row('Total', fmtCur(r2(items + tax)), true));
    if (cur() !== '$') $('sum').append(h('p', { class: 'note', text: `Enter amounts in ${CUR[cur()].code}. Saved as US$${toUsd(r2(items + tax)).toFixed(2)} at today's rate.` }));
    if (receiptTotal != null && Math.abs(r2(items + tax) - receiptTotal) > 0.02) $('sum').append(h('p', { class: 'warn', text: `The receipt says ${fmtCur(receiptTotal)}. Check the lines before adding.` }));
    // the same store, date and total already saved? probably a second copy
    const d = $('r-date').value, store = $('r-store').value.trim().toLowerCase();
    if (!editingSlip && store && lines.length && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      const dup = buildSlips(purchases.filter((p) => p.date === d), taxes.filter((t) => t.date === d))
        .find((x) => x.store.toLowerCase() === store && Math.abs(inCur(sum(x.items, 'price') + sum(x.taxes, 'tax')) - r2(items + tax)) < 0.02);
      if (dup) $('sum').append(h('p', { class: 'warn', text: `You already added a ${dup.store} receipt for this amount on ${fmtDate(d)}. Make sure this isn't the same one.` }));
    }
    const bad = lines.some((l) => !l.item || isNaN(l.price));
    $('save').disabled = !addFor || !lines.length || bad || !/^\d{4}-\d{2}-\d{2}$/.test($('r-date').value);
    const p = profileById(addFor);
    $('save').textContent = !p ? 'Pick a profile first' : editingSlip ? 'Save changes' : `Add to ${p.name}`;
  }
  $('r-tax').addEventListener('input', updateSum);
  $('r-date').addEventListener('input', updateSum);
  $('type-instead').addEventListener('click', () => { receiptTotal = null; if (!$('lines').children.length) addLine(); showReview(true); $('r-store').focus(); });
  $('scan').addEventListener('click', async () => {
    if (!photo) return;
    const st = $('scan-status'), btn = $('scan');
    btn.disabled = true; st.className = 'status';
    const show = (msg) => st.replaceChildren(h('span', { class: 'spin' }), msg);
    show('Getting the scanner ready… the first scan takes a little longer.');
    try {
      const out = await window.Scan.scan(photo, (status, prog) => { if (/recogniz/i.test(status)) show(`Reading the receipt… ${Math.round(prog * 100)}%`); });
      if (!out.items.length) throw { code: 'no_items' };
      $('lines').replaceChildren();
      if (out.store) $('r-store').value = out.store;
      for (const it of out.items) addLine(it.item, it.price);
      if (out.date) $('r-date').value = out.date;
      $('r-tax').value = (out.tax || 0).toFixed(2);
      receiptTotal = out.total;
      st.textContent = `Found ${plural(out.items.length, 'item')}. The scanner can misread things, so check each line before adding.`;
      showReview(true);
    } catch (e) {
      st.className = 'status err';
      const code = e && e.code;
      st.textContent = code === 'ocr_load' ? "Couldn't load the scanner. Check your connection and try again."
        : code === 'image_rejected' ? "That photo couldn't be opened. Try taking it again."
        : code === 'no_items' ? "Couldn't find any prices. Try a flat, well-lit photo, or type the items."
        : 'Something went wrong scanning the receipt. Try again, or type the items.';
    } finally { btn.disabled = false; }
  });
  $('save').addEventListener('click', async () => {
    const lines = readLines().filter((l) => l.item && !isNaN(l.price));
    if (!addFor || !lines.length) return;
    const btn = $('save'), st = $('save-status');
    btn.disabled = true; st.className = 'status'; st.textContent = 'Adding…';
    const date = $('r-date').value, who = profileById(addFor), before = budgetLevels(), wasEdit = !!editingSlip;
    const rec = { profile_id: addFor, date, store: $('r-store').value.trim(), items: lines.map((l) => ({ item: l.item, price: toUsd(l.price), category: l.category })), tax: toUsd(Number($('r-tax').value) || 0) };
    try {
      if (wasEdit) await db().replaceReceipt(editingSlip, rec); else await db().addReceipt(rec);
      closeSheets(); editingSlip = null;
      if (month !== 'all') month = date.slice(0, 7);
      await refresh();
      const alert = date.slice(0, 7) === thisMonth() ? budgetAlert(before) : null;
      toast(offline ? `Saved on this device. It will sync when you're back online.` : (wasEdit ? 'Receipt updated.' : `Added ${plural(lines.length, 'item')} to ${who ? who.name : 'profile'}.`) + (alert ? ' ' + alert : ''));
    } catch { st.className = 'status err'; st.textContent = "Couldn't save the receipt. Check your connection and try again."; btn.disabled = false; }
  });


  // ---------- welcome (new accounts), what's new, support, legal pages ----------
  const WEL_NAMES = ['Me', 'Partner', 'Household', 'Kids', 'Business'];
  let welPicked = new Set(['Me']), welExtra = [];
  function drawWelcome() {
    const names = [...WEL_NAMES, ...welExtra];
    $('wel-who').replaceChildren(...names.map((n) => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(welPicked.has(n)), onclick: () => {
      if (welPicked.has(n)) welPicked.delete(n);
      else if (!isPro() && welPicked.size >= FREE_PROFILES) { $('wel-err').textContent = `Free accounts have up to ${FREE_PROFILES} profiles. Pro has no limit.`; return; }
      else welPicked.add(n);
      $('wel-err').textContent = ''; drawWelcome();
    } }, welPicked.has(n) ? icon('check') : null, n)));
    $('wel-budget-label').textContent = `Monthly budget in ${CUR[cur()].code} (optional)`;
  }
  function maybeWelcome() {
    if (mode !== 'remote' || !loaded || profiles.length || !$('sheet-code').hidden || !$('sheet-welcome').hidden) return;
    if (ls.get('tilly-welcomed-' + userId())) return;
    welPicked = new Set(['Me']); welExtra = [];
    $('wel-budget').value = ''; $('wel-custom').value = ''; $('wel-err').textContent = '';
    drawWelcome(); openSheet('sheet-welcome');
  }
  function afterLoad() {
    if (mode !== 'remote') return;
    if (!profiles.length) { maybeWelcome(); return; }
    if (ls.get('tilly-seen-version') !== APP_VERSION) { ls.set('tilly-seen-version', APP_VERSION); if (!openSheetEls().length) openSheet('sheet-new'); }
  }
  const finishWelcome = () => { ls.set('tilly-welcomed-' + userId(), '1'); ls.set('tilly-seen-version', APP_VERSION); $('sheet-welcome').hidden = true; };
  $('wel-add').addEventListener('click', () => {
    const v = $('wel-custom').value.trim().slice(0, 40); if (!v) return;
    const names = [...WEL_NAMES, ...welExtra], same = names.find((n) => n.toLowerCase() === v.toLowerCase());
    if (!same) welExtra.push(v);
    if (isPro() || welPicked.size < FREE_PROFILES) welPicked.add(same || v); else $('wel-err').textContent = `Free accounts have up to ${FREE_PROFILES} profiles. Pro has no limit.`;
    $('wel-custom').value = ''; drawWelcome();
  });
  $('wel-custom').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('wel-add').click(); } });
  $('wel-skip').addEventListener('click', finishWelcome);
  $('wel-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const names = [...WEL_NAMES, ...welExtra].filter((n) => welPicked.has(n)), v = Number($('wel-budget').value);
    if (!names.length) { $('wel-err').textContent = 'Pick at least one, or tap Skip for now.'; return; }
    $('wel-go').disabled = true;
    try {
      const used = new Set(profiles.map((p) => p.color));
      for (const n of names) { if (profiles.some((p) => p.name.toLowerCase() === n.toLowerCase())) continue; const color = COLORS.find((c) => !used.has(c)) || COLORS[0]; used.add(color); await db().addProfile(n, color); }
      if (v > 0) await db().saveBudget({ id: (budgets.find((b) => b.scope === 'total') || {}).id, scope: 'total', target: '', amount: toUsd(v) });
      finishWelcome(); await refresh();
      toast("You're all set. Tap + to add your first receipt.");
    } catch { $('wel-err').textContent = "Couldn't finish setting up. Check your connection and try again."; }
    $('wel-go').disabled = false;
  });

  function openSupport(topic) {
    if (mode !== 'remote') { toast(mode === 'demo' ? 'Create an account to contact support.' : 'Sign in to contact support.'); return; }
    $('sup-topic').value = topic || 'help'; $('sup-msg').value = '';
    $('sup-err').textContent = ''; $('sup-ok').textContent = '';
    $('sup-email').value = (session && session.user && session.user.email) || '';
    openSheet('sheet-support'); $('sup-msg').focus();
  }
  $('help-contact').addEventListener('click', () => openSupport());
  $('sup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('sup-msg').value.trim(), email = $('sup-email').value.trim(), err = $('sup-err'), okEl = $('sup-ok'), btn = $('sup-send');
    err.textContent = ''; okEl.textContent = '';
    if (!msg) { err.textContent = 'Write a message first.'; return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { err.textContent = 'Check the email address, or leave it empty.'; return; }
    btn.disabled = true;
    try {
      await remote.sendFeedback({ topic: $('sup-topic').value, message: msg.slice(0, 4000), reply_to: email || null, platform: PLATFORM, app_version: APP_VERSION });
      $('sup-msg').value = '';
      okEl.textContent = email ? `Sent. We'll reply to ${email}.` : 'Sent. Thank you!';
    } catch (x) {
      const m = String((x && (x.message || x.code)) || '');
      err.textContent = /too_many/.test(m) ? "You've sent a lot of messages today. Please try again tomorrow." : isNetErr(x) ? "You're offline. Connect to the internet and try again." : "Couldn't send your message. Try again.";
    }
    btn.disabled = false;
  });
  function openDoc(kind) {
    const k = kind === 'privacy' ? 'privacy' : 'terms';
    $('doc-title').textContent = k === 'privacy' ? 'Privacy Policy' : 'Terms of Service';
    openSheet('sheet-doc');
    $('doc-frame').src = `${k}.html?embed=1`;
  }
  document.addEventListener('click', (e) => {
    const d = e.target.closest('[data-doc]'); if (d) { e.preventDefault(); openDoc(d.dataset.doc); return; }
    const o = e.target.closest('[data-open]'); if (o) { e.preventDefault(); openSheet(o.dataset.open); }
  });

  // ---------- sign in / sign up / demo ----------
  let authMode = ls.get('tilly-returning') ? 'in' : 'up';
  function drawAuthMode() {
    $('mode-in').setAttribute('aria-selected', String(authMode === 'in'));
    $('mode-up').setAttribute('aria-selected', String(authMode === 'up'));
    $('auth-submit').textContent = authMode === 'in' ? 'Sign in' : 'Create account';
    $('password').autocomplete = authMode === 'in' ? 'current-password' : 'new-password';
    $('auth-err').textContent = '';
    $('forgot').hidden = authMode !== 'in';
    $('legal-line').hidden = authMode !== 'up';
  }
  $('mode-in').addEventListener('click', () => { authMode = 'in'; drawAuthMode(); });
  $('mode-up').addEventListener('click', () => { authMode = 'up'; drawAuthMode(); });
  function showAuth(m) { if (m) authMode = m; drawAuthMode(); $('app').hidden = true; $('auth').hidden = false; closeSheets(); window.scrollTo(0, 0); }
  function enterApp() {
    $('auth').hidden = true; $('app').hidden = false; $('demo-banner').hidden = mode !== 'demo';
    loaded = false; loadError = false; month = null; filterProfile = 'all'; heroShown = null; profiles = []; purchases = []; taxes = [];
    budgets = []; goals = []; subscriptions = []; ent = null; payments = null; planSeg = 'budgets'; showHiddenTips = false;
    setTab(mode === 'demo' ? 'home' : location.hash.slice(1) || 'home');
    refresh();
  }
  $('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('email').value.trim(), password = $('password').value, err = $('auth-err'), btn = $('auth-submit');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { err.textContent = 'Enter a valid email address.'; return; }
    if (password.length < 8) { err.textContent = 'Use a password with at least 8 characters.'; return; }
    if (!sb) { err.textContent = "Couldn't reach Tilly. Check your connection and reload."; return; }
    btn.disabled = true; err.textContent = '';
    const label = btn.textContent; btn.replaceChildren(h('span', { class: 'spin' }), authMode === 'in' ? 'Signing in…' : 'Creating your account…');
    let newCode = null;
    try {
      if (authMode === 'up') {
        const res = await fetch(ACCOUNT_FN, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'signup', email, password }) });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw { code: d.error || 'server_error' };
        newCode = d.recovery_code || null;
      }
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw { code: /invalid/i.test(error.message) ? 'bad_login' : 'server_error' };
      session = data.session; mode = 'remote'; ls.set('tilly-returning', '1');
      $('password').value = '';
      enterApp();
      if (newCode) showCode(newCode);
    } catch (x) {
      const code = x && x.code;
      err.textContent = code === 'email_taken' ? 'That email already has an account. Switch to Sign in.'
        : code === 'bad_login' ? "That email and password don't match."
        : code === 'weak_password' ? 'Use a password with at least 8 characters.'
        : code === 'bad_email' ? 'Enter a valid email address.'
        : "Something went wrong. Check your connection and try again.";
    }
    btn.disabled = false; btn.textContent = label;
  });
  let resetMode = 'email';
  function drawResetMode() {
    const code = resetMode === 'code';
    $('code-fields').hidden = !code;
    $('reset-intro').textContent = code ? 'Enter the recovery code you saved when you created your account. It looks like ABCD-EFGH-JKMN-PQRS.' : "We'll email you a link to choose a new password.";
    $('reset-submit').textContent = code ? 'Set new password' : 'Email me a reset link';
    $('reset-toggle').textContent = code ? 'Email me a link instead' : 'Use a recovery code instead';
    $('reset-err').textContent = ''; $('reset-ok').textContent = '';
  }
  $('reset-toggle').addEventListener('click', () => { resetMode = resetMode === 'code' ? 'email' : 'code'; drawResetMode(); (resetMode === 'code' ? $('reset-code') : $('reset-email')).focus(); });
  $('forgot').addEventListener('click', () => {
    resetMode = 'email'; drawResetMode();
    $('reset-email').value = $('email').value.trim(); $('reset-code').value = ''; $('reset-pass').value = '';
    openSheet('sheet-reset'); $('reset-email').focus();
  });
  $('reset-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('reset-email').value.trim(), err = $('reset-err'), okEl = $('reset-ok'), btn = $('reset-submit');
    err.textContent = ''; okEl.textContent = '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { err.textContent = 'Enter the email for your account.'; return; }
    if (!sb) { err.textContent = "Couldn't reach Tilly. Check your connection and reload."; return; }
    if (resetMode === 'email') {
      btn.disabled = true;
      try {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: RESET_URL });
        if (error) throw error;
        okEl.textContent = `If ${email} has a Tilly account, a reset link is on its way. Open it on any device. It can take a minute, so check spam too.`;
      } catch (x) {
        const m = String((x && x.message) || '');
        err.textContent = /rate|too many|seconds/i.test(m) ? 'Too many reset emails. Wait a few minutes and try again.' : "Couldn't send the email right now. Try again, or use your recovery code.";
      }
      btn.disabled = false;
      return;
    }
    const code = $('reset-code').value.trim(), password = $('reset-pass').value;
    if (code.replace(/[^A-Za-z0-9]/g, '').length !== 16) { err.textContent = 'The recovery code has 16 letters and numbers.'; return; }
    if (password.length < 8) { err.textContent = 'Use a password with at least 8 characters.'; return; }
    btn.disabled = true;
    try {
      const d = await callAccount('reset_password', { email, code, password });
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw { code: 'server_error' };
      session = data.session; mode = 'remote'; ls.set('tilly-returning', '1');
      enterApp(); toast('Password changed');
      if (d.recovery_code) showCode(d.recovery_code, 'Your password is changed and the old code is used up. Save this new code somewhere safe. It is shown only once.');
    } catch (x) {
      const c = x && x.code;
      err.textContent = c === 'bad_code' ? "That email and recovery code don't match." : c === 'locked' ? 'Too many tries. Wait 15 minutes and try again.' : c === 'weak_password' ? 'Use a password with at least 8 characters.' : "Something went wrong. Check your connection and try again.";
    }
    btn.disabled = false;
  });
  function openPasswordSheet(fromLink) {
    $('pw-title').textContent = fromLink ? 'Choose a new password' : 'Change password';
    $('pw-new').value = ''; $('pw-again').value = ''; $('pw-err').textContent = '';
    openSheet('sheet-password'); $('pw-new').focus();
  }
  $('pw-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const a = $('pw-new').value, b = $('pw-again').value, err = $('pw-err'), btn = $('pw-submit');
    if (a.length < 8) { err.textContent = 'Use a password with at least 8 characters.'; return; }
    if (a !== b) { err.textContent = "The two passwords don't match."; return; }
    btn.disabled = true; err.textContent = '';
    try {
      const { error } = await sb.auth.updateUser({ password: a });
      if (error) throw error;
      closeSheets(); toast('Password changed');
    } catch (x) { err.textContent = /different/i.test((x && x.message) || '') ? 'Pick a password different from your current one.' : "Couldn't change the password. Try again."; }
    btn.disabled = false;
  });
  $('try-demo').addEventListener('click', () => { seedDemo(); mode = 'demo'; enterApp(); });
  $('demo-signup').addEventListener('click', () => leaveDemo(true));
  function leaveDemo(signup) { mode = null; showAuth(signup ? 'up' : null); if (signup) $('email').focus(); }
  let signOutArmed = false;
  async function signOut() {
    if (pendingCount > 0 && !signOutArmed) {
      signOutArmed = true; setTimeout(() => (signOutArmed = false), 6000);
      toast(`${plural(pendingCount, 'change')} hasn't synced yet. Go online first, or tap Sign out again to discard.`);
      return;
    }
    signOutArmed = false;
    clearLocalCopy();
    if (Notes) Notes.cancel({ notifications: [{ id: REMINDER_ID }] }).catch(() => {});
    try { await sb.auth.signOut({ scope: 'local' }); } catch {}
    session = null; mode = null; drawOffline(); showAuth('in');
  }

  // ---------- phone app: back button and coming back to the app ----------
  const AppPlugin = plugin('App');
  if (AppPlugin) {
    AppPlugin.addListener('backButton', () => {
      if (openSheetEls().length) { closeTop(); return; }
      if (!$('app').hidden && tab !== 'home') { setTab('home'); return; }
      AppPlugin.exitApp();
    }).catch(() => {});
    AppPlugin.addListener('appStateChange', (st) => { if (st.isActive && mode === 'remote') backOnline(); }).catch(() => {});
  }

  // ---------- start ----------
  drawAuthMode();
  // keep exchange rates fresh when a non-dollar currency is picked
  if (prefs.currency !== '$') loadRates(false).then((ok) => { if (ok && !$('app').hidden) { heroShown = null; render(); } });
  (async () => {
    const fromResetLink = /type=recovery/.test(location.hash + location.search);
    let recovering = false;
    if (window.supabase && window.supabase.createClient) {
      sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { flowType: 'implicit', detectSessionInUrl: !NATIVE } });
      sb.auth.onAuthStateChange((evt, s) => {
        if (evt === 'PASSWORD_RECOVERY') recovering = true;
        if (mode !== 'remote') return;
        if (s) session = s;
        if (evt === 'SIGNED_OUT') { session = null; mode = null; showAuth('in'); }
      });
      try {
        const { data, error } = await sb.auth.getSession();
        session = data.session;
        // Offline with an expired sign-in: open the copy saved on this device instead of
        // the sign-in screen, and finish signing in once the connection is back.
        if (!session && (!navigator.onLine || (error && isNetErr(error)))) {
          const stored = readJSON('sb-uvbadnjcisuzgypzqyub-auth-token', null);
          const u = stored && (stored.user || (stored.currentSession && stored.currentSession.user));
          if (u && readJSON(`tilly-cache-${u.id}`, null)) session = { user: u, access_token: stored.access_token, offlineOnly: true };
        }
      } catch {}
      if (/access_token=|type=recovery/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
    }
    if (session) {
      mode = 'remote'; enterApp();
      if (recovering || fromResetLink) { openPasswordSheet(true); toast('Signed in from your reset link'); }
    }
    else if (location.hash === '#demo') { seedDemo(); mode = 'demo'; enterApp(); }
    else {
      showAuth();
      if (fromResetLink) { $('auth-err').textContent = 'That reset link has expired or was already used. Request a new one.'; }
    }
    // back from Stripe Checkout
    const proParam = new URLSearchParams(location.search).get('pro');
    if (proParam) {
      history.replaceState(null, '', location.pathname + location.hash);
      if (proParam === 'success' && mode === 'remote') afterCheckout();
      else if (proParam === 'cancel') toast('Checkout cancelled. You were not charged.');
    }
  })();
  if (!NATIVE && 'serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((r) => r.update()).catch(() => {});
})();
