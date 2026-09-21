-- ---------------------------------------------------------------------------
-- Trasy na predaj
-- ---------------------------------------------------------------------------
-- Skaláry, podľa ktorých sa filtruje alebo ktoré držia peniaze, sú stĺpce
-- s kontrolou priamo v databáze — zlá cena sa nedostane do predaja, ani keď
-- zlyhá kontrola v aplikácii. Texty v štyroch jazykoch, body na mape a súbory
-- sú jsonb: ich tvar stráži zod v lib/route-schema.ts. Plná normalizácia by
-- znamenala šesť tabuliek a joiny pre aplikáciu s jedným adminom.

create table public.routes (
  id             text primary key,
  slug           text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  published      boolean not null default false,
  is_example     boolean not null default false,
  tier           text not null check (tier in ('silver', 'gold')),
  -- Celé franky. Checkout berie cenu odtiaľto, nikdy z požiadavky.
  price_chf      integer not null check (price_chf between 1 and 500),
  region         text not null,
  country        text not null check (country ~ '^[A-Z]{2}$'),
  distance_km    numeric(7, 1) not null check (distance_km > 0),
  ascent_m       integer not null check (ascent_m >= 0),
  duration_hours text not null,
  avg_temp_c     integer not null,
  passable       boolean not null default true,
  difficulty     text not null check (difficulty in ('easy', 'medium', 'hard')),
  curviness      smallint not null check (curviness between 1 and 5),
  season_from    smallint not null check (season_from between 1 and 12),
  season_to      smallint not null check (season_to between 1 and 12),
  start_point    jsonb not null,
  finish_point   jsonb not null,
  via            jsonb not null default '[]'::jsonb,
  weather_point  jsonb not null,
  title          jsonb not null,
  summary        jsonb not null,
  highlights     jsonb not null default '[]'::jsonb,
  gear           jsonb not null,
  assets         jsonb not null,
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index routes_published_order on public.routes (published, sort_order, id);

create function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger routes_set_updated_at
  before update on public.routes
  for each row execute function public.set_updated_at();

-- Oddelenie podľa oprávnení: verejný kľúč (publishable) vidí len zverejnené
-- trasy a nezapíše nič. Zapisuje iba server so secret kľúčom, ktorý RLS obchádza.
alter table public.routes enable row level security;

create policy "Zverejnené trasy vidí každý"
  on public.routes for select
  to anon, authenticated
  using (published);

-- RLS by zápis zamietlo aj tak — toto je druhá vrstva, keby niekto omylom
-- pridal príliš voľnú policy.
revoke insert, update, delete, truncate on public.routes from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Pokusy o prihlásenie do administrácie
-- ---------------------------------------------------------------------------
-- Limit pokusov musí žiť v databáze, nie v pamäti funkcie: na Verceli beží
-- naraz viac inštancií a každá by počítala zvlášť.

create table public.admin_login_attempts (
  id           bigint generated always as identity primary key,
  ip           text not null,
  succeeded    boolean not null,
  attempted_at timestamptz not null default now()
);

create index admin_login_attempts_ip_time
  on public.admin_login_attempts (ip, attempted_at desc);

create index admin_login_attempts_time
  on public.admin_login_attempts (attempted_at desc);

-- Žiadna policy: tabuľku číta a zapisuje len server so secret kľúčom.
alter table public.admin_login_attempts enable row level security;
revoke all on public.admin_login_attempts from anon, authenticated;
