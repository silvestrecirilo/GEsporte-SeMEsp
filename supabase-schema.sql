-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Funcionários
create table if not exists public.funcionarios (
  id uuid default uuid_generate_v4() primary key,
  nome text not null,
  email text unique,
  cargo text not null, -- Ex: Professor, Administrativo
  telefone text,
  permissoes text[] default '{}', -- Lista de permissões (ex: ['dashboard', 'alunos'])
  role text not null default 'funcionario' check (role in ('admin', 'funcionario', 'professor')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Professores
create table if not exists public.professores (
  id uuid default uuid_generate_v4() primary key,
  nome text not null,
  email text unique,
  carga_horaria_semanal integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Equipamentos Esportivos
create table if not exists public.equipamentos (
  id uuid default uuid_generate_v4() primary key,
  bairro text not null,
  tipo text not null,
  endereco text not null,
  latitude double precision,
  longitude double precision,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Modalidades
create table if not exists public.modalidades (
  id uuid default uuid_generate_v4() primary key,
  nome text not null unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Turmas
create table if not exists public.turmas (
  id uuid default uuid_generate_v4() primary key,
  codigo text unique, -- Identificação alfanumérica
  modalidade_id uuid references public.modalidades(id) on delete cascade not null,
  bairro text not null,
  equipamento_id uuid references public.equipamentos(id) on delete cascade not null,
  dias_semana text[] not null, -- ex: ['Segunda', 'Quarta']
  hora_inicio time not null,
  hora_fim time not null,
  professor_id uuid references public.professores(id) on delete cascade not null,
  professor_auxiliar_id uuid references public.professores(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Alunos
create table if not exists public.alunos (
  id uuid default uuid_generate_v4() primary key,
  matricula text unique not null, -- ESPxxxxxx
  nome text not null,
  cep text not null,
  endereco text not null,
  complemento text,
  bairro text not null,
  telefone text not null,
  email text,
  data_nascimento date not null,
  -- PAR-Q
  par_q_1 boolean default false,
  par_q_2 boolean default false,
  par_q_3 boolean default false,
  par_q_4 boolean default false,
  par_q_5 boolean default false,
  par_q_6 boolean default false,
  par_q_7 boolean default false,
  termo_responsabilidade_aceito boolean default false,
  termo_veracidade_aceito boolean default true,
  foto_url text, -- Path no Supabase Storage
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. Matrículas (Relacionamento Aluno <-> Turma)
create table if not exists public.matriculas (
  id uuid default uuid_generate_v4() primary key,
  aluno_id uuid references public.alunos(id) on delete cascade not null,
  turma_id uuid references public.turmas(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(aluno_id, turma_id)
);

-- 8. Frequência
create table if not exists public.frequencia (
  id uuid default uuid_generate_v4() primary key,
  aluno_id uuid references public.alunos(id) on delete cascade not null,
  turma_id uuid references public.turmas(id) on delete cascade not null,
  data_aula date not null,
  status_aula text not null check (status_aula in ('presente', 'falta', 'falta_justificada', 'aula_cancelada')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(aluno_id, turma_id, data_aula)
);

-- 9. Professores Auxiliares (Relacionamento Turma <-> Funcionário)
create table if not exists public.turmas_auxiliares (
  id uuid default uuid_generate_v4() primary key,
  turma_id uuid references public.turmas(id) on delete cascade not null,
  funcionario_id uuid references public.funcionarios(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(turma_id, funcionario_id)
);

-- Function: Gerar Ficha de Presença
create or replace function gerar_ficha_presenca(p_mes integer, p_ano integer, p_turma_id uuid)
returns void as $$
declare
  v_dias_semana text[];
  v_data_inicio date;
  v_data_fim date;
  v_data_atual date;
  v_dia_semana_num integer;
  v_dia_semana_nome text;
  v_aluno record;
begin
  -- Pega os dias da semana da turma
  select dias_semana into v_dias_semana from turmas where id = p_turma_id;
  
  -- Define inicio e fim do mes
  v_data_inicio := make_date(p_ano, p_mes, 1);
  v_data_fim := (v_data_inicio + interval '1 month' - interval '1 day')::date;
  
  v_data_atual := v_data_inicio;
  
  -- Loop pelos dias do mes
  while v_data_atual <= v_data_fim loop
    -- extract(dow) retorna 0 para Domingo, 1 para Segunda, etc.
    v_dia_semana_num := extract(dow from v_data_atual);
    
    v_dia_semana_nome := case v_dia_semana_num
      when 0 then 'Domingo'
      when 1 then 'Segunda'
      when 2 then 'Terça'
      when 3 then 'Quarta'
      when 4 then 'Quinta'
      when 5 then 'Sexta'
      when 6 then 'Sábado'
    end;
    
    -- Se o dia atual for um dia de aula da turma
    if v_dia_semana_nome = any(v_dias_semana) then
      -- Para cada aluno matriculado na turma
      for v_aluno in select aluno_id from matriculas where turma_id = p_turma_id loop
        -- Insere registro de falta (padrão) se não existir
        insert into frequencia (aluno_id, turma_id, data_aula, status_aula)
        values (v_aluno.aluno_id, p_turma_id, v_data_atual, 'falta')
        on conflict (aluno_id, turma_id, data_aula) do nothing;
      end loop;
    end if;
    
    v_data_atual := v_data_atual + 1;
  end loop;
end;
$$ language plpgsql;

-- RLS (Row Level Security) Setup
alter table public.funcionarios enable row level security;
alter table public.professores enable row level security;
alter table public.equipamentos enable row level security;
alter table public.modalidades enable row level security;
alter table public.turmas enable row level security;
alter table public.alunos enable row level security;
alter table public.matriculas enable row level security;
alter table public.frequencia enable row level security;
alter table public.turmas_auxiliares enable row level security;

-- Drop generic policies if they exist (to avoid conflicts)
drop policy if exists "Autenticados podem ler tudo" on public.turmas;
drop policy if exists "Autenticados podem ler tudo" on public.alunos;
drop policy if exists "Autenticados podem ler tudo" on public.frequencia;

-- Drop new policies if they exist before creating
drop policy if exists "Public access can see funcionarios" on public.funcionarios;
drop policy if exists "Public access can see professores" on public.professores;
drop policy if exists "Public access can see equipamentos" on public.equipamentos;
drop policy if exists "Public access can see modalidades" on public.modalidades;
drop policy if exists "Public access can write funcionarios" on public.funcionarios;
drop policy if exists "Public access can write professores" on public.professores;
drop policy if exists "Public access can write equipamentos" on public.equipamentos;
drop policy if exists "Public access can write modalidades" on public.modalidades;
drop policy if exists "Public access can manage turmas" on public.turmas;
drop policy if exists "Public access can manage alunos" on public.alunos;
drop policy if exists "Public access can manage matriculas" on public.matriculas;
drop policy if exists "Public access can manage frequencia" on public.frequencia;
drop policy if exists "Public access can manage turmas_auxiliares" on public.turmas_auxiliares;

-- Create Granular Policies for Authenticated Staff
-- 1. Funcionários/Professores/Equipamentos/Modalidades (Leitura para todos, Escrita para todos)
create policy "Public access can see funcionarios" on public.funcionarios for select using (true);
create policy "Public access can see professores" on public.professores for select using (true);
create policy "Public access can see equipamentos" on public.equipamentos for select using (true);
create policy "Public access can see modalidades" on public.modalidades for select using (true);

create policy "Public access can write funcionarios" on public.funcionarios for all using (true);
create policy "Public access can write professores" on public.professores for all using (true);
create policy "Public access can write equipamentos" on public.equipamentos for all using (true);
create policy "Public access can write modalidades" on public.modalidades for all using (true);

-- 2. Turmas (CRUD para todos)
create policy "Public access can manage turmas" on public.turmas for all using (true);

-- 3. Alunos (CRUD para todos)
create policy "Public access can manage alunos" on public.alunos for all using (true);

-- 4. Matriculas (CRUD para todos)
create policy "Public access can manage matriculas" on public.matriculas for all using (true);

-- 5. Frequencia (CRUD para todos)
create policy "Public access can manage frequencia" on public.frequencia for all using (true);

-- 6. Turmas Auxiliares (CRUD para todos)
create policy "Public access can manage turmas_auxiliares" on public.turmas_auxiliares for all using (true);

-- 6. AI Logs (to store chat history)
create table if not exists public.ai_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id),
  user_prompt text not null,
  ai_response text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.ai_logs enable row level security;

drop policy if exists "Users can view their own AI logs" on public.ai_logs;
create policy "Users can view their own AI logs"
  on public.ai_logs for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own AI logs" on public.ai_logs;
create policy "Users can insert their own AI logs"
  on public.ai_logs for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Proteção extra para escrita em tabelas de configuração (opcional: apenas admins podem inserir/deletar modalidades e equipamentos)
-- create policy "Apenas admins podem inserir modalidades" on public.modalidades for insert to authenticated with check (exists (select 1 from funcionarios where id = auth.uid() and role = 'admin'));

-- Storage: Criar bucket privado para fotos
-- insert into storage.buckets (id, name, public) values ('fotos_alunos', 'fotos_alunos', false);

create policy "Apenas autenticados podem ver fotos"
  on storage.objects for select
  to authenticated
  using ( bucket_id = 'fotos_alunos' );

create policy "Apenas autenticados podem enviar fotos"
  on storage.objects for insert
  to authenticated
  with check ( bucket_id = 'fotos_alunos' );
