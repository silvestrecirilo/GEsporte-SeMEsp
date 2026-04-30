import { Link } from 'react-router-dom';
import { Plus, Search, Activity, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export default function Modalidades() {
  const queryClient = useQueryClient();

  const { data: modalidades, isLoading } = useQuery({
    queryKey: ['modalidades'],
    queryFn: async () => {
      const { data, error } = await supabase.from('modalidades').select('*').order('nome');
      if (error) {
        console.error('Erro ao buscar modalidades:', error);
        // Fallback para o modo de protótipo (se a tabela não existir)
        return [
          { id: '1', nome: 'Futebol de Campo', idade_minima: 7, idade_maxima: 17, descricao: '' },
          { id: '2', nome: 'Natação', idade_minima: 0, idade_maxima: 99, descricao: '' },
          { id: '3', nome: 'Vôlei', idade_minima: 10, idade_maxima: 17, descricao: '' },
        ];
      }
      return data;
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('modalidades').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modalidades'] });
    }
  });

  const { data: stats } = useQuery({
    queryKey: ['modalidades-stats'],
    queryFn: async () => {
      const { data: turmas } = await supabase.from('turmas').select('id, modalidade_id, status');
      const { data: matriculas } = await supabase.from('matriculas').select('id, turma_id, status');
      
      const statsMap: Record<string, { turmas: number, alunos: number }> = {};
      
      turmas?.forEach(t => {
        if (!statsMap[t.modalidade_id]) statsMap[t.modalidade_id] = { turmas: 0, alunos: 0 };
        if (t.status === 'ativa') statsMap[t.modalidade_id].turmas++;
        
        const count = matriculas?.filter(m => m.turma_id === t.id && m.status === 'ativa').length || 0;
        statsMap[t.modalidade_id].alunos += count;
      });
      
      return statsMap;
    }
  });

  const handleDelete = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta modalidade?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Modalidades Esportivas</h1>
        <Link
          to="/modalidades/nova"
          className="flex items-center justify-center px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nova Modalidade
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Buscar modalidade..."
              className="w-full pl-10 pr-4 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-full sm:min-w-[500px]">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-sm uppercase tracking-wider border-b border-gray-200">
                <th className="px-6 py-4 font-medium">Nome da Modalidade</th>
                <th className="px-6 py-4 font-medium text-center hidden md:table-cell">Turmas Ativas</th>
                <th className="px-6 py-4 font-medium text-center hidden md:table-cell">Alunos Matriculados</th>
                <th className="px-6 py-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    Carregando modalidades...
                  </td>
                </tr>
              ) : modalidades?.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    Nenhuma modalidade cadastrada.
                  </td>
                </tr>
              ) : (
                modalidades?.map((modalidade) => (
                  <tr key={modalidade.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center mr-3 flex-shrink-0">
                          <Activity className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div>
                          <span className="font-medium text-gray-900">{modalidade.nome}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center font-medium text-gray-900 hidden md:table-cell">
                      {stats?.[modalidade.id]?.turmas || 0}
                    </td>
                    <td className="px-6 py-4 text-center font-medium text-gray-900 hidden md:table-cell">
                      {stats?.[modalidade.id]?.alunos || 0}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link 
                        to={`/modalidades/${modalidade.id}/editar`}
                        className="text-blue-600 hover:text-blue-800 font-medium text-sm mr-3"
                      >
                        Editar
                      </Link>
                      <button 
                        onClick={() => handleDelete(modalidade.id)}
                        className="text-red-600 hover:text-red-800 font-medium text-sm"
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
