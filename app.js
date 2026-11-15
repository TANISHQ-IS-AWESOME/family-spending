/* Tilly — who spent what. Accounts and data live in Supabase; each account only sees its own rows. */
(() => {
  'use strict';
  const SUPABASE_URL = 'https://uvbadnjcisuzgypzqyub.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_Lq6n-ZvzHKyYWGkEHp2EFw_jW2hU4HE';
  const ACCOUNT_FN = SUPABASE_URL + '/functions/v1/account';

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
  const money = (v) => (v < 0 ? '−$' : '$') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const fmtDate = (s) => { const [, m, d] = s.split('-').map(Number); return `${MON[m - 1]} ${d}`; };
  const fmtLong = (s) => { const [y, m, d] = s.split('-').map(Number); return `${DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ${MON[m - 1]} ${d}`; };
  const fmtMonth = (k) => { if (k === 'all') return 'All time'; const [y, m] = k.split('-').map(Number); return `${MONTHS[m - 1]} ${y}`; };
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const sum = (arr, f) => r2(arr.reduce((s, x) => s + Number(x[f] || 0), 0));
  const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
  const initial = (s) => ((s || '?').replace(/[^\p{L}\p{N}]/gu, '')[0] || '?').toUpperCase();
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const ls = { get(k) { try { return localStorage.getItem(k); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
  const toast = (msg) => { const t = $('toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 2800); };
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
    if (/(\bbag\b|deposit|donation|rounding|\bfee\b)/i.test(i)) return 'Miscellaneous';
    if (/(hvac|plumb|\brepair|water heater|lawn|mowing|roof|contractor|handyman|furnace|appliance|home depot|lowe'?s|pest control)/i.test(both)) return 'Home & repairs';
    if (/(\bbill\b|internet|electric|water bill|gas bill|verizon|comcast|xfinity|at&t|t-mobile|insurance|geico|\brent\b|mortgage|subscription|netflix|spotify|hulu|icloud|dominion)/i.test(both)) return 'Bills';
    if (/(ez ?pass|\btoll|fuel|gasoline|\bexxon|\bshell\b|\bbp\b|sunoco|\buber\b(?! ?eats)|\blyft\b|parking|metro|smartrip|car wash|oil change)/i.test(both)) return 'Transportation';
    if (/(restaurant|cafe|starbucks|dunkin|mcdonald|chipotle|pizza|office|doordash|uber ?eats|grubhub|panera|subway|chick-fil-a|taco bell|wendy|burger)/i.test(s) || /\b(meal|lunch|dinner|breakfast)\b/i.test(i)) return 'Food & dining';
    if (/(henna|shampoo|conditioner|\bsoap\b|lotion|toothpaste|toothbrush|deodorant|razor|makeup|cosmetic|hair ?cut|salon|vitamin|medicine|prescription|pharmacy|eye drops|tylenol|advil|floss|sunscreen|face wash|moisturizer)/i.test(i) || /(cvs|walgreens|ulta|sephora|pharmacy)/i.test(s)) return 'Personal';
    if (/(headphone|earbud|charger|cable|shirt|pants|shoes|socks|sweater|clothes|jacket|\btoy\b|\bbook\b|phone case|electronic|towel|bedsheet|decor|\bgift\b|\bpan\b|peeler|firework)/i.test(i) || /(amazon|target|best buy|macy|tj ?maxx|marshalls|ikea|old navy|kohl)/i.test(s)) return 'Shopping';
    if (GROCERY_STORES.test(s) || !s) return 'Groceries';
    return 'Miscellaneous';
  }

  // ---------- state ----------
  let sb = null, session = null, mode = null; // mode: 'remote' | 'demo'
  let profiles = [], purchases = [], taxes = [], loaded = false, loadError = false, imported = true;
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
  const remote = {
    async load() {
      const [pf, pu, tx, im] = await Promise.all([
        fetchAll('sp_profiles', 'id, name, color, created_at'),
        fetchAll('sp_purchases', 'id, profile_id, date, store, item, price, category'),
        fetchAll('sp_taxes', 'id, profile_id, date, store, tax'),
        sb.from('sp_imports').select('user_id').maybeSingle(),
      ]);
      imported = !!(im && im.data);
      return { profiles: pf.sort((a, b) => a.created_at.localeCompare(b.created_at)), purchases: pu.map((x) => ({ ...x, price: Number(x.price) })), taxes: tx.map((x) => ({ ...x, tax: Number(x.tax) })) };
    },
    async addProfile(name, color) { ok(await sb.from('sp_profiles').insert({ name, color })); },
    async updateProfile(id, name, color) { ok(await sb.from('sp_profiles').update({ name, color }).eq('id', id)); },
    async deleteProfile(id) { ok(await sb.from('sp_profiles').delete().eq('id', id)); },
    async addReceipt({ profile_id, date, store, items, tax }) {
      const receipt = 'r' + Date.now().toString(36);
      ok(await sb.from('sp_purchases').insert(items.map((i) => ({ profile_id, date, store, item: i.item, price: i.price, category: i.category, receipt }))));
      if (tax > 0) ok(await sb.from('sp_taxes').insert({ profile_id, date, store, tax, receipt }));
    },
    async deletePurchase(id) { ok(await sb.from('sp_purchases').delete().eq('id', id)); },
    async deleteTax(id) { ok(await sb.from('sp_taxes').delete().eq('id', id)); },
    async setCategory(id, category) { ok(await sb.from('sp_purchases').update({ category }).eq('id', id)); },
  };

  // ---------- data: demo (made-up sample data, kept in memory only) ----------
  const demoDb = { profiles: [], purchases: [], taxes: [], n: 0 };
  const did = () => 'd' + (++demoDb.n);
  function seedDemo() {
    demoDb.profiles = []; demoDb.purchases = []; demoDb.taxes = []; demoDb.n = 0;
    const [maya, jordan, house] = [['Maya', 'pink'], ['Jordan', 'blue'], ['Household', 'green']].map(([name, color], i) => {
      const p = { id: did(), name, color, created_at: '2026-01-0' + (i + 1) }; demoDb.profiles.push(p); return p.id;
    });
    const now = new Date();
    const day = (monthsBack, d) => { const x = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1); const last = monthsBack === 0 ? now.getDate() : new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate(); x.setDate(Math.max(1, Math.min(d, last))); return iso(x); };
    const receipts = [
      [maya, 0, 2, 'Sprouts', 0.84, [['Blueberries 18 oz', 8.99], ['Organic bananas (2.97 lb)', 2.35], ['Chicken thighs ×2', 29.10], ['Atlantic salmon portion', 13.76], ['Carrot juice ×2', 8.98], ['Bag charge ×2', 0.20]]],
      [jordan, 0, 3, 'Food Lion', 0.18, [['Large white eggs', 2.49], ['Broccoli crowns (1.89 lb)', 4.52], ['Organic spring mix', 2.99], ['Green grapes (2.19 lb)', 3.26], ['Greek yogurt ×2', 6.50]]],
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
      [house, 1, 26, 'Costco', 1.33, [['Kirkland chocolate bag', 23.99], ['Greek yogurt ×4', 29.96], ['Bananas ×3', 4.47], ['Laundry detergent', 19.99]]],
    ];
    for (const [profile_id, back, d, store, tax, items] of receipts) {
      const date = day(back, d);
      for (const [item, price] of items) demoDb.purchases.push({ id: did(), profile_id, date, store, item, price, category: guessCategory(item, store) });
      if (tax) demoDb.taxes.push({ id: did(), profile_id, date, store, tax });
    }
  }
  const demo = {
    async load() { return { profiles: demoDb.profiles.slice(), purchases: demoDb.purchases.slice(), taxes: demoDb.taxes.slice() }; },
    async addProfile(name, color) { demoDb.profiles.push({ id: did(), name, color, created_at: new Date().toISOString() }); },
    async updateProfile(id, name, color) { Object.assign(demoDb.profiles.find((p) => p.id === id), { name, color }); },
    async deleteProfile(id) { demoDb.profiles = demoDb.profiles.filter((p) => p.id !== id); demoDb.purchases = demoDb.purchases.filter((p) => p.profile_id !== id); demoDb.taxes = demoDb.taxes.filter((p) => p.profile_id !== id); },
    async addReceipt({ profile_id, date, store, items, tax }) {
      for (const i of items) demoDb.purchases.push({ id: did(), profile_id, date, store, item: i.item, price: i.price, category: i.category });
      if (tax > 0) demoDb.taxes.push({ id: did(), profile_id, date, store, tax });
    },
    async deletePurchase(id) { demoDb.purchases = demoDb.purchases.filter((p) => p.id !== id); },
    async deleteTax(id) { demoDb.taxes = demoDb.taxes.filter((p) => p.id !== id); },
    async setCategory(id, category) { demoDb.purchases.find((p) => p.id === id).category = category; },
  };
  const db = () => (mode === 'demo' ? demo : remote);

  async function refresh() {
    try {
      const d = await db().load();
      profiles = d.profiles; purchases = d.purchases; taxes = d.taxes;
      loaded = true; loadError = false;
      const months = monthList();
      if (month == null) month = months[0] || 'all';
      else if (month !== 'all' && !months.includes(month)) month = months[0] || 'all';
      if (filterProfile !== 'all' && !profileById(filterProfile)) filterProfile = 'all';
    } catch (e) {
      console.error(e);
      loadError = true;
    }
    render();
  }
  const monthList = () => [...new Set([...purchases, ...taxes].map((x) => (x.date || '').slice(0, 7)).filter(Boolean))].sort().reverse();

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

  // ---------- HOME ----------
  function viewHome() {
    const out = [];
    if (!profiles.length) {
      out.push(h('section', { class: 'card welcome' },
        h('span', { class: 'avatar xl round', c: 'var(--accent)' }, icon('profiles')),
        h('h2', { text: 'Start with a profile' }),
        h('p', { text: 'A profile is anyone or anything you want a separate total for: you, a partner, the household, a side business.' }),
        h('button', { class: 'btn primary', text: 'Create your first profile', onclick: () => openProfileSheet(null) }),
        mode === 'remote' && !imported && h('button', { class: 'link', text: 'Used the Family Spending app before? Bring your data over', onclick: () => setTab('profiles') })));
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
    out.push(h('section', { class: 'receipt', id: 'hero' },
      h('div', { class: 'receipt-top' }, h('span', { text: 'Tilly' }), h('span', { text: range })),
      h('p', { class: 'receipt-label', text: `Total spent · ${fmtMonth(month)}` }),
      num,
      h('p', { class: 'receipt-break', text: ps.length ? `items ${money(items)} + tax ${money(tax)}` : 'No receipts yet. Tap + to add one.' }),
      h('hr', { class: 'rule' }),
      pos.length ? split : null,
      pos.length ? h('div', { class: 'split-key' }, pos.map((t) => h('span', null, dot(colorVar(t.p.color)), t.p.name, h('b', { text: pct(t.total, posSum) + '%' })))) : null,
      h('div', { class: 'barcode', 'aria-hidden': 'true' })));
    animateNumber(num, r2(items + tax));

    out.push(h('div', { class: 'section-head' }, h('h2', { class: 'section-title', text: 'Profiles' }), h('span', { class: 'note', text: 'Before tax' })));
    const max = Math.max(1, ...totals.map((t) => t.total));
    out.push(h('div', { class: 'tiles' },
      totals.map((t) => h('button', { class: 'tile', c: colorVar(t.p.color), onclick: () => { filterProfile = t.p.id; setTab('receipts'); } },
        h('span', { class: 'tile-top' }, avatar(t.p.name, colorVar(t.p.color), 'round solid'), h('span', { class: 'tile-name', text: t.p.name })),
        h('span', { class: 'tile-amt', text: money(t.total) }),
        h('span', { class: 'tile-bar' }, h('i', { style: { width: Math.max(0, (t.total / max) * 100) + '%' } })),
        h('span', { class: 'tile-sub', text: `${pct(Math.max(0, t.total), Math.max(posSum, 0.01))}% · ${plural(t.n, 'item')}` }))),
      h('button', { class: 'tile new', onclick: () => openProfileSheet(null) }, h('span', { class: 'plus' }, icon('plus')), 'New profile')));

    const slips = buildSlips(ps, ts).slice(0, 4);
    out.push(h('div', { class: 'section-head' }, h('h2', { class: 'section-title', text: 'Latest receipts' }), slips.length ? h('button', { class: 'link', text: 'See all', onclick: () => { filterProfile = 'all'; setTab('receipts'); } }) : null));
    out.push(slips.length ? h('div', { class: 'slips' }, slips.map((s) => slipEl(s, { compact: true }))) : h('div', { class: 'card empty', text: `Nothing in ${fmtMonth(month)} yet. Tap + to add a receipt.` }));
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
    const legend = () => h('div', { class: 'legend' }, profiles.map((p) => h('span', null, dot(colorVar(p.color)), p.name)));

    // categories
    const cats = h('div', { class: 'cats' });
    const rows = CATS.map((c) => ({ c, its: ps.filter((p) => catInfo(p.category).name === c.name) })).filter((r) => r.its.length).map((r) => ({ ...r, total: sum(r.its, 'price') })).sort((a, b) => b.total - a.total);
    const cmax = Math.max(1, ...rows.map((r) => r.total));
    for (const r of rows) {
      const open = openCats.has(r.c.name);
      const sub = h('span', { class: 'cat-sub' }, h('span', { text: plural(r.its.length, 'item') }),
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
      h('span', { class: 'day-amt', text: '$' + Math.round(r.total).toLocaleString('en-US') }),
      h('div', { class: 'day-col' }, profiles.filter((p) => r.by[p.id] > 0).map((p) => h('i', { c: colorVar(p.color), style: { height: Math.max(2, (r.by[p.id] / dmax) * 110) + 'px' } }))),
      h('span', { class: 'day-lbl', text: fmtDate(r.k) }))));

    return [
      h('div', { class: 'section-head' }, h('h2', { class: 'section-title', text: 'Insights' }), h('span', { class: 'note', text: fmtMonth(month) })),
      card('By category', "Before tax. Tap a category to see what's in it.", cats),
      storeCard,
      card('By day', 'Before tax, split by profile.', drows.length ? days : h('p', { class: 'empty', text: `Nothing in ${fmtMonth(month)}.` }), legend()),
      card('Tax', 'Sales tax from receipts, kept separate from item totals.', stats),
      card('Month by month', 'With tax. Tap a month to view it.', months),
    ];
  }

  // ---------- PROFILES & ACCOUNT ----------
  function viewProfiles() {
    const list = h('div', { class: 'plist' }, profiles.map((p) => {
      const n = purchases.filter((x) => x.profile_id === p.id);
      return h('div', { class: 'prow' }, avatar(p.name, colorVar(p.color), 'round solid'),
        h('div', { style: { minWidth: 0 } }, h('div', { class: 'prow-name', text: p.name }), h('div', { class: 'prow-sub', text: `${money(sum(n, 'price'))} · ${plural(n.length, 'item')} all time` })),
        h('button', { class: 'btn ghost small', text: 'Edit', onclick: () => openProfileSheet(p) }));
    }));
    if (!profiles.length) list.append(h('p', { class: 'empty', text: 'No profiles yet.' }));
    const out = [
      h('div', { class: 'section-head' }, h('h2', { class: 'section-title', text: 'Profiles' })),
      h('section', { class: 'card' }, list, h('button', { class: 'btn primary', style: { marginTop: '14px' }, onclick: () => openProfileSheet(null) }, icon('plus'), 'New profile')),
    ];
    if (mode === 'demo') {
      out.push(card('Like what you see?', 'Create a free account to track your own receipts.', h('button', { class: 'btn primary', text: 'Create account', onclick: () => leaveDemo(true) }), h('button', { class: 'btn ghost', style: { marginTop: '10px' }, text: 'Leave the demo', onclick: () => leaveDemo(false) })));
      return out;
    }
    const acct = h('div', { class: 'acct' }, h('div', null, h('div', { class: 'note', text: 'Signed in as' }), h('div', { class: 'acct-email', text: (session && session.user && session.user.email) || '' })),
      h('button', { class: 'btn ghost', text: 'Sign out', onclick: signOut }));
    out.push(card('Account', null, acct));
    if (!imported) {
      const input = h('input', { class: 'input', type: 'password', placeholder: 'Family passcode', 'aria-label': 'Family passcode', autocomplete: 'off' });
      const status = h('p', { class: 'status', 'aria-live': 'polite' });
      const btn = h('button', { class: 'btn primary', text: 'Import' });
      btn.addEventListener('click', async () => {
        if (!input.value.trim()) { status.className = 'status err'; status.textContent = 'Enter the family passcode first.'; return; }
        btn.disabled = true; status.className = 'status'; status.replaceChildren(h('span', { class: 'spin' }), 'Bringing your receipts over…');
        try {
          const res = await fetch(ACCOUNT_FN, { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + session.access_token }, body: JSON.stringify({ action: 'import_legacy', passcode: input.value.trim() }) });
          const d = await res.json().catch(() => ({}));
          if (!res.ok) throw { code: d.error };
          toast(`Imported ${d.purchases} items`);
          month = null; await refresh(); setTab('home');
        } catch (e) {
          btn.disabled = false; status.className = 'status err';
          status.textContent = e.code === 'wrong_passcode' ? "That passcode didn't match." : e.code === 'already_imported' ? 'This account already imported that data.' : "Couldn't import right now. Check your connection and try again.";
        }
      });
      out.push(card('Coming from Family Spending?', 'Enter the family passcode from the old app to copy its receipts into this account. Mom and Dad are added as profiles.', h('div', { class: 'import-row' }, input, btn), status));
    }
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
    const kids = tab === 'receipts' ? viewReceipts() : tab === 'insights' ? viewInsights() : tab === 'profiles' ? viewProfiles() : viewHome();
    view.replaceChildren(...kids.filter(Boolean));
    if (keepFocus && $('receipt-search')) { const i = $('receipt-search'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
  }
  function setTab(name) {
    if (!['home', 'receipts', 'insights', 'profiles'].includes(name)) name = 'home';
    const changed = tab !== name;
    tab = name; editing = false;
    if (name !== 'receipts') query = '';
    if (location.hash.slice(1) !== name) history.replaceState(null, '', '#' + name);
    render();
    if (changed) window.scrollTo(0, 0);
  }
  document.querySelectorAll('.tabs [data-tab]').forEach((b) => b.addEventListener('click', () => { if (b.dataset.tab === 'receipts' && tab !== 'receipts') filterProfile = 'all'; setTab(b.dataset.tab); }));
  $('month').addEventListener('change', (e) => { month = e.target.value; render(); });
  window.addEventListener('hashchange', () => { if ($('app').hidden) return; const t = location.hash.slice(1); if (t && t !== tab) setTab(t); });

  // ---------- sheets ----------
  const openSheet = (id) => { $(id).hidden = false; const x = $(id).querySelector('[data-close]'); if (x) x.focus(); };
  const closeSheets = () => document.querySelectorAll('.sheet-bg').forEach((s) => (s.hidden = true));
  document.querySelectorAll('.sheet-bg').forEach((bg) => {
    bg.addEventListener('click', (e) => { if (e.target === bg) closeSheets(); });
    bg.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeSheets));
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheets(); });

  // profile editor
  let pfEditing = null, pfColor = 'pink';
  function drawPfPreview() {
    const a = $('pf-avatar'); a.textContent = initial($('pf-name').value); a.className = 'avatar xl solid'; a.style.setProperty('--c', colorVar(pfColor));
    $('pf-colors').querySelectorAll('.swatch').forEach((s) => s.setAttribute('aria-checked', String(s.dataset.color === pfColor)));
  }
  $('pf-colors').append(...COLORS.map((c) => h('button', { type: 'button', class: 'swatch', role: 'radio', c: colorVar(c), 'data-color': c, 'aria-label': c, onclick: () => { pfColor = c; drawPfPreview(); } })));
  $('pf-name').addEventListener('input', drawPfPreview);
  function openProfileSheet(p) {
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
  $('open-add').addEventListener('click', () => {
    if (!loaded) return;
    if (!profiles.length) { toast('Create a profile first'); openProfileSheet(null); return; }
    photo = null; receiptTotal = null;
    $('preview').hidden = true; $('scan-status').textContent = ''; $('scan-status').className = 'status';
    showReview(false);
    $('lines').replaceChildren(); $('r-store').value = ''; $('r-date').value = iso(new Date()); $('r-tax').value = '0';
    $('save-status').textContent = ''; $('save-status').className = 'status';
    addFor = filterProfile !== 'all' && tab === 'receipts' ? filterProfile : profiles.length === 1 ? profiles[0].id : null;
    drawAddWho();
    openSheet('sheet-add');
  });
  function onPhoto(e) {
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if (!f) return;
    photo = f;
    const img = $('preview-img'); if (img.src) URL.revokeObjectURL(img.src); img.src = URL.createObjectURL(f);
    $('preview').hidden = false; $('scan-status').textContent = ''; $('scan-status').className = 'status';
  }
  $('cam').addEventListener('change', onPhoto);
  $('pick').addEventListener('change', onPhoto);
  function addLine(item = '', price = '') {
    const name = h('input', { class: 'input', type: 'text', value: item, placeholder: 'Item', 'aria-label': 'Item', maxLength: 200 });
    const p = h('input', { class: 'input price', type: 'number', step: '0.01', inputMode: 'decimal', value: price === '' ? '' : Number(price).toFixed(2), placeholder: '0.00', 'aria-label': 'Price' });
    const x = h('button', { type: 'button', class: 'rm', text: '✕', 'aria-label': 'Remove line' });
    const cs = catSelect(guessCategory(item, $('r-store').value)); cs.dataset.auto = '1';
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
    $('sum').replaceChildren(row(`Items (${lines.length})`, money(items)), row('Tax', money(tax)), row('Total', money(r2(items + tax)), true));
    if (receiptTotal != null && Math.abs(r2(items + tax) - receiptTotal) > 0.02) $('sum').append(h('p', { class: 'warn', text: `The receipt says ${money(receiptTotal)}. Check the lines before adding.` }));
    const bad = lines.some((l) => !l.item || isNaN(l.price));
    $('save').disabled = !addFor || !lines.length || bad || !/^\d{4}-\d{2}-\d{2}$/.test($('r-date').value);
    const p = profileById(addFor);
    $('save').textContent = p ? `Add to ${p.name}` : 'Pick a profile first';
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
    const date = $('r-date').value, who = profileById(addFor);
    try {
      await db().addReceipt({ profile_id: addFor, date, store: $('r-store').value.trim(), items: lines.map((l) => ({ item: l.item, price: r2(l.price), category: l.category })), tax: r2(Number($('r-tax').value) || 0) });
      closeSheets(); toast(`Added ${plural(lines.length, 'item')} to ${who ? who.name : 'profile'}`);
      if (month !== 'all') month = date.slice(0, 7);
      await refresh();
    } catch { st.className = 'status err'; st.textContent = "Couldn't add the receipt. Check your connection and try again."; btn.disabled = false; }
  });

  // ---------- sign in / sign up / demo ----------
  let authMode = ls.get('tilly-returning') ? 'in' : 'up';
  function drawAuthMode() {
    $('mode-in').setAttribute('aria-selected', String(authMode === 'in'));
    $('mode-up').setAttribute('aria-selected', String(authMode === 'up'));
    $('auth-submit').textContent = authMode === 'in' ? 'Sign in' : 'Create account';
    $('password').autocomplete = authMode === 'in' ? 'current-password' : 'new-password';
    $('auth-err').textContent = '';
  }
  $('mode-in').addEventListener('click', () => { authMode = 'in'; drawAuthMode(); });
  $('mode-up').addEventListener('click', () => { authMode = 'up'; drawAuthMode(); });
  function showAuth(m) { if (m) authMode = m; drawAuthMode(); $('app').hidden = true; $('auth').hidden = false; closeSheets(); window.scrollTo(0, 0); }
  function enterApp() {
    $('auth').hidden = true; $('app').hidden = false; $('demo-banner').hidden = mode !== 'demo';
    loaded = false; loadError = false; month = null; filterProfile = 'all'; heroShown = null; profiles = []; purchases = []; taxes = [];
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
    try {
      if (authMode === 'up') {
        const res = await fetch(ACCOUNT_FN, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'signup', email, password }) });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw { code: d.error || 'server_error' };
      }
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw { code: /invalid/i.test(error.message) ? 'bad_login' : 'server_error' };
      session = data.session; mode = 'remote'; ls.set('tilly-returning', '1');
      $('password').value = '';
      enterApp();
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
  $('try-demo').addEventListener('click', () => { seedDemo(); mode = 'demo'; enterApp(); });
  $('demo-signup').addEventListener('click', () => leaveDemo(true));
  function leaveDemo(signup) { mode = null; showAuth(signup ? 'up' : null); if (signup) $('email').focus(); }
  async function signOut() { try { await sb.auth.signOut(); } catch {} session = null; mode = null; showAuth('in'); }

  // ---------- start ----------
  drawAuthMode();
  (async () => {
    if (window.supabase && window.supabase.createClient) {
      sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      try {
        const { data } = await sb.auth.getSession();
        session = data.session;
        sb.auth.onAuthStateChange((evt, s) => { if (mode !== 'remote') return; session = s; if (evt === 'SIGNED_OUT') { mode = null; showAuth('in'); } });
      } catch {}
    }
    if (session) { mode = 'remote'; enterApp(); }
    else if (location.hash === '#demo') { seedDemo(); mode = 'demo'; enterApp(); }
    else showAuth();
  })();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
