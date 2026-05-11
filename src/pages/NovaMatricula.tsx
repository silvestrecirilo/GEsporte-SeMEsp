import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNotification } from '../components/Notification';

export default function NovaMatricula() {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alunos, setAlunos] = useState<any[]>([]);
  const [turmas, setTurmas] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    aluno_id: '',
    turma_id: '',
    status: 'ativa',
  });

  useEffect(() => {
    async function fetchData() {
      try {
        const fetchTurmas = async () => {
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

          let res = await supabase.from('turmas').select(`
            id,
            codigo,
            dias_semana,
            horario_inicio,
            horario_fim,
            hora_inicio,
            hora_fim,
            modalidades (nome),
            equipamentos (bairro),
            status
          `).eq('status', 'Em Funcionamento');

          if (res.error && (res.error.message.includes('status') || res.error.message.includes('schema cache'))) {
            res = await supabase.from('turmas').select(`
              id,
              codigo,
              dias_semana,
              horario_inicio,
              horario_fim,
              hora_inicio,
              hora_fim,
              modalidades (nome),
              equipamentos (bairro)
            `);
          }
          if (res.data) {
            res.data = res.data.map((t: any) => {
              let dias = t.dias_semana;
              if (typeof dias === 'string') {
                dias = dias.replace(/{|}/g, '').split(',').map((s: string) => s.trim());
              }
              if (Array.isArray(dias)) {
                dias = dias.map(normalizeDay);
              }

              return {
                ...t,
                horario_inicio: t.horario_inicio || t.hora_inicio || '00:00',
                horario_fim: t.horario_fim || t.hora_fim || '00:00',
                dias_semana: dias || []
              };
            });
          }
          return res;
        };

        const [alunosRes, turmasRes] = await Promise.all([
          supabase.from('alunos').select('id, nome, matricula').order('nome'),
          fetchTurmas()
        ]);

        if (alunosRes.error) throw alunosRes.error;
        if (turmasRes.error) throw turmasRes.error;

        setAlunos(alunosRes.data || []);
        setTurmas(turmasRes.data || []);
      } catch (error) {
        console.error('Erro ao buscar dados:', error);
      }
    }
    fetchData();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('matriculas').insert([formData]);
      if (error) {
        if (error.code === '23505') { // Unique violation
          showNotification('warning', 'Duplicidade', 'Este aluno já está matriculado nesta turma.');
        } else {
          throw error;
        }
        return;
      }
      
      showNotification('success', 'Matrícula realizada com sucesso!');
      navigate('/matriculas');
    } catch (error: any) {
      console.error('Erro ao matricular aluno:', error);
      showNotification('error', 'Erro ao matricular aluno', error.message || 'Houve um problema ao conectar com o banco de dados.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      <div className="flex items-center space-x-4">
        <button onClick={() => navigate(-1)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nova Matrícula</h1>
          <p className="text-sm text-gray-500 mt-1">Vincule um aluno a uma turma</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Aluno</label>
            <select
              required
              value={formData.aluno_id}
              onChange={(e) => setFormData({ ...formData, aluno_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="">Selecione um aluno</option>
              {alunos.map((aluno) => (
                <option key={aluno.id} value={aluno.id}>
                  {aluno.nome} ({aluno.matricula})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Turma</label>
            <select
              required
              value={formData.turma_id}
              onChange={(e) => setFormData({ ...formData, turma_id: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="">Selecione uma turma</option>
              {turmas.map((turma) => (
                <option key={turma.id} value={turma.id}>
                  [{turma.codigo || 'S/C'}] {turma.modalidades?.nome} - {turma.equipamentos?.bairro} ({turma.dias_semana?.join(', ')} às {turma.horario_inicio})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              required
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="ativa">Ativa</option>
              <option value="inativa">Inativa</option>
              <option value="fila_espera">Fila de Espera</option>
            </select>
          </div>
        </div>

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-end space-y-3 sm:space-y-0 sm:space-x-4 border-t border-gray-100">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="w-full sm:w-auto px-4 py-2 text-gray-700 font-medium hover:bg-gray-50 rounded-md transition-colors border border-gray-300 sm:border-transparent"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto flex items-center justify-center px-4 py-2 bg-emerald-600 text-white font-medium rounded-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 transition-colors"
          >
            <Save className="w-5 h-5 mr-2" />
            Salvar Matrícula
          </button>
        </div>
      </form>
    </div>
  );
}
