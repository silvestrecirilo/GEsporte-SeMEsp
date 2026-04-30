-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Funcionários
create table public.funcionarios (
  id uuid default uuid_generate_v4() primary key,
  nome text not null,
  email text not null unique,
  cargo text not null, -- Ex: Professor, Administrativo
  telefone text,
  bairro text,
  endereco text,
  permissoes text[] default '{}', -- Lista de permissões (ex: ['dashboard', 'alunos'])
  role text not null default 'funcionario' check (role in ('admin', 'funcionario', 'professor')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Professores
create table public.professores (
  id uuid default uuid_generate_v4() primary key,
  nome text not null,
  email text not null unique,
  carga_horaria_semanal integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Equipamentos Esportivos
create table public.equipamentos (
  id uuid default uuid_generate_v4() primary key,
  bairro text not null,
  tipo text not null,
  endereco text not null,
  latitude double precision,
  longitude double precision,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Modalidades
create table public.modalidades (
  id uuid default uuid_generate_v4() primary key,
  nome text not null unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Turmas
create table public.turmas (
  id uuid default uuid_generate_v4() primary key,
  codigo text unique, -- Identificação alfanumérica
  modalidade_id uuid references public.modalidades(id) not null,
  bairro text not null,
  equipamento_id uuid references public.equipamentos(id) not null,
  dias_semana text[] not null, -- ex: ['Segunda', 'Quarta']
  hora_inicio time not null,
  hora_fim time not null,
  professor_id uuid references public.professores(id) not null,
  professor_auxiliar_id uuid references public.professores(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Alunos
create table public.alunos (
  id uuid default uuid_generate_v4() primary key,
  matricula text unique not null, -- ESPxxxxxx
  nome text not null,
  cep text not null,
  endereco text not null,
  complemento text,
  bairro text not null,
  telefone text not null,
  email text not null,
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
create table public.matriculas (
  id uuid default uuid_generate_v4() primary key,
  aluno_id uuid references public.alunos(id) not null,
  turma_id uuid references public.turmas(id) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(aluno_id, turma_id)
);

-- 8. Frequência
create table public.frequencia (
  id uuid default uuid_generate_v4() primary key,
  aluno_id uuid references public.alunos(id) not null,
  turma_id uuid references public.turmas(id) not null,
  data_aula date not null,
  status_aula text not null check (status_aula in ('presente', 'falta', 'falta_justificada', 'aula_cancelada')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(aluno_id, turma_id, data_aula)
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

-- Drop generic policies if they exist (to avoid conflicts)
drop policy if exists "Autenticados podem ler tudo" on public.turmas;
drop policy if exists "Autenticados podem ler tudo" on public.alunos;
drop policy if exists "Autenticados podem ler tudo" on public.frequencia;

-- Create Granular Policies for Authenticated Staff
-- Note: In a production app, you might want to differentiate between 'admin' and 'professor' roles.

-- 1. Funcionários/Professores/Equipamentos/Modalidades (Leitura para todos autenticados, Escrita para Admins)
create policy "Staff autenticado pode ver funcionarios" on public.funcionarios for select to authenticated using (true);
create policy "Staff autenticado pode ver professores" on public.professores for select to authenticated using (true);
create policy "Staff autenticado pode ver equipamentos" on public.equipamentos for select to authenticated using (true);
create policy "Staff autenticado pode ver modalidades" on public.modalidades for select to authenticated using (true);

-- 2. Turmas (CRUD para staff autenticado)
create policy "Staff autenticado pode gerenciar turmas" on public.turmas for all to authenticated using (true);

-- 3. Alunos (CRUD para staff autenticado)
create policy "Staff autenticado pode gerenciar alunos" on public.alunos for all to authenticated using (true);

-- 4. Matriculas (CRUD para staff autenticado)
create policy "Staff autenticado pode gerenciar matriculas" on public.matriculas for all to authenticated using (true);

-- 5. Frequencia (CRUD para staff autenticado)
create policy "Staff autenticado pode gerenciar frequencia" on public.frequencia for all to authenticated using (true);

-- 6. AI Logs (to store chat history)
create table public.ai_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id),
  user_prompt text not null,
  ai_response text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.ai_logs enable row level security;

create policy "Users can view their own AI logs"
  on public.ai_logs for select
  to authenticated
  using (auth.uid() = user_id);

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
