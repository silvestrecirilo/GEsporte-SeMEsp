import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Trash2, BookOpen } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Matriculas() {
  const [matriculas, setMatriculas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchMatriculas();
  }, []);

  async function fetchMatriculas() {
    try {
      const { data, error } = await supabase
        .from('matriculas')
        .select(`
          id,
          status,
          data_matricula,
          alunos (nome, matricula),
          turmas (
            codigo,
            dias_semana,
            horario_inicio,
            horario_fim,
            modalidades (nome),
            equipamentos (bairro)
          )
        `)
        .order('data_matricula', { ascending: false });

      if (error) throw error;
      setMatriculas(data || []);
    } catch (error) {
      console.error('Erro ao buscar matrículas:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Tem certeza que deseja excluir esta matrícula?')) return;

    try {
      const { error } = await supabase.from('matriculas').delete().eq('id', id);
      if (error) throw error;
      setMatriculas(matriculas.filter(m => m.id !== id));
    } catch (error) {
      console.error('Erro ao excluir matrícula:', error);
      alert('Erro ao excluir matrícula.');
    }
  }

  const filteredMatriculas = matriculas.filter(m => 
    m.alunos?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.alunos?.matricula?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.turmas?.modalidades?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.turmas?.codigo?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Matrículas</h1>
        <Link
          to="/matriculas/nova"
          className="flex items-center justify-center px-4 py-2 bg-emerald-600 text-white font-medium rounded-md hover:bg-emerald-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nova Matrícula
        </Link>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por aluno, matrícula ou modalidade..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-full sm:min-w-[600px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-500">
                <th className="p-4 font-medium">Aluno</th>
                <th className="p-4 font-medium hidden sm:table-cell">Turma / Modalidade</th>
                <th className="p-4 font-medium hidden md:table-cell">Local / Horário</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium hidden lg:table-cell">Data</th>
                <th className="p-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    Carregando matrículas...
                  </td>
                </tr>
              ) : filteredMatriculas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    Nenhuma matrícula encontrada.
                  </td>
                </tr>
              ) : (
                filteredMatriculas.map((matricula) => (
                  <tr key={matricula.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4">
                      <div className="font-medium text-gray-900">{matricula.alunos?.nome}</div>
                      <div className="text-sm text-gray-500">{matricula.alunos?.matricula}</div>
                      {/* Mobile only details */}
                      <div className="sm:hidden mt-2 space-y-1 text-sm">
                        <div className="text-gray-600"><span className="font-medium">Modalidade:</span> {matricula.turmas?.modalidades?.nome}</div>
                        <div className="text-gray-600"><span className="font-medium">Local:</span> {matricula.turmas?.equipamentos?.bairro}</div>
                        <div className="text-gray-500 text-xs">
                           {Array.isArray(matricula.turmas?.dias_semana) ? matricula.turmas?.dias_semana.join(', ') : matricula.turmas?.dias_semana} - {matricula.turmas?.horario_inicio?.substring(0, 5)}
                        </div>
                      </div>
                      <div className="md:hidden sm:block hidden mt-1 text-sm text-gray-500">
                        {matricula.turmas?.equipamentos?.bairro} | {Array.isArray(matricula.turmas?.dias_semana) ? matricula.turmas?.dias_semana.join(', ') : matricula.turmas?.dias_semana}
                      </div>
                    </td>
                    <td className="p-4 text-gray-600 hidden sm:table-cell">
                      <div className="flex flex-col">
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{matricula.turmas?.codigo || 'S/C'}</span>
                        <span>{matricula.turmas?.modalidades?.nome}</span>
                      </div>
                    </td>
                    <td className="p-4 hidden md:table-cell">
                      <div className="text-gray-900">{matricula.turmas?.equipamentos?.bairro}</div>
                      <div className="text-sm text-gray-500">
                        {Array.isArray(matricula.turmas?.dias_semana) ? matricula.turmas?.dias_semana.join(', ') : matricula.turmas?.dias_semana} - {matricula.turmas?.horario_inicio?.substring(0, 5)}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        matricula.status === 'ativa' ? 'bg-emerald-100 text-emerald-800' :
                        matricula.status === 'inativa' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {matricula.status.charAt(0).toUpperCase() + matricula.status.slice(1)}
                      </span>
                    </td>
                    <td className="p-4 text-gray-600 hidden lg:table-cell">
                      {new Date(matricula.data_matricula).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button 
                        onClick={() => handleDelete(matricula.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-5 h-5" />
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
