import React from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, User, Trash2, Edit2, Briefcase, X, Clock, MapPin } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useNotification } from '../components/Notification';
import { ConfirmationModal } from '../components/ConfirmationModal';

export default function Funcionarios() {
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();

  const [searchTerm, setSearchTerm] = React.useState('');
  const [activeTab, setActiveTab] = React.useState<'todos' | 'professores' | 'equipe'>('todos');
  const [itemToDelete, setItemToDelete] = React.useState<string | null>(null);

  const { data: funcionarios, isLoading } = useQuery({
    queryKey: ['funcionarios'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('funcionarios')
        .select('*')
        .order('nome');
      
      if (error) {
        console.error('Erro ao buscar funcionários:', error);
        return [];
      }
      return data;
    }
  });

  const filteredFuncionarios = funcionarios?.filter(f => {
    const matchesSearch = f.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (f.email && f.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (f.cargo && f.cargo.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (!matchesSearch) return false;

    const isProfessor = f.cargo?.toLowerCase().includes('prof') || f.role === 'professor';
    if (activeTab === 'professores') return isProfessor;
    if (activeTab === 'equipe') return !isProfessor;
    return true;
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('funcionarios').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funcionarios'] });
      showNotification('success', 'Funcionário excluído com sucesso!');
      setItemToDelete(null);
    },
    onError: (error: any) => {
      console.error('Erro ao excluir:', error);
      setItemToDelete(null);
      let msg = 'Houve um erro ao excluir o funcionário.';
      if (error.code === '23503') {
        msg = 'Não é possível excluir este funcionário pois ele está vinculado a turmas ou outras atividades. Remova os vínculos primeiro.';
      }
      showNotification('error', 'Erro na exclusão', msg);
    }
  });

  const handleDelete = (id: string) => {
    setItemToDelete(id);
  };

  const [selectedProfDetails, setSelectedProfDetails] = React.useState<any>(null);

  const normalizeDay = (day: string) => {
    if (!day) return '';
    const d = day.trim().toLowerCase();
    if (d.startsWith('seg')) return 'Segunda';
    if (d.startsWith('ter')) return 'Terça';
    if (d.startsWith('qua')) return 'Quarta';
    if (d.startsWith('qui')) return 'Quinta';
    if (d.startsWith('sex')) return 'Sexta';
    if (d.startsWith('sab')) return 'Sábado';
    if (d.startsWith('dom')) return 'Domingo';
    return day;
  };

  const { data: turmas, isLoading: isLoadingTurmas } = useQuery({
    queryKey: ['turmas-with-auxiliares'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('turmas')
        .select('*, modalidades(nome), turmas_auxiliares(funcionario_id), equipamentos(tipo, bairro)');
      if (error) throw error;
      
      // Senior expert normalization and status filtering: more inclusive of active states
      const checkStatus = (status: string) => {
        const s = String(status || '').toLowerCase();
        return !s || s.includes('funcionamento') || s.includes('ativa') || s.includes('aberta') || s.includes('andamento') || s === 'ok';
      };

      return (data || [])
        .filter((t: any) => checkStatus(t.status))
        .map((t: any) => {
          // Normalize column names robustly
          const h_ini = t.horario_inicio || t.hora_inicio || '00:00';
          const h_fim = t.horario_fim || t.hora_fim || '00:00';
          
          let dias = t.dias_semana;
          if (typeof dias === 'string') {
            try {
              // Handle "{Day1,Day2}" or "["Day1","Day2"]" formats
              dias = dias.replace(/{|}|\[|\]|"/g, '').split(',').map((s: string) => s.trim());
            } catch (e) {
              dias = [];
            }
          }
          
          if (Array.isArray(dias)) {
            dias = dias.map(normalizeDay).filter(Boolean);
          } else {
            dias = [];
          }

          return {
            ...t,
            horario_inicio: h_ini,
            horario_fim: h_fim,
            dias_semana: dias
          };
        });
    }
  });

  const getProfessorStats = (funcionarioId: string) => {
    if (!turmas || !funcionarioId) return { count: 0, hours: 0, respCount: 0, auxCount: 0, respList: [], auxList: [] };
    
    const idToMatch = String(funcionarioId).toLowerCase();

    // Fix: Ensure we match against both potential column formats for professor_id/funcionario_id
    const respTurmas = turmas.filter(t => {
      const profIdRaw = t.professor_id;
      // Handle case where professor_id might be joined as an object or return as scalar UUID string
      const profId = String(typeof profIdRaw === 'object' && profIdRaw !== null ? (profIdRaw as any).id : (profIdRaw || '')).toLowerCase();
      return profId === idToMatch;
    });

    const auxTurmas = turmas.filter(t => {
      // Avoid double counting
      if (respTurmas.some(rt => rt.id === t.id)) return false;

      // Check legacy column
      const auxIdColRaw = String(t.professor_auxiliar_id || '').toLowerCase();
      if (auxIdColRaw === idToMatch) return true;
      
      // Check relation table
      return t.turmas_auxiliares && 
             Array.isArray(t.turmas_auxiliares) && 
             t.turmas_auxiliares.some((aux: any) => String(aux.funcionario_id).toLowerCase() === idToMatch);
    });
    
    // Unique list by ID
    const uniqueTurmasMap = new Map();
    [...respTurmas, ...auxTurmas].forEach(t => uniqueTurmasMap.set(t.id, t));
    const allTurmas = Array.from(uniqueTurmasMap.values());

    let totalMinutes = 0;
    allTurmas.forEach(t => {
      const h_inicio = t.horario_inicio;
      const h_fim = t.horario_fim;
      const dias = t.dias_semana;

      if (h_inicio && h_fim && Array.isArray(dias) && dias.length > 0) {
        try {
          // Normalize time string to HH:MM format (removing seconds if present)
          const parseTime = (time: string) => {
            const parts = time.split(':').map(Number);
            return { h: parts[0] || 0, m: parts[1] || 0 };
          };
          
          const t1 = parseTime(h_inicio);
          const t2 = parseTime(h_fim);
          
          const startTotal = t1.h * 60 + t1.m;
          const endTotal = t2.h * 60 + t2.m;
          const duration = endTotal - startTotal;
          
          if (duration > 0) {
            totalMinutes += duration * dias.length;
          } else if (duration < 0) {
            // Support classes crossing midnight (unlikely but robust)
            totalMinutes += (1440 + duration) * dias.length;
          }
        } catch (e) {
          console.warn('Erro ao calcular duracao:', t.id, e);
        }
      }
    });

    return {
      count: allTurmas.length,
      respCount: respTurmas.length,
      auxCount: auxTurmas.length,
      hours: Math.round((totalMinutes / 60) * 10) / 10,
      respList: respTurmas,
      auxList: auxTurmas,
      allTurmas: allTurmas,
      combinedList: allTurmas.map(t => `${t.modalidades?.nome || 'Turma'} (${t.codigo || 'S/C'})`)
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Funcionários e Professores</h1>
        <Link
          to="/funcionarios/novo"
          className="flex items-center justify-center px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Novo Funcionário
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50">
          <div className="flex bg-gray-200/50 p-1 rounded-lg w-fit">
            <button
              onClick={() => setActiveTab('todos')}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                activeTab === 'todos' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setActiveTab('professores')}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                activeTab === 'professores' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Professores
            </button>
            <button
              onClick={() => setActiveTab('equipe')}
              className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
                activeTab === 'equipe' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Equipe Técnica
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Buscar funcionário..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
            />
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-full sm:min-w-[800px]">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-sm uppercase tracking-wider border-b border-gray-200">
                <th className="px-6 py-4 font-bold text-xs">Nome</th>
                <th className="px-6 py-4 font-bold text-xs">Cargo/Função</th>
                <th className="px-6 py-4 font-bold text-xs">Permissões</th>
                {activeTab !== 'equipe' && (
                  <>
                    <th className="px-6 py-4 font-bold text-xs text-center">Carga Horária</th>
                    <th className="px-6 py-4 font-bold text-xs">Turmas Ativas</th>
                  </>
                )}
                <th className="px-6 py-4 font-bold text-right text-xs">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading || isLoadingTurmas ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-600 mr-2"></div>
                      Carregando funcionários...
                    </div>
                  </td>
                </tr>
              ) : filteredFuncionarios?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    Nenhum funcionário encontrado na categoria selecionada.
                  </td>
                </tr>
              ) : (
                filteredFuncionarios?.map((funcionario) => {
                  const stats = getProfessorStats(funcionario.id);
                  const isProfessor = funcionario.cargo?.toLowerCase().includes('prof') || funcionario.role === 'professor';

                  return (
                    <tr key={funcionario.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => setSelectedProfDetails({ funcionario, stats })}
                          className="flex items-center text-left group"
                        >
                          <div className={`h-9 w-9 rounded-full flex items-center justify-center mr-3 flex-shrink-0 transition-colors ${
                            isProfessor ? 'bg-emerald-100 group-hover:bg-emerald-200' : 'bg-blue-100 group-hover:bg-blue-200'
                          }`}>
                            <User className={`h-5 w-5 ${isProfessor ? 'text-emerald-600' : 'text-blue-600'}`} />
                          </div>
                          <div>
                            <span className="font-bold text-gray-900 block group-hover:text-emerald-700 transition-colors tracking-tight">{funcionario.nome}</span>
                            <div className="flex items-center gap-2 mt-0.5">
                              {funcionario.telefone && <span className="text-[9px] font-medium text-gray-400 capitalize">{funcionario.telefone}</span>}
                            </div>
                          </div>
                        </button>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center text-xs font-bold text-gray-700">
                            <Briefcase className="w-3.5 h-3.5 mr-1.5 text-gray-400" />
                            {funcionario.cargo}
                          </div>
                          {funcionario.email && (
                            <span className="text-[10px] text-gray-400 truncate max-w-[150px]">
                              {funcionario.email}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {funcionario.permissoes && funcionario.permissoes.length > 0 ? (
                            funcionario.permissoes.map((p: string) => (
                              <span 
                                key={p} 
                                className={`text-[8px] px-1 py-0.5 rounded uppercase font-bold tracking-tighter ${
                                  isProfessor 
                                    ? 'bg-gray-100 text-gray-500' 
                                    : 'bg-blue-50 text-blue-600 border border-blue-100'
                                }`}
                              >
                                {p}
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-300 text-xs">-</span>
                          )}
                        </div>
                      </td>
                      
                      {activeTab !== 'equipe' && (
                        <>
                          <td className="px-6 py-4 text-center">
                            {isProfessor ? (
                              <div className="flex flex-col items-center">
                                <span className={`text-sm font-black ${stats.hours > 0 ? 'text-emerald-700' : 'text-gray-300'}`}>
                                  {stats.hours > 0 ? `${stats.hours}h` : '0h'}
                                </span>
                                <span className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">semanais</span>
                              </div>
                            ) : (
                              <span className="text-gray-300 text-xs text-center block">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {isProfessor ? (
                              <div className="flex flex-col gap-1.5">
                                <button 
                                  onClick={() => setSelectedProfDetails({ funcionario, stats })}
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-all w-fit ${
                                    stats.count > 0 
                                      ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' 
                                      : 'bg-gray-100 text-gray-400'
                                  }`}
                                >
                                  {stats.count} {stats.count === 1 ? 'Atividade' : 'Atividades'}
                                </button>
                                {stats.count > 0 && (
                                  <div className="flex flex-wrap gap-1 max-w-[200px]">
                                    {stats.allTurmas?.slice(0, 2).map((t: any) => (
                                      <span key={t.id} className="text-[8px] bg-gray-50 border border-gray-100 text-gray-500 px-1 py-0.5 rounded font-mono" title={t.modalidades?.nome}>
                                        {t.codigo}
                                      </span>
                                    ))}
                                    {stats.count > 2 && <span className="text-[8px] text-gray-400 font-bold">+{stats.count - 2}</span>}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-300 text-xs text-center block">-</span>
                            )}
                          </td>
                        </>
                      )}
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end space-x-1">
                          <Link 
                            to={`/funcionarios/${funcionario.id}/editar`}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Link>
                          <button 
                            onClick={() => handleDelete(funcionario.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Confirmação de Deleção */}
      <ConfirmationModal
        isOpen={Boolean(itemToDelete)}
        onClose={() => setItemToDelete(null)}
        onConfirm={() => itemToDelete && deleteMutation.mutate(itemToDelete)}
        title="Excluir Funcionário"
        message="Tem certeza que deseja excluir este funcionário? Esta ação não pode ser desfeita e ele será removido de todas as turmas vinculadas."
        confirmText="Excluir"
        isLoading={deleteMutation.isPending}
      />

      {/* Popup de Detalhes do Professor */}
      {selectedProfDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-emerald-600 text-white">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mr-4">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold leading-tight">{selectedProfDetails.funcionario.nome}</h2>
                  <p className="text-sm opacity-80 uppercase tracking-widest text-[10px] font-bold">{selectedProfDetails.funcionario.cargo}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedProfDetails(null)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-[10px] uppercase font-black text-gray-400 mb-1">Carga Horária</p>
                  <p className="text-2xl font-black text-gray-900">{selectedProfDetails.stats.hours}h <span className="text-xs font-normal text-gray-500">/ sem</span></p>
                </div>
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <p className="text-[10px] uppercase font-black text-gray-400 mb-1">Turmas</p>
                  <p className="text-2xl font-black text-gray-900">{selectedProfDetails.stats.count}</p>
                </div>
              </div>

              {/* Contact Info */}
              <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100">
                <h3 className="text-[10px] uppercase font-black text-emerald-800 mb-3 tracking-widest flex items-center">
                   Informações de Contato
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-[9px] text-gray-400 uppercase font-bold">Email</p>
                    <p className="text-xs font-medium text-gray-700 truncate">{selectedProfDetails.funcionario.email || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-400 uppercase font-bold">Telefone</p>
                    <p className="text-xs font-medium text-gray-700">{selectedProfDetails.funcionario.telefone || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Responsible Classes */}
              <div>
                <h3 className="text-xs font-black uppercase text-gray-400 mb-3 flex items-center tracking-widest">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-2"></div>
                  Professor Responsável ({selectedProfDetails.stats.respCount})
                </h3>
                {selectedProfDetails.stats.respList.length > 0 ? (
                  <div className="space-y-2">
                    {selectedProfDetails.stats.respList.map((t: any) => (
                      <div key={t.id} className="p-3 bg-white border border-gray-100 rounded-lg flex items-center justify-between shadow-sm">
                        <div>
                          <div className="font-bold text-gray-900">{t.modalidades?.nome}</div>
                          <div className="text-[10px] text-gray-500 flex items-center mt-0.5">
                            <Clock className="w-3 h-3 mr-1" />
                            {t.horario_inicio} - {t.horario_fim} | {t.dias_semana?.join(', ')}
                          </div>
                          <div className="text-[10px] text-emerald-600 font-medium flex items-center mt-0.5">
                            <MapPin className="w-2.5 h-2.5 mr-1" />
                            {t.equipamentos?.tipo} - {t.equipamentos?.bairro}
                          </div>
                        </div>
                        <div className="text-xs font-mono bg-emerald-50 text-emerald-700 px-2 py-1 rounded">
                          {t.codigo}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic py-2">Nenhuma turma como responsável.</p>
                )}
              </div>

              {/* Auxiliary Classes */}
              <div>
                <h3 className="text-xs font-black uppercase text-gray-400 mb-3 flex items-center tracking-widest">
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2"></div>
                  Professor Auxiliar ({selectedProfDetails.stats.auxCount})
                </h3>
                {selectedProfDetails.stats.auxList.length > 0 ? (
                  <div className="space-y-2">
                    {selectedProfDetails.stats.auxList.map((t: any) => (
                      <div key={t.id} className="p-3 bg-white border border-gray-100 rounded-lg flex items-center justify-between shadow-sm">
                        <div>
                          <div className="font-bold text-gray-900">{t.modalidades?.nome}</div>
                          <div className="text-[10px] text-gray-500 flex items-center mt-0.5">
                            <Clock className="w-3 h-3 mr-1" />
                            {t.horario_inicio} - {t.horario_fim} | {t.dias_semana?.join(', ')}
                          </div>
                        </div>
                        <div className="text-xs font-mono bg-blue-50 text-blue-700 px-2 py-1 rounded">
                          {t.codigo}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic py-2">Nenhuma turma como auxiliar.</p>
                )}
              </div>
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100">
              <button 
                onClick={() => setSelectedProfDetails(null)}
                className="w-full py-3 bg-white border border-gray-200 rounded-xl font-bold text-gray-700 hover:bg-gray-100 transition-colors shadow-sm"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
