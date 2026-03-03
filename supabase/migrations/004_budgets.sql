-- ══════════════════════════════════════════════════════════
-- Tabela: budgets (um limite por categoria por usuário)
-- ══════════════════════════════════════════════════════════
create table if not exists public.budgets (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid references auth.users(id) on delete cascade not null,
  category     text not null,        -- 'fixas', 'cartao', 'invest'
  limit_amount numeric(12,2) not null default 0,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),

  constraint budgets_one_per_category unique (user_id, category)
);

alter table public.budgets enable row level security;

create policy "Users read own budgets"
  on public.budgets for select
  using (auth.uid() = user_id);

create policy "Users insert own budgets"
  on public.budgets for insert
  with check (auth.uid() = user_id);

create policy "Users update own budgets"
  on public.budgets for update
  using (auth.uid() = user_id);

create policy "Users delete own budgets"
  on public.budgets for delete
  using (auth.uid() = user_id);

-- ══════════════════════════════════════════════════════════
-- Trigger: atualizar updated_at automaticamente
-- ══════════════════════════════════════════════════════════
create trigger budgets_updated_at
  before update on public.budgets
  for each row execute function public.set_updated_at();
