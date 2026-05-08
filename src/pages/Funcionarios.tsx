import React from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, User, Trash2, Edit2, Briefcase } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export default function Funcionarios() {
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = React.useState('');

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

  const filteredFuncionarios = funcionarios?.filter(f => 
    f.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (f.email && f.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (f.cargo && f.cargo.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('funcionarios').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['funcionarios'] });
    }
  });

  const handleDelete = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este funcionário?')) {
      deleteMutation.mutate(id);
    }
  };

  const { data: turmas } = useQuery({
    queryKey: ['turmas-with-auxiliares'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('turmas')
        .select('*, modalidades(nome), turmas_auxiliares(funcionario_id)');
      if (error) throw error;
      return data;
    }
  });

  const getProfessorStats = (funcionarioId: string) => {
    if (!turmas) return { count: 0, hours: 0, list: [] };
    
    const professorTurmas = turmas.filter(t => 
      t.professor_id === funcionarioId || 
      (t.turmas_auxiliares && t.turmas_auxiliares.some((aux: any) => aux.funcionario_id === funcionarioId))
    );

    let totalMinutes = 0;
    professorTurmas.forEach(t => {
      if (t.horario_inicio && t.horario_fim && t.dias_semana) {
        const [h1, m1] = t.horario_inicio.split(':').map(Number);
        const [h2, m2] = t.horario_fim.split(':').map(Number);
        const duration = (h2 * 60 + m2) - (h1 * 60 + m1);
        totalMinutes += duration * t.dias_semana.length;
      }
    });

    return {
      count: professorTurmas.length,
      hours: Math.round((totalMinutes / 60) * 10) / 10,
      list: professorTurmas.map(t => `${t.modalidades?.nome} (${t.codigo || 'S/C'})`)
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
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Buscar funcionário..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-full sm:min-w-[800px]">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-sm uppercase tracking-wider border-b border-gray-200">
                <th className="px-6 py-4 font-medium">Nome</th>
                <th className="px-6 py-4 font-medium">Cargo/Função</th>
                <th className="px-6 py-4 font-medium">Permissões</th>
                <th className="px-6 py-4 font-medium">Carga Horária (Semanal)</th>
                <th className="px-6 py-4 font-medium">Turmas</th>
                <th className="px-6 py-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    Carregando funcionários...
                  </td>
                </tr>
              ) : filteredFuncionarios?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Nenhum funcionário encontrado.
                  </td>
                </tr>
              ) : (
                filteredFuncionarios?.map((funcionario) => {
                  const stats = getProfessorStats(funcionario.id);
                  return (
                    <tr key={funcionario.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-emerald-100 flex items-center justify-center mr-3 flex-shrink-0">
                            <User className="h-4 w-4 text-emerald-600" />
                          </div>
                          <div>
                            <span className="font-medium text-gray-900">{funcionario.nome}</span>
                            <div className="text-xs text-gray-500">{funcionario.telefone}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        <div className="flex items-center">
                          <Briefcase className="w-4 h-4 mr-1 text-gray-400" />
                          {funcionario.cargo}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        <div className="flex flex-wrap gap-1">
                          {funcionario.permissoes && funcionario.permissoes.length > 0 ? (
                            funcionario.permissoes.map((p: string) => (
                              <span key={p} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] uppercase font-medium">
                                {p}
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {stats.hours > 0 ? `${stats.hours}h` : '-'}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        <div className="max-w-xs truncate text-xs">
                          {stats.list.length > 0 ? stats.list.join(', ') : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link 
                          to={`/funcionarios/${funcionario.id}/editar`}
                          className="text-blue-600 hover:text-blue-800 font-medium text-sm mr-3 inline-flex items-center"
                        >
                          <Edit2 className="w-4 h-4 mr-1" />
                          Editar
                        </Link>
                        <button 
                          onClick={() => handleDelete(funcionario.id)}
                          className="text-red-600 hover:text-red-800 font-medium text-sm inline-flex items-center"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Excluir
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
