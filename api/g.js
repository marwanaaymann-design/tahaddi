// واجهة اللعب أونلاين. بتقرا رابط الداتابيز من المتغير DATABASE_URL (مش مكتوب في الكود).
const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');
let sql, ready;
const q = (t, p) => sql.query(t, p || []);
const rid = (n, a) => Array.from({ length: n }, () => a[Math.floor(Math.random() * a.length)]).join('');
async function init() {
  if (ready) return ready;
  sql = neon(process.env.DATABASE_URL);
  ready = (async () => {
    await q(`create table if not exists rooms(code text primary key, token text not null, state jsonb not null default '{}'::jsonb, ver int not null default 0, created timestamptz not null default now())`);
    await q(`create table if not exists players(id text primary key, room text not null, name text not null, team int not null, joined timestamptz not null default now())`);
    await q(`create table if not exists events(id bigserial primary key, room text not null, kind text not null, pid text, name text, team int, body text, bellkey text, ts timestamptz not null default clock_timestamp())`);
    await q(`create table if not exists users(username text primary key, salt text not null, hash text not null, stats jsonb not null default '{}'::jsonb, created timestamptz not null default now())`);
    await q(`create table if not exists sessions(token text primary key, username text not null, created timestamptz not null default now())`);
    await q(`create table if not exists memo(username text primary key, data jsonb not null default '{}'::jsonb, updated timestamptz)`);
    await q(`alter table users add column if not exists av text`);
    await q(`alter table users add column if not exists avv int not null default 0`);
    await q(`create index if not exists ev_room on events(room, id)`);
    await q(`create unique index if not exists ev_bell on events(room, bellkey) where kind = 'bell'`);
  })();
  try { await ready; } catch (e) { ready = null; throw e; }
}
const clip = (s, n) => String(s == null ? '' : s).slice(0, n);

