-- الصق الملف ده كله في Neon > SQL Editor ودوس Run مرة واحدة
create table if not exists rooms(
  code text primary key,
  token text not null,
  state jsonb not null default '{}'::jsonb,
  ver int not null default 0,
  created timestamptz not null default now()
);
create table if not exists players(
  id text primary key,
  room text not null,
  name text not null,
  team int not null,
  joined timestamptz not null default now()
);
create table if not exists events(
  id bigserial primary key,
  room text not null,
  kind text not null,
  pid text,
  name text,
  team int,
  body text,
  bellkey text,
  ts timestamptz not null default clock_timestamp()
);
create index if not exists ev_room on events(room, id);
-- الجرس: أول ضغطة بس لكل جولة (التوقيت بتاع السيرفر هو الحكم)
create unique index if not exists ev_bell on events(room, bellkey) where kind = 'bell';

-- الحسابات (الباسورد بيتخزن مشفر scrypt مش واضح)
create table if not exists users(
  username text primary key,
  salt text not null,
  hash text not null,
  stats jsonb not null default '{}'::jsonb,
  created timestamptz not null default now()
);
create table if not exists sessions(
  token text primary key,
  username text not null,
  created timestamptz not null default now()
);
