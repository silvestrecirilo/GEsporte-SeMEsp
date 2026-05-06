import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, ArrowLeft, GraduationCap, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNotification } from '../components/Notification';

export default function MatriculaAluno() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { showNotification } = useNotification();
  const [aluno, setAluno] = useState<any>(null);
  const [availableTurmas, setAvailableTurmas] = useState<any[]>([]);
  const [selectedTurmas, setSelectedTurmas] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function fetchData() {
      if (!id) return;
      setIsLoading(true);
      try {
        // Fetch aluno
        const { data: alunoData } = await supabase
          .from('alunos')
          .select('*, matriculas(turma_id)')
          .eq('id', id)
          .single();
        
        if (alunoData) {
          setAluno(alunoData);
          setSelectedTurmas(alunoData.matriculas?.map((m: any) => m.turma_id) || []);
        }

        // Fetch turmas
        const { data: turmasData } = await supabase
          .from('turmas')
          .select('*, modalidades(nome), equipamentos(tipo)')
          .eq('status', 'ativa');
        
        if (turmasData) setAvailableTurmas(turmasData);
      } catch (error) {
        console.error('Erro ao buscar dados:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [id]);

  const handleToggleTurma = (turmaId: string) => {
    setSelectedTurmas(prev => 
      prev.includes(turmaId) 
        ? prev.filter(id => id !== turmaId) 
        : [...prev, turmaId]
    );
  };

  const handleSave = async () => {
    if (!id) return;
    setIsSaving(true);
    try {
      // Delete old matriculas
      await supabase.from('matriculas').delete().eq('aluno_id', id);

      // Insert new matriculas
      if (selectedTurmas.length > 0) {
        const matriculasToInsert = selectedTurmas.map(turmaId => ({
          aluno_id: id,
          turma_id: turmaId,
          status: 'ativa',
          data_matricula: new Date().toISOString()
        }));

        const { error } = await supabase.from('matriculas').insert(matriculasToInsert);
        if (error) throw error;
      }
      
      showNotification('success', 'Matrículas atualizadas com sucesso!');
      navigate('/alunos');
    } catch (error: any) {
      console.error('Erro ao salvar matrícula:', error);
      showNotification('error', 'Erro ao salvar matrícula', error.message || 'Houve um problema ao conectar com o banco de dados.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">Carregando dados...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate(-1)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Matrícula em Turmas</h1>
            <p className="text-gray-500">{aluno?.nome} ({aluno?.matricula})</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
        <div className="flex items-center space-x-2 text-emerald-600 border-b pb-2">
          <GraduationCap className="w-5 h-5" />
          <h2 className="text-lg font-semibold">Turmas Disponíveis</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {availableTurmas.map((turma) => {
            const isSelected = selectedTurmas.includes(turma.id);
            return (
              <button
                key={turma.id}
                onClick={() => handleToggleTurma(turma.id)}
                className={`flex items-start p-4 border rounded-xl text-left transition-all ${
                  isSelected 
                    ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500' 
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className={`mt-0.5 mr-3 flex-shrink-0 ${isSelected ? 'text-emerald-600' : 'text-gray-300'}`}>
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">{turma.modalidades?.nome}</div>
                  <div className="text-sm text-gray-600 mt-1">
                    {turma.equipamentos?.tipo}
                  </div>
                  <div className="text-xs text-gray-500 mt-2 flex flex-wrap gap-1">
                    {turma.dias_semana.map((dia: string) => (
                      <span key={dia} className="px-1.5 py-0.5 bg-gray-100 rounded">{dia}</span>
                    ))}
                    <span className="px-1.5 py-0.5 bg-gray-100 rounded ml-auto">{turma.horario_inicio}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {availableTurmas.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            Nenhuma turma ativa encontrada.
          </div>
        )}

        <div className="flex justify-end pt-6 border-t">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full sm:w-auto flex items-center justify-center px-8 py-3 bg-emerald-600 text-white font-medium rounded-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 transition-colors"
          >
            <Save className="w-5 h-5 mr-2" />
            {isSaving ? 'Salvando...' : 'Salvar Matrículas'}
          </button>
        </div>
      </div>
    </div>
  );
}
