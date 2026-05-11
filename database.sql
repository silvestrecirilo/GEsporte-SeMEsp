-- Script de Criação do Banco de Dados (Supabase)
-- Copie e cole este código no SQL Editor do seu projeto Supabase

-- 1. Tabela de Funcionários (Administradores e Professores)
CREATE TABLE IF NOT EXISTS public.funcionarios (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    cargo TEXT NOT NULL, -- Ex: Professor, Administrativo
    telefone TEXT,
    bairro TEXT,
    endereco TEXT,
    permissoes TEXT[] DEFAULT '{}', -- Lista de permissões (ex: ['dashboard', 'alunos'])
    role TEXT NOT NULL DEFAULT 'funcionario' CHECK (role IN ('admin', 'funcionario', 'professor')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Tabela de Modalidades Esportivas
CREATE TABLE IF NOT EXISTS public.modalidades (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nome TEXT NOT NULL,
    descricao TEXT,
    idade_minima INTEGER DEFAULT 0,
    idade_maxima INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 3. Tabela de Equipamentos Esportivos (Locais)
CREATE TABLE IF NOT EXISTS public.equipamentos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tipo TEXT NOT NULL, -- Ex: Quadra, Campo, Piscina
    bairro TEXT NOT NULL,
    endereco TEXT NOT NULL,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. Tabela de Turmas
CREATE TABLE IF NOT EXISTS public.turmas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    codigo TEXT UNIQUE, -- Identificação alfanumérica
    modalidade_id UUID REFERENCES public.modalidades(id) ON DELETE CASCADE NOT NULL,
    equipamento_id UUID REFERENCES public.equipamentos(id) ON DELETE CASCADE NOT NULL,
    professor_id UUID REFERENCES public.funcionarios(id) ON DELETE SET NULL,
    dias_semana TEXT[] NOT NULL, -- Ex: ['Segunda', 'Quarta']
    horario_inicio TIME NOT NULL,
    horario_fim TIME NOT NULL,
    capacidade INTEGER NOT NULL DEFAULT 30,
    status TEXT NOT NULL DEFAULT 'Em Funcionamento' CHECK (status IN ('Em Funcionamento', 'Inativa', 'Fechada')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Ensure turmas_professor_id_fkey exists and points to funcionarios table
DO $$ 
BEGIN 
    -- 1. Ensure all data from old 'professores' table is in 'funcionarios' if it exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='professores' AND table_schema='public') THEN
        INSERT INTO public.funcionarios (id, nome, email, cargo, created_at, role)
        SELECT id, nome, email, 'Professor', created_at, 'professor' 
        FROM public.professores
        ON CONFLICT (email) DO NOTHING;
        
        -- Also handle conflicts on ID if necessary
        INSERT INTO public.funcionarios (id, nome, email, cargo, created_at, role)
        SELECT id, nome, email, 'Professor', created_at, 'professor' 
        FROM public.professores
        ON CONFLICT (id) DO NOTHING;
    END IF;

    -- 2. Drop the constraint if it exists (it might point to the wrong table)
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name='turmas_professor_id_fkey') THEN
        ALTER TABLE public.turmas DROP CONSTRAINT turmas_professor_id_fkey;
    END IF;
    -- Repairing relationship to handle either naming convention (professores vs funcionarios)
    ALTER TABLE public.turmas ADD CONSTRAINT turmas_professor_id_fkey FOREIGN KEY (professor_id) REFERENCES public.funcionarios(id) ON DELETE SET NULL;
END $$;

-- Ensure redundant bairro column is removed from turmas if it exists from older versions
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='turmas' AND column_name='bairro') THEN
        ALTER TABLE public.turmas ALTER COLUMN bairro DROP NOT NULL;
    END IF;
END $$;

-- 5. Tabela de Alunos
CREATE TABLE IF NOT EXISTS public.alunos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    matricula TEXT UNIQUE NOT NULL,
    nome TEXT NOT NULL,
    data_nascimento DATE NOT NULL,
    genero TEXT,
    bairro TEXT NOT NULL,
    escola TEXT,
    nome_responsavel TEXT,
    telefone_responsavel TEXT NOT NULL,
    cpf_responsavel TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 6. Tabela de Matrículas (Relação Aluno <-> Turma)
CREATE TABLE IF NOT EXISTS public.matriculas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    aluno_id UUID REFERENCES public.alunos(id) ON DELETE CASCADE NOT NULL,
    turma_id UUID REFERENCES public.turmas(id) ON DELETE CASCADE NOT NULL,
    status TEXT DEFAULT 'ativa' CHECK (status IN ('ativa', 'inativa', 'fila_espera')),
    data_matricula TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(aluno_id, turma_id)
);

-- 7. Tabela de Frequência
CREATE TABLE IF NOT EXISTS public.frequencia (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    turma_id UUID REFERENCES public.turmas(id) ON DELETE CASCADE NOT NULL,
    aluno_id UUID REFERENCES public.alunos(id) ON DELETE CASCADE NOT NULL,
    data_aula DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('presente', 'falta', 'falta_justificada', 'aula_cancelada')),
    registrado_por UUID REFERENCES public.funcionarios(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(turma_id, aluno_id, data_aula)
);

-- 8. Tabela de Atividades Externas (Agendamentos)
CREATE TABLE IF NOT EXISTS public.atividades_externas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    titulo TEXT NOT NULL,
    equipamento_id UUID REFERENCES public.equipamentos(id) ON DELETE CASCADE NOT NULL,
    dia_semana TEXT NOT NULL,
    horario_inicio TIME NOT NULL,
    horario_fim TIME NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('proprio', 'terceiros')),
    data_inicio DATE,
    data_fim DATE,
    descricao TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Configuração de Segurança (Row Level Security - RLS)
ALTER TABLE public.atividades_externas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir tudo para usuários autenticados" ON public.atividades_externas FOR ALL TO authenticated USING (true);

-- Configuração de Segurança (Row Level Security - RLS)
-- Para facilitar o desenvolvimento inicial, vamos permitir acesso autenticado em todas as tabelas.
-- Em produção, você deve restringir isso.

ALTER TABLE public.funcionarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modalidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.turmas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matriculas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.frequencia ENABLE ROW LEVEL SECURITY;

-- Políticas provisórias (Permite que qualquer usuário logado leia e escreva)
CREATE POLICY "Permitir tudo para usuários autenticados" ON public.funcionarios FOR ALL TO authenticated USING (true);
CREATE POLICY "Permitir tudo para usuários autenticados" ON public.modalidades FOR ALL TO authenticated USING (true);
CREATE POLICY "Permitir tudo para usuários autenticados" ON public.equipamentos FOR ALL TO authenticated USING (true);
CREATE POLICY "Permitir tudo para usuários autenticados" ON public.turmas FOR ALL TO authenticated USING (true);
CREATE POLICY "Permitir tudo para usuários autenticados" ON public.alunos FOR ALL TO authenticated USING (true);
CREATE POLICY "Permitir tudo para usuários autenticados" ON public.matriculas FOR ALL TO authenticated USING (true);
CREATE POLICY "Permitir tudo para usuários autenticados" ON public.frequencia FOR ALL TO authenticated USING (true);
