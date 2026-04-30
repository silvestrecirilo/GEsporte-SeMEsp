import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Trash2, Edit, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export default function Alunos() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { data: alunos, isLoading } = useQuery({
    queryKey: ['alunos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('alunos').select('*').order('nome');
      if (error) {
        console.error('Erro ao buscar alunos:', error);
        return [];
      }
      return data;
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('alunos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alunos'] });
    }
  });

  const handleDelete = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este aluno?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleExportCSV = () => {
    if (!alunos || alunos.length === 0) return;
    
    const headers = ['Matrícula', 'Nome', 'Data Nascimento', 'Bairro', 'Telefone'];
    const csvContent = [
      headers.join(','),
      ...alunos.map(a => [
        a.matricula,
        `"${a.nome}"`,
        a.data_nascimento || '',
        `"${a.bairro || ''}"`,
        `"${a.telefone_responsavel || ''}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `alunos_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredAlunos = alunos?.filter(aluno => 
    aluno.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    aluno.matricula.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const totalPages = Math.ceil(filteredAlunos.length / itemsPerPage);
  const paginatedAlunos = filteredAlunos.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Alunos</h1>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
          <button
            onClick={handleExportCSV}
            className="flex items-center justify-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            <Download className="w-5 h-5 mr-2" />
            Exportar CSV
          </button>
          <Link
            to="/alunos/novo"
            className="flex items-center justify-center px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            Novo Aluno
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row items-center justify-between bg-gray-50 gap-4">
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Buscar aluno..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1); // Reset to first page on search
              }}
              className="w-full pl-10 pr-4 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px] sm:min-w-0">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-sm uppercase tracking-wider border-b border-gray-200">
                <th className="px-6 py-4 font-medium hidden sm:table-cell">Matrícula</th>
                <th className="px-6 py-4 font-medium">Nome</th>
                <th className="px-6 py-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                    Carregando alunos...
                  </td>
                </tr>
              ) : paginatedAlunos.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-gray-500">
                    Nenhum aluno encontrado.
                  </td>
                </tr>
              ) : (
                paginatedAlunos.map((aluno) => (
                  <tr key={aluno.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-mono text-sm text-gray-600 hidden sm:table-cell">{aluno.matricula}</td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {aluno.nome}
                      <div className="sm:hidden text-xs text-gray-500 mt-1 font-mono">
                        {aluno.matricula}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end space-x-2">
                        <Link 
                          to={`/alunos/${aluno.id}/matricula`}
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors"
                          title="Matricular em Turmas"
                        >
                          <Plus className="w-4 h-4" />
                        </Link>
                        <Link 
                          to={`/alunos/${aluno.id}/editar`}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                        <button 
                          onClick={() => handleDelete(aluno.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
              Mostrando <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> a <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredAlunos.length)}</span> de <span className="font-medium">{filteredAlunos.length}</span> resultados
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
    </div>
  );
}
