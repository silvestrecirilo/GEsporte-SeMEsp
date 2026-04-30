export function setupMockBackend() {
  const originalFetch = window.fetch;
  
  const isLocalStorageAvailable = () => {
    try {
      localStorage.setItem('test', 'test');
      localStorage.removeItem('test');
      return true;
    } catch (e) {
      return false;
    }
  };

  const hasStorage = isLocalStorageAvailable();

  // Initialize mock data in localStorage if it doesn't exist or is too small
  const existingDb = hasStorage ? JSON.parse(localStorage.getItem('mock_db') || '{}') : {};
  const isOldDb = !existingDb.alunos || existingDb.alunos.length < 10;

  if (hasStorage && (!localStorage.getItem('mock_db') || isOldDb)) {
    const modalidades = [
      { id: '1', nome: 'Futebol', idade_minima: 7, idade_maxima: 15 },
      { id: '2', nome: 'Natação', idade_minima: 5, idade_maxima: 80 },
      { id: '3', nome: 'Judô', idade_minima: 6, idade_maxima: 18 },
      { id: '4', nome: 'Vôlei', idade_minima: 10, idade_maxima: 17 },
      { id: '5', nome: 'Basquete', idade_minima: 8, idade_maxima: 16 }
    ];

    const equipamentos = [
      { id: '1', tipo: 'Quadra Poliesportiva A', bairro: 'Centro', endereco: 'Rua Principal, 100' },
      { id: '2', tipo: 'Piscina Municipal', bairro: 'Vila Nova', endereco: 'Av. das Águas, 500' },
      { id: '3', tipo: 'Centro de Lutas', bairro: 'Centro', endereco: 'Rua da Força, 20' },
      { id: '4', tipo: 'Quadra Poliesportiva B', bairro: 'Jardins', endereco: 'Rua das Flores, 300' },
      { id: '5', tipo: 'Ginásio Coberto', bairro: 'Santo Antônio', endereco: 'Praça da Matriz, s/n' }
    ];

    const funcionarios = [
      { id: '1', nome: 'Prof. Carlos (Futebol)', role: 'professor' },
      { id: '2', nome: 'Profa. Ana (Natação)', role: 'professor' },
      { id: '3', nome: 'Mestre Silva (Judô)', role: 'professor' },
      { id: '4', nome: 'Prof. Roberto (Vôlei)', role: 'professor' },
      { id: '5', nome: 'Profa. Sandra (Basquete)', role: 'professor' }
    ];

    const turmas = [
      { id: '1', modalidade_id: '1', equipamento_id: '1', funcionario_id: '1', dias_semana: ['Segunda', 'Quarta'], horario_inicio: '14:00', horario_fim: '15:00', status: 'ativa', capacidade: 30 },
      { id: '2', modalidade_id: '1', equipamento_id: '1', funcionario_id: '1', dias_semana: ['Terça', 'Quinta'], horario_inicio: '09:00', horario_fim: '10:00', status: 'ativa', capacidade: 30 },
      { id: '3', modalidade_id: '2', equipamento_id: '2', funcionario_id: '2', dias_semana: ['Segunda', 'Quarta', 'Sexta'], horario_inicio: '08:00', horario_fim: '09:00', status: 'ativa', capacidade: 15 },
      { id: '4', modalidade_id: '2', equipamento_id: '2', funcionario_id: '2', dias_semana: ['Terça', 'Quinta'], horario_inicio: '16:00', horario_fim: '17:00', status: 'ativa', capacidade: 15 },
      { id: '5', modalidade_id: '3', equipamento_id: '3', funcionario_id: '3', dias_semana: ['Segunda', 'Quarta'], horario_inicio: '18:00', horario_fim: '19:30', status: 'ativa', capacidade: 20 },
      { id: '6', modalidade_id: '4', equipamento_id: '4', funcionario_id: '4', dias_semana: ['Terça', 'Quinta'], horario_inicio: '15:00', horario_fim: '16:30', status: 'ativa', capacidade: 25 },
      { id: '7', modalidade_id: '5', equipamento_id: '5', funcionario_id: '5', dias_semana: ['Segunda', 'Quarta'], horario_inicio: '10:00', horario_fim: '11:30', status: 'ativa', capacidade: 25 }
    ];

    const nomes = ['Lucas', 'Gabriel', 'Mateus', 'Enzo', 'Guilherme', 'Rafael', 'João', 'Pedro', 'Vitor', 'Arthur', 'Julia', 'Sophia', 'Alice', 'Isabella', 'Manuela', 'Laura', 'Valentina', 'Heloisa', 'Lorena', 'Livia'];
    const sobrenomes = ['Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 'Pereira', 'Lima', 'Gomes', 'Costa', 'Ribeiro', 'Martins', 'Carvalho', 'Almeida', 'Lopes', 'Soares', 'Fernandes', 'Vieira', 'Barbosa'];
    const bairros = ['Centro', 'Jardins', 'Vila Nova', 'Santo Antônio', 'Bela Vista', 'Parque das Nações', 'Santa Luzia', 'Industrial'];

    const alunos = Array.from({ length: 100 }, (_, i) => {
      const nome = `${nomes[Math.floor(Math.random() * nomes.length)]} ${sobrenomes[Math.floor(Math.random() * sobrenomes.length)]}`;
      return {
        id: String(i + 1),
        nome,
        matricula: `ESP${String(100000 + i)}`,
        bairro: bairros[Math.floor(Math.random() * bairros.length)],
        telefone_responsavel: `119${Math.floor(10000000 + Math.random() * 90000000)}`
      };
    });

    const matriculas = alunos.map((aluno, i) => {
      const turma = turmas[Math.floor(Math.random() * turmas.length)];
      return {
        id: String(i + 1),
        aluno_id: aluno.id,
        turma_id: turma.id,
        status: 'ativa',
        data_matricula: new Date(Date.now() - Math.random() * 10000000000).toISOString()
      };
    });

    const frequencia: any[] = [];
    const today = new Date();
    for (let d = 0; d < 30; d++) {
      const date = new Date();
      date.setDate(today.getDate() - d);
      const dateStr = date.toISOString().split('T')[0];
      
      // For each class, pick some students and mark attendance
      turmas.forEach(turma => {
        const studentsInTurma = matriculas.filter(m => m.turma_id === turma.id);
        studentsInTurma.forEach(m => {
          if (Math.random() > 0.2) { // 80% attendance rate
            frequencia.push({
              id: String(frequencia.length + 1),
              matricula_id: m.id,
              data_aula: dateStr,
              status: Math.random() > 0.1 ? 'presente' : 'falta_justificada'
            });
          } else {
            frequencia.push({
              id: String(frequencia.length + 1),
              matricula_id: m.id,
              data_aula: dateStr,
              status: 'falta'
            });
          }
        });
      });
    }

    const atividades_externas = [
      { id: '1', titulo: 'Torneio Beneficente', equipamento_id: '1', dia_semana: 'Sábado', horario_inicio: '09:00', horario_fim: '17:00', tipo: 'terceiros', descricao: 'Uso da quadra para torneio de caridade.' },
      { id: '2', titulo: 'Manutenção Preventiva', equipamento_id: '2', dia_semana: 'Sexta', horario_inicio: '13:00', horario_fim: '15:00', tipo: 'proprio', descricao: 'Limpeza profunda da piscina.' }
    ];

    localStorage.setItem('mock_db', JSON.stringify({
      alunos,
      turmas,
      modalidades,
      equipamentos,
      funcionarios,
      matriculas,
      frequencia,
      atividades_externas
    }));
  }

  const mockFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      
      if (url.includes('placeholder.supabase.co')) {
        console.log('[Mock Backend] Intercepted:', url, init?.method);
        
        let db: any = {
          alunos: [],
          turmas: [],
          modalidades: [],
          equipamentos: [],
          funcionarios: [],
          matriculas: [],
          frequencia: []
        };
        try {
          const stored = hasStorage ? localStorage.getItem('mock_db') : null;
          if (stored) {
            const parsed = JSON.parse(stored);
            db = { ...db, ...parsed };
          }
        } catch (e) {
          console.error('[Mock Backend] Error parsing DB:', e);
        }
        
        // Handle Auth
        if (url.includes('/auth/v1/')) {
          if (url.includes('/auth/v1/token')) {
            return new Response(JSON.stringify({
              access_token: 'mock-token',
              user: { id: 'mock-user-id', email: 'admin@example.com' }
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
          if (url.includes('/auth/v1/user')) {
            return new Response(JSON.stringify({
              id: 'mock-user-id', email: 'admin@example.com'
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
          if (url.includes('/auth/v1/logout')) {
            return new Response(null, { status: 204 });
          }
          // Default auth response for other endpoints
          return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }

        // Handle REST API
        if (url.includes('/rest/v1/')) {
          const urlObj = new URL(url);
          const table = urlObj.pathname.split('/').pop() as string;
          const method = init?.method || 'GET';
          
          if (method === 'GET' || method === 'HEAD') {
            let data = db[table] || [];
            
            // Basic filtering
            urlObj.searchParams.forEach((value, key) => {
              if (key === 'select') return;
              if (key === 'order') {
                const [col, dir] = value.split('.');
                data = [...data].sort((a: any, b: any) => {
                  if (a[col] < b[col]) return dir === 'asc' ? -1 : 1;
                  if (a[col] > b[col]) return dir === 'asc' ? 1 : -1;
                  return 0;
                });
                return;
              }
              if (value.startsWith('eq.')) {
                const val = value.substring(3);
                data = data.filter((item: any) => String(item[key]) === String(val));
              } else if (value.startsWith('gte.')) {
                const val = value.substring(4);
                data = data.filter((item: any) => item[key] >= val);
              } else if (value.startsWith('lte.')) {
                const val = value.substring(4);
                data = data.filter((item: any) => item[key] <= val);
              }
            });

            // Handle joins (very basic mock for specific queries)
            if (table === 'turmas' && urlObj.searchParams.get('select')?.includes('modalidades')) {
              data = data.map((t: any) => ({
                ...t,
                modalidades: db.modalidades?.find((m: any) => m.id === t.modalidade_id),
                equipamentos: db.equipamentos?.find((e: any) => e.id === t.equipamento_id),
                funcionarios: db.funcionarios?.find((f: any) => f.id === t.funcionario_id),
                matriculas: [{ count: db.matriculas?.filter((m: any) => m.turma_id === t.id).length || 0 }]
              }));
            }
            if (table === 'matriculas' && urlObj.searchParams.get('select')?.includes('alunos')) {
              data = data.map((m: any) => ({
                ...m,
                alunos: db.alunos?.find((a: any) => a.id === m.aluno_id),
                turmas: {
                  ...db.turmas?.find((t: any) => t.id === m.turma_id),
                  modalidades: db.modalidades?.find((mod: any) => mod.id === db.turmas?.find((t: any) => t.id === m.turma_id)?.modalidade_id),
                  equipamentos: db.equipamentos?.find((e: any) => e.id === db.turmas?.find((t: any) => t.id === m.turma_id)?.equipamento_id)
                }
              }));
            }

            const getHeader = (name: string) => {
              if (!init?.headers) return null;
              if (init.headers instanceof Headers) return init.headers.get(name);
              if (Array.isArray(init.headers)) {
                const header = init.headers.find(h => h[0].toLowerCase() === name.toLowerCase());
                return header ? header[1] : null;
              }
              return (init.headers as any)[name] || (init.headers as any)[name.toLowerCase()];
            };

            // Handle count
            if (String(getHeader('Prefer')).includes('count=exact')) {
              return new Response(method === 'HEAD' ? null : JSON.stringify(data), { 
                status: 200, 
                headers: { 
                  'Content-Type': 'application/json',
                  'Content-Range': `0-${data.length - 1}/${data.length}`
                } 
              });
            }

            // Handle single()
            if (String(getHeader('Accept')).includes('application/vnd.pgrst.object+json')) {
              if (data.length === 0) {
                return new Response(JSON.stringify({ message: 'Not found' }), { status: 406, headers: { 'Content-Type': 'application/json' } });
              }
              return new Response(method === 'HEAD' ? null : JSON.stringify(data[0]), { status: 200, headers: { 'Content-Type': 'application/json' } });
            }

            return new Response(method === 'HEAD' ? null : JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
          
          if (method === 'POST') {
            const body = JSON.parse(init?.body as string);
            const items = Array.isArray(body) ? body : [body];
            
            const getHeader = (name: string) => {
              if (!init?.headers) return null;
              if (init.headers instanceof Headers) return init.headers.get(name);
              if (Array.isArray(init.headers)) {
                const header = init.headers.find(h => h[0].toLowerCase() === name.toLowerCase());
                return header ? header[1] : null;
              }
              return (init.headers as any)[name] || (init.headers as any)[name.toLowerCase()];
            };

            const onConflict = urlObj.searchParams.get('on_conflict');
            if (onConflict || String(getHeader('Prefer')).includes('resolution=merge-duplicates')) {
              const conflictCols = onConflict ? onConflict.split(',') : ['id'];
              
              items.forEach(newItem => {
                if (!db[table]) db[table] = [];
                const existingIndex = db[table].findIndex((item: any) => 
                  conflictCols.every(col => item[col] === newItem[col])
                );
                
                if (existingIndex >= 0) {
                  db[table][existingIndex] = { ...db[table][existingIndex], ...newItem };
                } else {
                  db[table].push({ ...newItem, id: newItem.id || String(Date.now() + Math.random()) });
                }
              });
            } else {
              // Check for unique constraint on matriculas
              if (table === 'matriculas') {
                for (const newItem of items) {
                  const exists = (db[table] || []).some((m: any) => m.aluno_id === newItem.aluno_id && m.turma_id === newItem.turma_id);
                  if (exists) {
                    return new Response(JSON.stringify({ code: '23505', message: 'Unique violation' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
                  }
                }
              }
              
              const newItems = items.map(item => ({ ...item, id: item.id || String(Date.now() + Math.random()) }));
              db[table] = [...(db[table] || []), ...newItems];
            }
            
            if (hasStorage) localStorage.setItem('mock_db', JSON.stringify(db));
            return new Response(JSON.stringify(items), { status: 201, headers: { 'Content-Type': 'application/json' } });
          }
          
          if (method === 'PATCH') {
            const body = JSON.parse(init?.body as string);
            let matchKey = '';
            let matchVal = '';
            
            urlObj.searchParams.forEach((value, key) => {
              if (value.startsWith('eq.')) {
                matchKey = key;
                matchVal = value.substring(3);
              }
            });
            
            if (matchKey && matchVal && db[table]) {
              db[table] = db[table].map((item: any) => String(item[matchKey]) === String(matchVal) ? { ...item, ...body } : item);
              if (hasStorage) localStorage.setItem('mock_db', JSON.stringify(db));
            }
            return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
          }
          
          if (method === 'DELETE') {
            let matchKey = '';
            let matchVal = '';
            
            urlObj.searchParams.forEach((value, key) => {
              if (value.startsWith('eq.')) {
                matchKey = key;
                matchVal = value.substring(3);
              }
            });
            
            if (matchKey && matchVal && db[table]) {
              db[table] = db[table].filter((item: any) => String(item[matchKey]) !== String(matchVal));
              if (hasStorage) localStorage.setItem('mock_db', JSON.stringify(db));
            }
            return new Response(null, { status: 204 });
          }
        }
      }
      
      return originalFetch(input, init);
    } catch (e) {
      console.error('[Mock Backend] Fatal Error:', e);
      return originalFetch(input, init);
    }
  };

  try {
    Object.defineProperty(window, 'fetch', {
      value: mockFetch,
      configurable: true,
      writable: true
    });
  } catch (e) {
    try {
      window.fetch = mockFetch;
    } catch (e2) {
      console.error('[Mock Backend] Failed to overwrite window.fetch:', e2);
    }
  }
}

// Auto-initialize when imported
setupMockBackend();
