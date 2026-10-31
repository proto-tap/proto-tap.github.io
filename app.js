// Rows and commands come from real sessions of each tool against its example/ traffic.

const INSERT = 'INSERT INTO users (name, email) VALUES ($1, $2) ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name';
const JOIN = 'SELECT u1.id, u1.name, u1.created_at, u2.id AS other_id, u2.name AS other_name, u2.created_at AS other_created_at, COUNT(*) OVER () AS total FROM users u1';
const USER = 'SELECT name FROM users WHERE id = $1';

function sqlRow(op, query, dur, opts = {}) {
  return { ...opts, cells: [op, query, dur], detail: [['Op:', op], ['Query:', query], ['Args:', opts.args ?? '[]'], ['Duration:', dur]] };
}

function httpRow(method, path, status, text, dur, gap) {
  const statusClass = status >= 500 ? 'bad' : status >= 400 ? 'warn' : 'ok';
  const methodClass = status >= 500 || method === 'DELETE' ? 'bad' : method === 'POST' ? 'post' : 'ok';
  return {
    gap,
    cells: [[method, methodClass], path, [status, statusClass], dur],
    detail: [['Method:', method], ['Path:', path], ['Status:', `${status} ${text}`], ['Duration:', dur]],
  };
}

function grpcRow(proto, method, status, dur, gap) {
  const path = `/echo.v1.EchoService/${method}`;
  return {
    gap,
    cells: [proto, path, [status, status === 'OK' ? 'ok' : 'bad'], dur],
    detail: [['Method:', path], ['Protocol:', proto], ['Status:', status], ['Duration:', dur]],
  };
}

const TOOLS = {
  sql: {
    color: '#4ec9b0',
    noun: 'query',
    plural: 'queries',
    backend: 'PostgreSQL',
    daemon: 'sql-tapd',
    install: 'brew install --cask proto-tap/tap/sql-tap',
    head: ['Op', 'Query', 'Duration', 'Time', ''],
    timeAt: 3,
    help: 'q: quit  j/k: navigate  space: toggle tx  enter: inspect  a: analytics  t: timeline  c/C: copy  x/X: explain',
    step1: 'DATABASE_URL="postgres://user:pass@localhost:5432/db?sslmode=disable" \\\n  sql-tapd --driver=postgres --listen=:5433 --upstream=localhost:5432',
    step1Note: 'The daemon forwards traffic to your backend and captures it on the way through.',
    step2: 'DATABASE_URL="postgres://user:pass@localhost:5433/db?sslmode=disable"',
    step2Note: "Change the port and nothing else. sql-tapd speaks the native wire protocol, so your driver doesn't notice.",
    step3: 'sql-tap localhost:9091',
    step3Note: 'Add --http=:8080 to the daemon to get the Web UI in your browser too.',
    rows: [
      sqlRow('Execute', INSERT, '11.5ms', { args: '[user-1, user-1@example.com]' }),
      sqlRow('Execute', 'SELECT COUNT(*) FROM users', '2.6ms'),
      sqlRow('Begin', 'begin', '312µs', { nested: true, tx: ['1 query', '17.0ms'] }),
      sqlRow('Execute', 'UPDATE users SET name = $1 WHERE name = $2', '569µs', { nested: true, args: '[user-1-updated, user-1]' }),
      sqlRow('Commit', 'commit', '15.2ms', { nested: true }),
      sqlRow('Execute', JOIN, '2.7ms', { args: '[%user-1%]' }),
      sqlRow('Execute', 'SELECT name FROM projects WHERE id = $1', '246µs', { args: '[a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11]' }),
      sqlRow('Execute', USER, '479µs', { args: '[1]', gap: 170 }),
      sqlRow('Execute', USER, '277µs', { args: '[2]', gap: 170 }),
      sqlRow('Execute', USER, '258µs', { args: '[3]', gap: 170 }),
      sqlRow('Execute', USER, '206µs', { args: '[4]', gap: 170 }),
      sqlRow('Execute', USER, '191µs', { args: '[5]', gap: 170, mark: ['N+1', 'warn'] }),
      sqlRow('Execute', USER, '197µs', { args: '[6]', gap: 170, mark: ['N+1', 'warn'] }),
      sqlRow('Execute', USER, '143µs', { args: '[7]', mark: ['N+1', 'warn'] }),
      sqlRow('Execute', 'SELECT pg_sleep(0.15)', '153.5ms', { mark: ['SLOW', 'slow'] }),
    ],
  },
  http: {
    color: '#e5c07b',
    noun: 'request',
    plural: 'requests',
    backend: 'HTTP server',
    daemon: 'http-tapd',
    install: 'brew install --cask proto-tap/tap/http-tap',
    head: ['Method', 'Path', 'Status', 'Duration', 'Time'],
    timeAt: 4,
    help: 'q: quit  j/k: navigate  enter: inspect  /: search  s: sort  e: errors  a: analytics  w: write',
    step1: 'http-tapd -listen :8080 -upstream http://localhost:9000 -http :8081',
    step1Note: 'The daemon forwards traffic to your server and captures it on the way through.',
    step2: 'API_URL="http://localhost:8080"',
    step2Note: 'Change the port and nothing else. http-tapd is a transparent reverse proxy.',
    step3: 'http-tap localhost:9090',
    step3Note: 'Or open http://localhost:8081 for the Web UI.',
    rows: [
      httpRow('GET', '/api/users', 200, 'OK', '176µs', 420),
      httpRow('GET', '/api/users/3', 200, 'OK', '184µs', 420),
      httpRow('POST', '/api/users', 201, 'Created', '121µs', 420),
      httpRow('GET', '/api/slow', 200, 'OK', '645.4ms'),
      httpRow('GET', '/api/users', 200, 'OK', '219µs', 420),
      httpRow('GET', '/api/users/1', 200, 'OK', '137µs', 420),
      httpRow('POST', '/api/users', 201, 'Created', '163µs', 420),
      httpRow('GET', '/api/slow', 200, 'OK', '1.03s'),
      httpRow('GET', '/api/error', 500, 'Internal Server Error', '158µs', 420),
      httpRow('DELETE', '/api/users/999', 404, 'Not Found', '147µs', 420),
      httpRow('POST', '/api/users', 400, 'Bad Request', '181µs'),
    ],
  },
  grpc: {
    color: '#9db4f5',
    noun: 'call',
    plural: 'calls',
    backend: 'gRPC server',
    daemon: 'grpc-tapd',
    install: 'brew install --cask proto-tap/tap/grpc-tap',
    head: ['Proto', 'Method', 'Status', 'Duration', 'Time'],
    timeAt: 4,
    help: 'q: quit  j/k: navigate  enter: inspect  /: search  s: sort  e: errors  a: analytics  w: write',
    step1: 'grpc-tapd -listen=:8080 -upstream=http://localhost:9000 -http=:8081',
    step1Note: 'The daemon forwards traffic to your server and captures it on the way through.',
    step2: 'GRPC_TARGET="localhost:8080"',
    step2Note: 'Change the port and nothing else. grpc-tapd speaks gRPC, gRPC-Web, and Connect.',
    step3: 'grpc-tap localhost:9092',
    step3Note: 'Or open http://localhost:8081 for the Web UI.',
    rows: [
      grpcRow('gRPC', 'Echo', 'OK', '404µs', 420),
      grpcRow('Connect', 'Echo', 'OK', '467µs', 420),
      grpcRow('Connect', 'Upper', 'OK', '273µs', 420),
      grpcRow('gRPC', 'Reverse', 'OK', '183µs'),
      grpcRow('gRPC', 'Echo', 'OK', '501µs', 420),
      grpcRow('Connect', 'Echo', 'OK', '285µs', 420),
      grpcRow('Connect', 'Upper', 'OK', '556µs', 420),
      grpcRow('gRPC', 'Reverse', 'OK', '432µs', 420),
      grpcRow('gRPC', 'Echo', 'ERR(3)', '184µs'),
    ],
  },
};