const hashPw = (pw, salt) => crypto.scryptSync(pw, salt, 64).toString('hex');
const LIM = { m: 1, w: 1, sw: 5, a: 80, c: 80, ts: 4000, tn: 80, b: 40 };
async function account(b) {
  const a = b.a;
  if (a === 'register' || a === 'login') {
    const u = clip(b.username, 20).trim().toLowerCase(), pw = clip(b.password, 100);
    if (!/^[a-z0-9_\u0600-\u06FF]{3,20}$/.test(u)) return { err: 'اسم المستخدم 3 إلى 20 حرف أو رقم (من غير مسافات)' };
    if (a === 'register') {
      if (pw.length < 6) return { err: 'الباسورد لازم 6 حروف على الأقل' };
      if ((await q('select 1 from users where username=$1', [u]))[0]) return { err: 'الاسم ده مستخدم، اختار غيره' };
      const salt = crypto.randomBytes(16).toString('hex');
      await q('insert into users(username,salt,hash) values($1,$2,$3)', [u, salt, hashPw(pw, salt)]);
    } else {
      const r = (await q('select salt,hash from users where username=$1', [u]))[0];
      const ok = r && crypto.timingSafeEqual(Buffer.from(hashPw(pw, r.salt), 'hex'), Buffer.from(r.hash, 'hex'));
      if (!ok) return { err: 'اسم المستخدم أو الباسورد غلط' };
    }
    const token = crypto.randomBytes(24).toString('hex');
    await q('insert into sessions(token,username) values($1,$2)', [token, u]);
    const st = (await q('select stats from users where username=$1', [u]))[0].stats;
    return { username: u, token, stats: st };
  }
  const who = async t => (await q('select username from sessions where token=$1', [clip(t, 80)]))[0];
  if (a === 'me') { const s = await who(b.token); if (!s) return { err: 'auth' }; const ur = (await q('select stats,av,avv from users where username=$1', [s.username]))[0]; return { username: s.username, stats: ur.stats, av: ur.av || '', avv: ur.avv || 0 }; }
  if (a === 'setavatar') {
    const s = await who(b.token); if (!s) return { err: 'auth' };
    const d = clip(b.data, 14001);
    if (d && !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/.test(d)) return { err: 'bad' };
    if (d.length > 14000) return { err: 'big' };
    const r = (await q('update users set av=$2, avv=avv+1 where username=$1 returning avv', [s.username, d]))[0];
    return { ok: 1, avv: r ? r.avv : 0 };
  }
  if (a === 'savestats') {
    const out = [];
    for (const it of (Array.isArray(b.items) ? b.items.slice(0, 4) : [])) {
      const s = await who(it.token); if (!s) { out.push(null); continue; }
      const cur = (await q('select stats from users where username=$1', [s.username]))[0].stats || {};
      const d = it.d || {};
      for (const k of Object.keys(LIM)) cur[k] = (Number(cur[k]) || 0) + Math.max(0, Math.min(LIM[k], Number(d[k]) || 0));
      await q('update users set stats=$2::jsonb where username=$1', [s.username, JSON.stringify(cur)]);
      out.push({ username: s.username, stats: cur });
    }
    return { items: out };
  }
  if (a === 'memoGet' || a === 'memoSet') {
    const s = await who(b.token); if (!s) return { err: 'auth' };
    if (a === 'memoGet') {
      const r = (await q('select data from memo where username=$1', [s.username]))[0];
      return { data: r ? r.data : {} };
    }
    const d = b.data;
    if (!d || typeof d !== 'object' || Array.isArray(d)) return { err: 'bad' };
    for (const k of Object.keys(d)) {
      if (k.length > 80 || !Array.isArray(d[k]) || d[k].some(x => !(typeof x === 'string' ? x.length <= 80 : Number.isFinite(x)))) return { err: 'bad' };
    }
    const js = JSON.stringify(d);
    if (Buffer.byteLength(js) > 200 * 1024) return { err: 'big' };
    await q('insert into memo(username,data,updated) values($1,$2::jsonb,now()) on conflict (username) do update set data=excluded.data, updated=now()', [s.username, js]);
    return { ok: 1 };
  }
  return null;
}
async function act(b) {
  if (['register','login','me','savestats','memoGet','memoSet','setavatar'].includes(b.a)) return await account(b);
  const a = b.a, code = clip(b.code, 8).toUpperCase();
  if (a === 'create') {
    await q(`delete from events where room in (select code from rooms where created < now() - interval '1 day')`);
    await q(`delete from players where room in (select code from rooms where created < now() - interval '1 day')`);
    await q(`delete from rooms where created < now() - interval '1 day'`);
    const c = rid(4, 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'), token = rid(24, 'abcdefghijklmnopqrstuvwxyz0123456789');
    await q('insert into rooms(code,token,state) values($1,$2,$3::jsonb)', [c, token, JSON.stringify(b.state || {})]);
    return { code: c, token };
  }
  if (a === 'list') {
    const rows = await q(`select r.code, r.state->>'auto' as auto, (select count(*)::int from players p where p.room=r.code) as n from rooms r where r.state->>'pub'='1' and r.state->>'lb'='true' and r.created > now() - interval '3 hours' order by r.created desc limit 20`);
    return { rooms: rows };
  }
  const r = (await q('select token,state,ver from rooms where code=$1', [code]))[0];
  if (!r) return { err: 'room' };
  if (a === 'join') {
    const sess = (await q('select username from sessions where token=$1', [clip(b.token, 80)]))[0];
    if (!sess) return { err: 'لازم تسجل دخول الأول' };
    const ex = (await q('select id from players where room=$1 and name=$2', [code, sess.username]))[0];
    if (ex) return { pid: ex.id };
    const id = rid(12, 'abcdefghijklmnopqrstuvwxyz0123456789');
    await q('insert into players(id,room,name,team) values($1,$2,$3,-1)', [id, code, sess.username]);
    return { pid: id };
  }
  const host = b.token && b.token === r.token;
  let me = null;
  if (!host) {
    me = (await q('select id,name,team from players where id=$1 and room=$2', [b.pid || '', code]))[0];
    if (!me) return { err: 'auth' };
  }
  if (a === 'publish') {
    if (!host) return { err: 'auth' };
    await q('update rooms set state=$2::jsonb, ver=ver+1 where code=$1', [code, JSON.stringify(b.state || {})]);
    return { ok: 1 };
  }
  if (a === 'saveroom') {
    if (!host) return { err: 'auth' };
    const out = [];
    for (const it of (Array.isArray(b.items) ? b.items.slice(0, 4) : [])) {
      const p = (await q('select name from players where id=$1 and room=$2', [clip(it.pid, 20), code]))[0];
      const u = p && (await q('select stats from users where username=$1', [p.name]))[0];
      if (!u) { out.push(null); continue; }
      const cur = u.stats || {}, d = it.d || {};
      for (const k of Object.keys(LIM)) cur[k] = (Number(cur[k]) || 0) + Math.max(0, Math.min(LIM[k], Number(d[k]) || 0));
      await q('update users set stats=$2::jsonb where username=$1', [p.name, JSON.stringify(cur)]);
      out.push({ username: p.name, stats: cur });
    }
    return { items: out };
  }
  if (a === 'poll') {
    const since = Number(b.since) || 0;
    const players = await q('select p.id,p.name,p.team,coalesce(u.avv,0) as avv from players p left join users u on u.username=p.name where p.room=$1 order by p.joined', [code]);
    const ev = host
      ? await q('select id,kind,name,team,body,bellkey from events where room=$1 and id>$2::bigint order by id limit 100', [code, since])
      : await q(`select id,kind,name,team,body from events where room=$1 and id>$2::bigint and kind in ('chat','host') and (team=$3 or team=-1) order by id limit 50`, [code, since, me.team]);
    const out = { players, events: ev, now: Date.now() };
    if (Number(b.ver) !== Number(r.ver)) { out.state = r.state; out.ver = r.ver; }
    return out;
  }
  if (a === 'getav') {
    const names = (Array.isArray(b.names) ? b.names : []).slice(0, 20).map(x => clip(x, 40));
    const rows = names.length ? await q('select p.name,u.av,u.avv from players p join users u on u.username=p.name where p.room=$1 and p.name = any($2::text[])', [code, names]) : [];
    const map = {};
    for (const x of rows) map[x.name] = { av: x.av || '', avv: x.avv || 0 };
    return { map };
  }
  if (a === 'setteam') {
    if (host || !me) return { err: 'auth' };
    const t = Number(b.team);
    if (![-1, 0, 1].includes(t)) return { err: 'bad' };
    if (t >= 0) {
      const c = (await q('select count(*)::int n from players where room=$1 and team=$2 and id<>$3', [code, t, me.id]))[0].n;
      if (c >= 10) return { err: 'full' };
    }
    await q('update players set team=$2 where id=$1', [me.id, t]);
    return { ok: 1 };
  }
  if (a === 'send') {
    const body = clip(b.body, 300);
    if (host) {
      const t = b.team === 0 || b.team === 1 ? b.team : -1;
      await q(`insert into events(room,kind,name,team,body) values($1,'host','الحكم',$2,$3)`, [code, t, body]);
      return { ok: 1 };
    }
    if (b.kind === 'bell') {
      const key = clip(b.key, 40);
      if (!key || !r.state || r.state.bk !== key) return { late: 1 };
      await q(`insert into events(room,kind,pid,name,team,bellkey) values($1,'bell',$2,$3,$4,$5) on conflict (room,bellkey) where kind='bell' do nothing`, [code, me.id, me.name, me.team, key]);
      const w = (await q(`select pid,name,team from events where room=$1 and kind='bell' and bellkey=$2`, [code, key]))[0];
      return { won: w && w.pid === me.id, winner: w ? w.name : null };
    }
    const kind = b.kind === 'answer' ? 'answer' : 'chat';
    if (!body.trim()) return { ok: 0 };
    await q('insert into events(room,kind,pid,name,team,body) values($1,$2,$3,$4,$5,$6)', [code, kind, me.id, me.name, me.team, body]);
    return { ok: 1 };
  }
  return { err: 'bad' };
}
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method !== 'POST') return res.status(405).json({ err: 'post' });
    if (!process.env.DATABASE_URL) return res.status(500).json({ err: 'نسيت تضيف DATABASE_URL في فيرسل' });
    await init();
    let b = req.body; if (typeof b === 'string') b = JSON.parse(b);
    res.status(200).json(await act(b || {}));
  } catch (e) { res.status(500).json({ err: String(e.message || e).slice(0, 200) }); }
};
module.exports._setSql = s => { sql = s; ready = null; };
