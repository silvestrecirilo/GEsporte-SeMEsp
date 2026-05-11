-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Funcionários/Equipe
create table if not exists public.funcionarios (
  id uuid default uuid_generate_v4() primary key,
  nome text not null,
  email text unique,
  cargo text not null, -- Ex: Professor, Administrativo, Coordenador, Equipe Técnica
  telefone text,
  permissoes text[] default '{}',
  role text not null default 'funcionario' check (role in ('admin', 'funcionario', 'professor')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Equipamentos Esportivos
create table if not exists public.equipamentos (
  id uuid default uuid_generate_v4() primary key,
  bairro text not null,
  tipo text not null,
  endereco text not null,
  latitude double precision,
  longitude double precision,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Modalidades
create table if not exists public.modalidades (
  id uuid default uuid_generate_v4() primary key,
  nome text not null unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Turmas
create table if not exists public.turmas (
  id uuid default uuid_generate_v4() primary key,
  codigo text unique, 
  modalidade_id uuid references public.modalidades(id) on delete restrict not null,
  equipamento_id uuid references public.equipamentos(id) on delete restrict not null,
  dias_semana text[] not null, -- ex: ['Segunda', 'Quarta']
  hora_inicio time not null,
  hora_fim time not null,
  professor_id uuid references public.funcionarios(id) on delete set null,
  status text not null default 'Em Funcionamento' check (status in ('Em Funcionamento', 'Inativa', 'Fechada', 'Suspensa')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Alunos
create table if not exists public.alunos (
  id uuid default uuid_generate_v4() primary key,
  matricula text unique not null, -- ESPxxxxxx
  nome text not null,
  cep text not null,
  endereco text not null,
  complemento text,
  bairro text not null,
  telefone text,
  email text,
  data_nascimento date not null,
  -- Novo PAR-Q em JSONB para flexibilidade (LGPD Compliant Storage)
  saude_info jsonb default '{}'::jsonb,
  -- Legado (Mantido para compatibilidade se necessário, mas preferir jsonb)
  par_q_1 boolean default false,
  par_q_2 boolean default false,
  par_q_3 boolean default false,
  par_q_4 boolean default false,
  par_q_5 boolean default false,
  par_q_6 boolean default false,
  par_q_7 boolean default false,
  termo_responsabilidade_aceito boolean default false,
  termo_veracidade_aceito boolean default true,
  -- Responsável
  nome_responsavel text,
  cpf_responsavel text,
  telefone_responsavel text,
  -- Foto
  foto_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Matrículas (Relacionamento Aluno <-> Turma)
create table if not exists public.matriculas (
  id uuid default uuid_generate_v4() primary key,
  aluno_id uuid references public.alunos(id) on delete cascade not null,
  turma_id uuid references public.turmas(id) on delete restrict not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(aluno_id, turma_id)
);

-- 7. Frequência
create table if not exists public.frequencia (
  id uuid default uuid_generate_v4() primary key,
  aluno_id uuid references public.alunos(id) on delete cascade not null,
  turma_id uuid references public.turmas(id) on delete cascade not null,
  data_aula date not null,
  status_aula text not null check (status_aula in ('presente', 'falta', 'falta_justificada', 'aula_cancelada')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(aluno_id, turma_id, data_aula)
);

-- 8. Turmas Auxiliares (Relacionamento Turma <-> Funcionário)
create table if not exists public.turmas_auxiliares (
  id uuid default uuid_generate_v4() primary key,
  turma_id uuid references public.turmas(id) on delete cascade not null,
  funcionario_id uuid references public.funcionarios(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(turma_id, funcionario_id)
);

-- 9. Atividades Externas (Agendamentos)
create table if not exists public.atividades_externas (
  id uuid default uuid_generate_v4() primary key,
  titulo text not null,
  equipamento_id uuid references public.equipamentos(id) on delete restrict not null,
  dia_semana text not null,
  horario_inicio time not null,
  horario_fim time not null,
  tipo text not null check (tipo in ('proprio', 'terceiros')),
  data_inicio date,
  data_fim date,
  descricao text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set-based function for Attendance (Ficha de Presença)
create or replace function public.gerar_ficha_presenca(p_mes integer, p_ano integer, p_turma_id uuid)
returns void as $$
begin
  insert into public.frequencia (aluno_id, turma_id, data_aula, status_aula)
  select 
    m.aluno_id, 
    p_turma_id, 
    d.dia::date, 
    'falta'
  from public.matriculas m
  cross join generate_series(
    make_date(p_ano, p_mes, 1),
    (make_date(p_ano, p_mes, 1) + interval '1 month' - interval '1 day'),
    interval '1 day'
  ) as d(dia)
  join public.turmas t on t.id = p_turma_id
  where m.turma_id = p_turma_id
  and (
    case extract(dow from d.dia)
      when 0 then 'Domingo'
      when 1 then 'Segunda'
      when 2 then 'Terça'
      when 3 then 'Quarta'
      when 4 then 'Quinta'
      when 5 then 'Sexta'
      when 6 then 'Sábado'
    end
  ) = any(t.dias_semana)
  on conflict (aluno_id, turma_id, data_aula) do nothing;
end;
$$ language plpgsql;

-- RLS (Row Level Security) - REFACTORED FOR LGPD COMPLIANCE
alter table public.funcionarios enable row level security;
alter table public.equipamentos enable row level security;
alter table public.modalidades enable row level security;
alter table public.turmas enable row level security;
alter table public.alunos enable row level security;
alter table public.matriculas enable row level security;
alter table public.frequencia enable row level security;
alter table public.turmas_auxiliares enable row level security;
alter table public.atividades_externas enable row level security;

-- Helper function to check if user is in funcionarios table
create or replace function public.is_funcionario()
returns boolean as $$
begin
  -- Retorna true se o usuário estiver na tabela OU se a tabela estiver vazia (Modo Bootstrap para o administrador inicial)
  return exists (
    select 1 from public.funcionarios 
    where id = auth.uid() 
    OR lower(email) = lower(auth.jwt()->>'email')
  ) OR (not exists (select 1 from public.funcionarios));
end;
$$ language plpgsql security definer;

-- Helper function to check if user is admin
create or replace function public.is_admin()
returns boolean as $$
begin
  return exists (
    select 1 from public.funcionarios 
    where (id = auth.uid() OR lower(email) = lower(auth.jwt()->>'email'))
    and role = 'admin'
  );
end;
$$ language plpgsql security definer;

-- Remove ALL old policies
DO $$ 
DECLARE 
    pol RECORD;
BEGIN 
    FOR pol IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') 
    LOOP 
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    END LOOP; 
END $$;

-- Policies: Equipamentos, Modalidades, Turmas, Atividades (Public Reading, Auth Writing)
create policy "Select for everyone" on public.equipamentos for select using (true);
create policy "Manage for staff" on public.equipamentos for all to authenticated using (is_funcionario());

create policy "Select for everyone" on public.modalidades for select using (true);
create policy "Manage for staff" on public.modalidades for all to authenticated using (is_funcionario());

create policy "Select for everyone" on public.turmas for select using (true);
create policy "Manage for staff" on public.turmas for all to authenticated using (is_funcionario());

-- Atividades Externas: Política para restringir agendamentos apenas a funcionários
create policy "Select activities for everyone" on public.atividades_externas for select using (true);
create policy "Apenas funcionarios agendam atividades_externas" on public.atividades_externas for insert to authenticated with check (is_funcionario());
create policy "Update activities for staff" on public.atividades_externas for update to authenticated using (is_funcionario());
create policy "Delete activities for staff" on public.atividades_externas for delete to authenticated using (is_funcionario());

-- Policies: Alunos, Matrículas, Frequência (Restricted Reading and Writing)
create policy "Staff can manage students" on public.alunos for all to authenticated using (is_funcionario());
create policy "Staff can manage enrollments" on public.matriculas for all to authenticated using (is_funcionario());
create policy "Staff can manage attendance" on public.frequencia for all to authenticated using (is_funcionario());
create policy "Staff can manage auxiliary instructors" on public.turmas_auxiliares for all to authenticated using (is_funcionario());

-- Policies: Funcionarios (Privacy focus)
create policy "Public can see staff names and roles" on public.funcionarios 
  for select using (true);

create policy "Staff can see full contact details" on public.funcionarios 
  for select to authenticated using (is_funcionario());

create policy "Admins can manage staff" on public.funcionarios 
  for all to authenticated using (is_admin());

create policy "Users can update their own phone" on public.funcionarios 
  for update to authenticated 
  using (id = auth.uid()) with check (id = auth.uid());

-- Performance Indices
create index if not exists idx_funcionarios_nome on public.funcionarios(nome);
create index if not exists idx_alunos_nome on public.alunos(nome);
create index if not exists idx_alunos_matricula on public.alunos(matricula);
create index if not exists idx_turmas_modalidade on public.turmas(modalidade_id);
create index if not exists idx_matriculas_aluno on public.matriculas(aluno_id);
create index if not exists idx_matriculas_turma on public.matriculas(turma_id);
create index if not exists idx_frequencia_aluno_turma on public.frequencia(aluno_id, turma_id);
create index if not exists idx_frequencia_data on public.frequencia(data_aula);
create index if not exists idx_turmas_auxiliares_turma on public.turmas_auxiliares(turma_id);
create index if not exists idx_turmas_auxiliares_funcionario on public.turmas_auxiliares(funcionario_id);
create index if not exists idx_alunos_saude on public.alunos using gin (saude_info);