const VISIBLE_ROWS = 12;
const PIPE_SPEED = 0.46; // px per ms
const DEFAULT_GAP = 880;

const root = document.documentElement;
const line = document.querySelector('.line');
const lip = document.querySelector('.tap');
const term = document.querySelector('.term .win');
const rowsEl = document.querySelector('[data-tui="rows"]');
const detailEl = document.querySelector('[data-tui="detail"]');
const titleEl = document.querySelector('[data-tui="title"]');
const headEl = document.querySelector('[data-tui="head"]');
const helpEl = document.querySelector('[data-tui="help"]');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

let tool = TOOLS.sql;
let cursor = 0;
let captured = 0;
let heroVisible = true;
let timer;
const live = new Set();

function span(value) {
  const el = document.createElement('span');
  const [text, cls] = Array.isArray(value) ? value : [value];
  el.textContent = text ?? '';
  if (cls) el.className = cls;
  return el;
}

function clock(offset = 0) {
  const now = new Date(Date.now() + offset);
  const pad = (n, len = 2) => String(n).padStart(len, '0');
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}.${pad(now.getMilliseconds(), 3)}`;
}

function rowElement(cells, { current = false, nested = false, cls = '' } = {}) {
  const li = document.createElement('li');
  li.className = `row ${cls}`;
  li.classList.toggle('current', current);
  li.classList.toggle('nested', nested);
  li.append(span(current ? '▶' : ''), ...cells.map(span));
  return li;
}

function renderDetail(row) {
  detailEl.replaceChildren(...row.detail.flatMap(([key, value]) => {
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = key;
    dd.textContent = value;
    return [dt, dd];
  }));
}

function cellsFor(row, time) {
  const cells = [...row.cells];
  cells.splice(tool.timeAt, 0, time);
  if (cells.length < tool.head.length) cells.push(row.mark ?? '');
  return cells;
}

function append(row, offset = 0, fresh = false) {
  rowsEl.querySelector('.current')?.classList.remove('current');
  const previous = rowsEl.querySelector('.row:last-child > :first-child');
  if (previous) previous.textContent = '';
  if (row.tx) {
    rowsEl.append(rowElement([['▾ Tx', 'tx'], row.tx[0], row.tx[1], clock(offset), ''], {}));
  }
  const el = rowElement(cellsFor(row, clock(offset)), { current: true, nested: row.nested, cls: fresh ? 'fresh' : '' });
  rowsEl.append(el);
  while (rowsEl.children.length > VISIBLE_ROWS) rowsEl.firstElementChild.remove();
  captured += 1;
  titleEl.textContent = `${tool.daemon.slice(0, -1)} (${captured} ${captured === 1 ? tool.noun : tool.plural})`;
  renderDetail(row);
}

function seed() {
  rowsEl.replaceChildren();
  captured = 40 + Math.floor(Math.random() * 160);
  const count = VISIBLE_ROWS - 3;
  cursor = 0;
  for (let i = 0; i < count; i += 1) {
    append(tool.rows[i % tool.rows.length], (i - count) * 300);
    cursor = (i + 1) % tool.rows.length;
  }
}

function later(ms, fn) {
  const id = setTimeout(() => {
    live.delete(id);
    fn();
  }, ms);
  live.add(id);
}

function run(el, frames, options, done) {
  line.append(el);
  const anim = el.animate(frames, options);
  live.add(anim);
  anim.onfinish = () => {
    live.delete(anim);
    el.remove();
    done?.();
  };
}

function block(cls) {
  const el = document.createElement('div');
  el.className = cls;
  return el;
}

function drop(row, x) {
  const box = line.getBoundingClientRect();
  const fall = term.getBoundingClientRect().top - box.top;
  const start = lip.getBoundingClientRect().bottom - box.top - 4;
  run(block('drip'), [
    { transform: `translate(${x}px, ${start}px) scale(1)`, opacity: 1 },
    { transform: `translate(${x}px, ${fall - 10}px) scale(.55)`, opacity: .45 },
  ], { duration: 340, easing: 'cubic-bezier(.5, 0, 1, .55)' }, () => append(row, 0, true));
}

function emit(row) {
  const width = line.clientWidth;
  const tap = lip.getBoundingClientRect();
  const x = tap.left + tap.width / 2 - line.getBoundingClientRect().left - 9;
  run(block('pkt'), [
    { transform: 'translateX(-24px)' },
    { transform: `translateX(${width + 24}px)` },
  ], { duration: (width + 48) / PIPE_SPEED });
  later((x + 24) / PIPE_SPEED, () => drop(row, x));
}

function stop() {
  clearTimeout(timer);
  timer = undefined;
}

function pump() {
  if (reducedMotion.matches || !heroVisible || document.hidden) {
    stop();
    return;
  }
  const row = tool.rows[cursor];
  cursor = (cursor + 1) % tool.rows.length;
  emit(row);
  timer = setTimeout(pump, row.gap ?? DEFAULT_GAP);
}

function start() {
  if (timer === undefined) pump();
}

function clearFlow() {
  stop();
  for (const item of live) {
    if (typeof item === 'number') clearTimeout(item);
    else item.cancel();
  }
  live.clear();
  line.querySelectorAll('.pkt, .drip').forEach((el) => el.remove());
}

function setTool(id) {
  clearFlow();
  tool = TOOLS[id];
  root.dataset.tool = id;
  document.querySelector('meta[name="theme-color"]').content = tool.color;
  document.querySelectorAll('[data-text]').forEach((el) => {
    el.textContent = tool[el.dataset.text];
  });
  headEl.replaceChildren(span(''), ...tool.head.map(span));
  helpEl.textContent = tool.help;
  seed();
  start();
}

function setupTabs(list, onSelect) {
  const tabs = [...list.querySelectorAll('[role="tab"]')];
  const select = (tab) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      const panel = t.getAttribute('aria-controls');
      if (panel) document.getElementById(panel).hidden = !on;
    });
    onSelect?.(tab);
  };
  tabs.forEach((tab, i) => {
    tab.tabIndex = tab.getAttribute('aria-selected') === 'true' ? 0 : -1;
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', (event) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      if (!step) return;
      event.preventDefault();
      const next = tabs[(i + step + tabs.length) % tabs.length];
      next.focus();
      select(next);
    });
  });
}

function setupCopy(button) {
  const code = button.parentElement.querySelector('code');
  let reset;
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(code.textContent);
      button.textContent = 'Copied';
    } catch {
      getSelection().selectAllChildren(code);
      button.textContent = 'Selected';
    }
    clearTimeout(reset);
    reset = setTimeout(() => { button.textContent = 'Copy'; }, 1600);
  });
}

document.querySelectorAll('[role="tablist"]').forEach((list) => {
  const isToolSwitch = 'toolTabs' in list.dataset;
  setupTabs(list, isToolSwitch ? (tab) => setTool(tab.dataset.tool) : undefined);
});
document.querySelectorAll('.copy').forEach(setupCopy);

new IntersectionObserver(([entry]) => {
  heroVisible = entry.isIntersecting;
  start();
}).observe(document.querySelector('.hero'));
document.addEventListener('visibilitychange', start);
reducedMotion.addEventListener('change', start);

setTool('sql');
