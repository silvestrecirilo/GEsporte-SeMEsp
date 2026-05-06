import { useState, ChangeEvent, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Calendar as CalendarIcon, CheckCircle, XCircle, AlertCircle, Ban } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNotification } from '../components/Notification';

// Tipos baseados no schema SQL
type StatusAula = 'presente' | 'falta' | 'falta_justificada' | 'aula_cancelada' | 'pendente';

interface AlunoFrequencia {
  id: string;
  matricula: string;
  nome: string;
  status: StatusAula;
}

interface TurmaInfo {
  id: string;
  codigo: string;
  modalidade: string;
  bairro: string;
  professor: string;
  horario: string;
  diasSemana: string[];
}

export default function Frequencia() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  
  // Estado para a data selecionada
  const [dataAula, setDataAula] = useState('');
  const [datasDisponiveis, setDatasDisponiveis] = useState<string[]>([]);
  
  // Estado para a lista de alunos e suas frequências
  const [turma, setTurma] = useState<TurmaInfo | null>(null);
  const [alunos, setAlunos] = useState<AlunoFrequencia[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aulaCancelada, setAulaCancelada] = useState(false);
  const [loading, setLoading] = useState(true);

  // Helper to get valid dates
  const getValidDates = (diasSemana: string[]) => {
    const dates: string[] = [];
    const today = new Date();
    const diaMap: Record<string, number> = {
      'Domingo': 0, 'Segunda': 1, 'Terça': 2, 'Quarta': 3, 'Quinta': 4, 'Sexta': 5, 'Sábado': 6
    };
    const targetDays = diasSemana.map(d => diaMap[d]);

    // Check last 30 days and next 30 days
    for (let i = -30; i <= 30; i++) {
      const d = new Date();
      d.setDate(today.getDate() + i);
      if (targetDays.includes(d.getDay())) {
        dates.push(d.toISOString().split('T')[0]);
      }
    }
    return dates.sort((a, b) => b.localeCompare(a)); // Newest first
  };

  useEffect(() => {
    async function loadFrequenciaData() {
      if (!id) return;
      setLoading(true);

      try {
        // 1. Fetch Turma details
        const { data: turmaData, error: turmaError } = await supabase
          .from('turmas')
          .select(`
            id,
            codigo,
            dias_semana,
            horario_inicio,
            horario_fim,
            modalidades (nome),
            equipamentos (bairro),
            funcionarios (nome)
          `)
          .eq('id', id)
          .single();

        if (turmaError) throw turmaError;

        if (turmaData) {
          const data = turmaData as any;
          const dias = Array.isArray(data.dias_semana) ? data.dias_semana : [data.dias_semana];
          setTurma({
            id: data.id,
            codigo: data.codigo || '',
            modalidade: data.modalidades?.nome || 'Desconhecida',
            bairro: data.equipamentos?.bairro || 'Desconhecido',
            professor: data.funcionarios?.nome || 'Não atribuído',
            horario: `${dias.join(', ')} - ${data.horario_inicio} às ${data.horario_fim}`,
            diasSemana: dias
          });

          const validDates = getValidDates(dias);
          setDatasDisponiveis(validDates);
          if (!dataAula && validDates.length > 0) {
            // Find closest date to today
            const todayStr = new Date().toISOString().split('T')[0];
            const closest = validDates.find(d => d <= todayStr) || validDates[validDates.length - 1];
            setDataAula(closest);
          }
        }

        // 2. Fetch enrolled students
        const { data: matriculasData, error: matriculasError } = await supabase
          .from('matriculas')
          .select(`
            aluno_id,
            alunos (id, matricula, nome)
          `)
          .eq('turma_id', id)
          .eq('status', 'ativa');

        if (matriculasError) throw matriculasError;

        // 3. Fetch existing attendance for the selected date
        if (dataAula) {
          const { data: frequenciaData, error: frequenciaError } = await supabase
            .from('frequencia')
            .select('aluno_id, status')
            .eq('turma_id', id)
            .eq('data_aula', dataAula);

          if (frequenciaError) throw frequenciaError;

          const frequenciaMap = new Map(
            frequenciaData?.map(f => [f.aluno_id, f.status as StatusAula]) || []
          );

          const isCancelada = frequenciaData && frequenciaData.length > 0 && frequenciaData.every(f => f.status === 'aula_cancelada');
          setAulaCancelada(isCancelada || false);

          if (matriculasData) {
            const alunosList: AlunoFrequencia[] = matriculasData
              .filter(m => m.alunos)
              .map(m => {
                const aluno = m.alunos as any;
                return {
                  id: aluno.id,
                  matricula: aluno.matricula,
                  nome: aluno.nome,
                  status: frequenciaMap.get(aluno.id) || (isCancelada ? 'aula_cancelada' : 'pendente')
                };
              });
            
            setAlunos(alunosList.sort((a, b) => a.nome.localeCompare(b.nome)));
          }
        }

      } catch (error) {
        console.error('Erro ao carregar dados de frequência:', error);
      } finally {
        setLoading(false);
      }
    }

    loadFrequenciaData();
  }, [id, dataAula]);

  const handleStatusChange = (alunoId: string, novoStatus: StatusAula) => {
    setAlunos(alunos.map(aluno => 
      aluno.id === alunoId ? { ...aluno, status: novoStatus } : aluno
    ));
  };

  const handleMarcarTodos = (status: StatusAula) => {
    setAlunos(alunos.map(aluno => ({ ...aluno, status })));
  };

  const handleToggleAulaCancelada = (e: ChangeEvent<HTMLInputElement>) => {
    const cancelada = e.target.checked;
    setAulaCancelada(cancelada);
    if (cancelada) {
      handleMarcarTodos('aula_cancelada');
    } else {
      handleMarcarTodos('pendente');
    }
  };

  const handleSave = async () => {
    if (!id || !dataAula) return;
    
    const hasUnmarked = alunos.some(a => a.status === 'pendente');
    if (hasUnmarked && !aulaCancelada) {
      if (!window.confirm('Existem alunos sem marcação. Eles serão salvos como "Falta". Deseja continuar?')) {
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || null;

      const records = alunos.map(aluno => ({
        turma_id: id,
        aluno_id: aluno.id,
        data_aula: dataAula,
        status: aluno.status === 'pendente' ? 'falta' : aluno.status,
        registrado_por: userId
      }));

      const { error } = await supabase
        .from('frequencia')
        .upsert(records, { onConflict: 'turma_id, aluno_id, data_aula' });

      if (error) throw error;

      showNotification('success', 'Frequência salva com sucesso!');
    } catch (error: any) {
      console.error('Erro ao salvar frequência:', error);
      showNotification('error', 'Erro ao salvar frequência', error.message || 'Houve um problema ao conectar com o banco de dados.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading && !turma) {
    return <div className="flex justify-center items-center h-64">Carregando dados...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate(-1)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              Lista de Frequência
              {turma?.codigo && (
                <span className="ml-3 px-2 py-1 bg-emerald-100 text-emerald-800 text-xs font-mono rounded">
                  {turma.codigo}
                </span>
              )}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {turma?.modalidade} • {turma?.bairro} • {turma?.horario}
            </p>
          </div>
        </div>
        
        <button
          onClick={handleSave}
          disabled={isSubmitting || alunos.length === 0}
          className="flex items-center px-4 py-2 bg-emerald-600 text-white font-medium rounded-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 transition-colors"
        >
          <Save className="w-5 h-5 mr-2" />
          {isSubmitting ? 'Salvando...' : 'Salvar Frequência'}
        </button>
      </div>

      {/* Controles */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="relative w-full sm:w-auto">
            <label className="block text-xs font-medium text-gray-500 mb-1">Data da Aula (Apenas dias letivos)</label>
            <div className="flex items-center">
              <CalendarIcon className="w-5 h-5 text-gray-400 absolute left-3 bottom-2.5" />
              <select
                value={dataAula}
                onChange={(e) => setDataAula(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500 text-sm bg-white w-full sm:min-w-[180px]"
              >
                {datasDisponiveis.map(d => (
                  <option key={d} value={d}>
                    {new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="sm:pt-5">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input 
                type="checkbox" 
                checked={aulaCancelada}
                onChange={handleToggleAulaCancelada}
                className="rounded text-red-600 focus:ring-red-500 w-4 h-4"
              />
              <span className="text-sm font-medium text-red-700 flex items-center">
                <Ban className="w-4 h-4 mr-1" /> Aula Cancelada
              </span>
            </label>
          </div>
        </div>

        {!aulaCancelada && (
          <div className="flex flex-wrap items-center gap-2 lg:pt-5">
            <span className="text-sm text-gray-500 mr-2">Marcar todos:</span>
            <button 
              onClick={() => handleMarcarTodos('presente')}
              className="px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 rounded-md hover:bg-emerald-100 transition-colors"
            >
              Presente
            </button>
            <button 
              onClick={() => handleMarcarTodos('falta')}
              className="px-3 py-1.5 text-xs font-medium bg-red-50 text-red-700 rounded-md hover:bg-red-100 transition-colors"
            >
              Falta
            </button>
          </div>
        )}
      </div>

      {/* Tabela de Alunos */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-full sm:min-w-[600px]">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-sm uppercase tracking-wider border-b border-gray-200">
                <th className="px-6 py-4 font-medium hidden sm:table-cell">Matrícula</th>
                <th className="px-6 py-4 font-medium">Nome do Aluno</th>
                <th className="px-6 py-4 font-medium text-center">Status de Presença</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {alunos.map((aluno) => (
                <tr key={aluno.id} className={`hover:bg-gray-50 transition-colors ${aulaCancelada ? 'opacity-60 bg-gray-50' : ''}`}>
                  <td className="px-6 py-4 text-sm font-mono text-gray-500 hidden sm:table-cell">{aluno.matricula}</td>
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {aluno.nome}
                    <div className="sm:hidden text-xs text-gray-500 mt-1 font-mono">{aluno.matricula}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center space-x-2 sm:space-x-4">
                      <label className={`flex items-center p-2 rounded-lg cursor-pointer border transition-all ${aluno.status === 'presente' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'border-transparent text-gray-500 hover:bg-gray-100'} ${aulaCancelada ? 'pointer-events-none' : ''}`}>
                        <input 
                          type="radio" 
                          name={`status-${aluno.id}`} 
                          value="presente"
                          checked={aluno.status === 'presente'}
                          onChange={() => handleStatusChange(aluno.id, 'presente')}
                          disabled={aulaCancelada}
                          className="sr-only" 
                        />
                        <CheckCircle className={`w-5 h-5 mr-1.5 ${aluno.status === 'presente' ? 'text-emerald-600' : 'text-gray-400'}`} />
                        <span className="text-sm font-medium">Presente</span>
                      </label>

                      <label className={`flex items-center p-2 rounded-lg cursor-pointer border transition-all ${aluno.status === 'falta' ? 'bg-red-50 border-red-200 text-red-800' : 'border-transparent text-gray-500 hover:bg-gray-100'} ${aulaCancelada ? 'pointer-events-none' : ''}`}>
                        <input 
                          type="radio" 
                          name={`status-${aluno.id}`} 
                          value="falta"
                          checked={aluno.status === 'falta'}
                          onChange={() => handleStatusChange(aluno.id, 'falta')}
                          disabled={aulaCancelada}
                          className="sr-only" 
                        />
                        <XCircle className={`w-5 h-5 mr-1.5 ${aluno.status === 'falta' ? 'text-red-600' : 'text-gray-400'}`} />
                        <span className="text-sm font-medium">Falta</span>
                      </label>

                      <label className={`flex items-center p-2 rounded-lg cursor-pointer border transition-all ${aluno.status === 'falta_justificada' ? 'bg-yellow-50 border-yellow-200 text-yellow-800' : 'border-transparent text-gray-500 hover:bg-gray-100'} ${aulaCancelada ? 'pointer-events-none' : ''}`}>
                        <input 
                          type="radio" 
                          name={`status-${aluno.id}`} 
                          value="falta_justificada"
                          checked={aluno.status === 'falta_justificada'}
                          onChange={() => handleStatusChange(aluno.id, 'falta_justificada')}
                          disabled={aulaCancelada}
                          className="sr-only" 
                        />
                        <AlertCircle className={`w-5 h-5 mr-1.5 ${aluno.status === 'falta_justificada' ? 'text-yellow-600' : 'text-gray-400'}`} />
                        <span className="text-sm font-medium hidden sm:inline">Justificada</span>
                        <span className="text-sm font-medium sm:hidden">Justif.</span>
                      </label>
                      
                      <label className={`flex items-center p-2 rounded-lg cursor-pointer border transition-all ${aluno.status === 'pendente' ? 'bg-gray-100 border-gray-300 text-gray-800' : 'border-transparent text-gray-400 hover:bg-gray-100'} ${aulaCancelada ? 'pointer-events-none' : ''}`}>
                        <input 
                          type="radio" 
                          name={`status-${aluno.id}`} 
                          value="pendente"
                          checked={aluno.status === 'pendente'}
                          onChange={() => handleStatusChange(aluno.id, 'pendente')}
                          disabled={aulaCancelada}
                          className="sr-only" 
                        />
                        <span className="text-xs font-medium">Limpar</span>
                      </label>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
