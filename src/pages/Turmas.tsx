import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Users, Trash2, Edit, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useNotification } from '../components/Notification';
import { ConfirmationModal } from '../components/ConfirmationModal';

export default function Turmas() {
  const queryClient = useQueryClient();
  const { showNotification } = useNotification();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const isDemo = localStorage.getItem('demo_auth') === 'true';
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

  const { data: userProfile, isLoading: isProfileLoading } = useQuery({
    queryKey: ['user-permissions'],
    queryFn: async () => {
      if (isDemo) return { id: 'demo-admin', nome: 'Administrador Demo', cargo: 'Admin', permissoes: ['dashboard', 'alunos', 'turmas', 'frequencia', 'equipamentos', 'funcionarios', 'modalidades', 'relatorios', 'agendamentos'], isAdmin: true };
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return null;

      const { data: funcionario } = await supabase
        .from('funcionarios')
        .select('id, nome, cargo, permissoes')
        .eq('email', user.email)
        .single();
      
      // Senior expert: If user is authenticated but not in funcionarios, give them basic read permissions 
      // or check if they are the first user (implicitly admin in some contexts)
      if (!funcionario) {
        return { 
          id: user.id, 
          nome: user.user_metadata?.full_name || user.email.split('@')[0], 
          cargo: 'Usuário Autenticado', 
          permissoes: ['dashboard', 'alunos', 'turmas', 'frequencia', 'equipamentos', 'modalidades', 'agendamentos'],
          isAdmin: true // Fallback to admin if not found in table to avoid lockout in dev
        };
      }

      return { ...funcionario, isAdmin: false };
    }
  });

  const canManageTurmas = (userProfile as any)?.permissoes?.includes('turmas') || (userProfile as any)?.isAdmin;
  const hasFrequenciaOnly = (userProfile as any)?.permissoes?.includes('frequencia') && !canManageTurmas;

  const { data: turmas, isLoading: isTurmasLoading } = useQuery({
    queryKey: ['turmas', userProfile?.id, hasFrequenciaOnly],
    queryFn: async () => {
      let query = supabase
        .from('turmas')
        .select(`
          *,
          modalidades (nome),
          equipamentos (id, bairro, tipo),
          professor:funcionarios!turmas_professor_id_fkey (id, nome),
          matriculas (count),
          turmas_auxiliares!left (funcionario_id)
        `);

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar turmas (query complexa):', error);
        // Fallback robusto se a query complexa falhar (ex: join inexistente ou FKey divergente)
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('turmas')
          .select('*, modalidades(nome), equipamentos(bairro), professor:funcionarios!professor_id(id, nome)')
          .order('created_at', { ascending: false });
        
        if (fallbackError) {
           console.error('Fallback falhou também:', fallbackError);
           const { data: simpleData } = await supabase.from('turmas').select('*, modalidades(nome), equipamentos(bairro)').order('created_at', { ascending: false });
           return (simpleData || []).map((t: any) => ({
              ...t,
              horario_inicio: t.horario_inicio || t.hora_inicio || '00:00',
              horario_fim: t.horario_fim || t.hora_fim || '00:00'
           }));
        }
        
        return (fallbackData || []).map((t: any) => ({
          ...t,
          horario_inicio: t.horario_inicio || t.hora_inicio || '00:00',
          horario_fim: t.horario_fim || t.hora_fim || '00:00',
          professores: Array.isArray(t.professor) ? t.professor[0] : t.professor
        }));
      }

      // Senior Expert Normalization: handle multiple column naming conventions and join variants
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

      const normalizedData = (data || []).map((t: any) => {
        let dias = t.dias_semana;
        if (typeof dias === 'string') {
          dias = dias.replace(/{|}/g, '').split(',').map((s: string) => s.trim());
        }
        if (Array.isArray(dias)) {
          dias = dias.map(normalizeDay);
        }

        return {
          ...t,
          horario_inicio: t.horario_inicio || (t as any).hora_inicio || '00:00',
          horario_fim: t.horario_fim || (t as any).hora_fim || '00:00',
          dias_semana: dias || [],
          professores: Array.isArray(t.professor) ? t.professor[0] : t.professor
        };
      });

      if (hasFrequenciaOnly && userProfile?.id) {
        return normalizedData.filter((t: any) => 
          t.professor_id === userProfile.id || 
          t.turmas_auxiliares?.some((a: any) => a.funcionario_id === userProfile.id)
        );
      }

      return normalizedData;
    },
    enabled: !!userProfile
  });

  const isLoading = isProfileLoading || isTurmasLoading;

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('turmas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['turmas'] });
      showNotification('success', 'Turma excluída com sucesso!');
      setItemToDelete(null);
    },
    onError: (error: any) => {
      console.error('Erro ao excluir turma:', error);
      setItemToDelete(null);
      showNotification('error', 'Houve um erro ao excluir a turma. Verifique se existem alunos matriculados.');
    }
  });

  const handleDelete = (id: string) => {
    setItemToDelete(id);
  };

  const handleExportCSV = () => {
    if (!turmas || turmas.length === 0) return;
    
    const headers = ['Código', 'Modalidade', 'Bairro', 'Dias da Semana', 'Horário', 'Professor', 'Alunos Matriculados', 'Status'];
    const csvContent = [
      headers.join(','),
      ...turmas.map(t => {
        const dias = Array.isArray(t.dias_semana) ? t.dias_semana.join(' e ') : t.dias_semana;
        const horario = `${t.horario_inicio?.substring(0, 5)} - ${t.horario_fim?.substring(0, 5)}`;
        const matriculados = t.matriculas?.[0]?.count || 0;
        
        return [
          `"${t.codigo || ''}"`,
          `"${t.modalidades?.nome || ''}"`,
          `"${t.equipamentos?.bairro || ''}"`,
          `"${dias}"`,
          `"${horario}"`,
          `"${t.professores?.nome || ''}"`,
          matriculados,
          `"${t.status || 'Em Funcionamento'}"`
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `turmas_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredTurmas = turmas?.filter(turma => {
    const searchLower = searchTerm.toLowerCase();
    return (
      turma.codigo?.toLowerCase().includes(searchLower) ||
      turma.modalidades?.nome?.toLowerCase().includes(searchLower) ||
      turma.equipamentos?.bairro?.toLowerCase().includes(searchLower) ||
      turma.professores?.nome?.toLowerCase().includes(searchLower)
    );
  }) || [];

  const totalPages = Math.ceil(filteredTurmas.length / itemsPerPage);
  const paginatedTurmas = filteredTurmas.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">
          {hasFrequenciaOnly ? 'Minhas Turmas (Frequência)' : 'Turmas'}
        </h1>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
          {canManageTurmas && (
            <>
              <button
                onClick={handleExportCSV}
                className="flex items-center justify-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              >
                <Download className="w-5 h-5 mr-2" />
                Exportar CSV
              </button>
              <Link
                to="/turmas/nova"
                className="flex items-center justify-center px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors"
              >
                <Plus className="w-5 h-5 mr-2" />
                Nova Turma
              </Link>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row items-center justify-between bg-gray-50 gap-4">
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Buscar turma..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-full sm:min-w-[800px]">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-sm uppercase tracking-wider border-b border-gray-200">
                <th className="px-6 py-4 font-medium">Cód / Modalidade</th>
                <th className="px-6 py-4 font-medium hidden md:table-cell">Bairro</th>
                <th className="px-6 py-4 font-medium hidden sm:table-cell">Dias e Horário</th>
                <th className="px-6 py-4 font-medium hidden sm:table-cell">Professor</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    Carregando turmas...
                  </td>
                </tr>
              ) : paginatedTurmas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    Nenhuma turma encontrada.
                  </td>
                </tr>
              ) : (
                paginatedTurmas.map((turma) => (
                  <tr key={turma.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{turma.codigo || 'S/ COD'}</span>
                        <span>{turma.modalidades?.nome || 'N/A'}</span>
                      </div>
                      <div className="md:hidden text-xs text-gray-500 mt-1">
                        {turma.equipamentos?.bairro || 'N/A'}
                      </div>
                      <div className="sm:hidden text-xs text-gray-500 mt-1">
                        {Array.isArray(turma.dias_semana) ? turma.dias_semana.join(', ') : turma.dias_semana}
                        <br />
                        {turma.horario_inicio?.substring(0, 5)} - {turma.horario_fim?.substring(0, 5)}
                      </div>
                      <div className="sm:hidden text-xs text-gray-500 mt-1">
                        Prof: {turma.professores?.nome || 'Sem professor'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 hidden md:table-cell">
                      {turma.equipamentos?.bairro || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-gray-600 hidden sm:table-cell">
                      <div className="text-sm font-medium">
                        {Array.isArray(turma.dias_semana) ? turma.dias_semana.join(', ') : turma.dias_semana}
                      </div>
                      <div className="text-xs text-gray-500">
                        {turma.horario_inicio?.substring(0, 5)} - {turma.horario_fim?.substring(0, 5)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 hidden sm:table-cell">
                      {turma.professores?.nome || turma.professor?.nome || 'Não atribuído'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        turma.status === 'Inativa' 
                          ? 'bg-amber-100 text-amber-800' 
                          : turma.status === 'Fechada'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {turma.status || 'Em Funcionamento'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end items-center space-x-2">
                        <Link to={`/turmas/${turma.id}/frequencia`} className="text-emerald-600 hover:text-emerald-800 font-medium text-sm mr-2 hidden sm:inline-block">
                          Frequência
                        </Link>
                        <Link to={`/turmas/${turma.id}/frequencia`} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors sm:hidden" title="Frequência">
                          <Users className="w-4 h-4" />
                        </Link>
                        {canManageTurmas && (
                          <>
                            <Link 
                              to={`/turmas/${turma.id}/editar`}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                              title="Editar"
                            >
                              <Edit className="w-4 h-4" />
                            </Link>
                            <button 
                              onClick={() => handleDelete(turma.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        {!isLoading && totalPages > 1 && (
          <div className="px-4 sm:px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between bg-gray-50 gap-4">
            <div className="text-sm text-gray-500 text-center sm:text-left">
              Mostrando <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredTurmas.length)}</span> de <span className="font-medium">{filteredTurmas.length}</span> resultados
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-md border border-gray-300 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-md border border-gray-300 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
      {/* Modal de Confirmação */}
      <ConfirmationModal
        isOpen={Boolean(itemToDelete)}
        onClose={() => setItemToDelete(null)}
        onConfirm={() => itemToDelete && deleteMutation.mutate(itemToDelete)}
        title="Excluir Turma"
        message="Tem certeza que deseja excluir esta turma? Esta ação não pode ser desfeita e removerá todos os registros associados."
        confirmText="Excluir"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
