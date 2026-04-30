import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, ArrowLeft, Calendar, Clock, MapPin, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

const turmaSchema = z.object({
  codigo: z.string().min(1, 'Código é obrigatório').max(20, 'Código muito longo'),
  modalidadeId: z.string().min(1, 'Modalidade é obrigatória'),
  equipamentoId: z.string().min(1, 'Equipamento é obrigatório'),
  diasSemana: z.array(z.string()).min(1, 'Selecione pelo menos um dia da semana'),
  horaInicio: z.string().min(1, 'Horário de início é obrigatório'),
  horaFim: z.string().min(1, 'Horário de término é obrigatório'),
  professorId: z.string().min(1, 'Professor responsável é obrigatório'),
  professoresAuxiliares: z.array(z.string()).optional(),
});

type TurmaFormData = z.infer<typeof turmaSchema>;

const DIAS_SEMANA = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

const HORARIOS_SUGERIDOS = Array.from({ length: 33 }, (_, i) => {
  const startHour = 6;
  const minutes = i * 30;
  const hour = Math.floor(startHour + minutes / 60);
  const min = minutes % 60;
  return `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
});

const DURRACOES = [
  { label: '45 min', value: 45 },
  { label: '50 min', value: 50 },
  { label: '60 min', value: 60 },
  { label: '1h 30m', value: 90 },
  { label: '2h', value: 120 },
];

export default function NovaTurma() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [isLoading, setIsLoading] = useState(false);
  
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TurmaFormData>({
    resolver: zodResolver(turmaSchema),
    defaultValues: {
      codigo: '',
      diasSemana: [],
      professoresAuxiliares: [],
    }
  });

  const selectedModalidadeId = watch('modalidadeId');
  const selectedEquipamentoId = watch('equipamentoId');
  const currentCodigo = watch('codigo');
  const horaInicio = watch('horaInicio');
  const horaFim = watch('horaFim');

  const aplicarDuracao = (minutos: number) => {
    if (!horaInicio) return;
    const [h, m] = horaInicio.split(':').map(Number);
    const date = new Date();
    date.setHours(h, m + minutos, 0);
    setValue('horaFim', `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`);
  };

  useEffect(() => {
    async function fetchTurma() {
      if (!id) return;
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('turmas')
          .select('*, turmas_auxiliares(funcionario_id)')
          .eq('id', id)
          .single();

        if (error) throw error;

        if (data) {
          reset({
            codigo: data.codigo || '',
            modalidadeId: data.modalidade_id,
            equipamentoId: data.equipamento_id,
            diasSemana: Array.isArray(data.dias_semana) ? data.dias_semana : [data.dias_semana],
            horaInicio: data.horario_inicio?.substring(0, 5) || '',
            horaFim: data.horario_fim?.substring(0, 5) || '',
            professorId: data.professor_id || '',
            professoresAuxiliares: data.turmas_auxiliares?.map((a: any) => a.funcionario_id) || [],
          });
        }
      } catch (error) {
        console.error('Erro ao buscar turma:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchTurma();
  }, [id, reset]);

  // Fetch Modalidades
  const { data: modalidades } = useQuery({
    queryKey: ['modalidades-select'],
    queryFn: async () => {
      const { data } = await supabase.from('modalidades').select('id, nome').order('nome');
      return data || [];
    }
  });

  // Fetch Equipamentos
  const { data: equipamentos } = useQuery({
    queryKey: ['equipamentos-select'],
    queryFn: async () => {
      const { data } = await supabase.from('equipamentos').select('id, tipo, bairro, endereco').order('bairro');
      return data || [];
    }
  });

  // Auto-generate code
  useEffect(() => {
    async function generateCode() {
      if (!id && selectedModalidadeId && !currentCodigo && modalidades) {
        const mod = modalidades.find(m => m.id === selectedModalidadeId);
        
        if (mod) {
          // Get total count of turmas to create a sequence
          const { count, error } = await supabase
            .from('turmas')
            .select('*', { count: 'exact', head: true });

          if (!error) {
            const nextSequence = (count || 0) + 1;
            const modPrefix = mod.nome.substring(0, 4).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            setValue('codigo', `${modPrefix}-${nextSequence.toString().padStart(2, '0')}`);
          }
        }
      }
    }
    
    generateCode();
  }, [selectedModalidadeId, modalidades, setValue, id, currentCodigo]);

  // Filtered Equipamentos based on selected modality (mock logic for now)
  const filteredEquipamentos = equipamentos || [];

  // Fetch Professores
  const { data: professores } = useQuery({
    queryKey: ['professores-select'],
    queryFn: async () => {
      const { data } = await supabase.from('funcionarios').select('id, nome').eq('role', 'professor').order('nome');
      return data || [];
    }
  });

  const onSubmit = async (data: TurmaFormData) => {
    try {
      const turmaData = {
        codigo: data.codigo,
        modalidade_id: data.modalidadeId,
        equipamento_id: data.equipamentoId,
        professor_id: data.professorId,
        dias_semana: data.diasSemana,
        horario_inicio: data.horaInicio,
        horario_fim: data.horaFim,
        capacidade: 30,
        status: 'ativa'
      };

      let turmaId = id;

      if (id) {
        const { error } = await supabase
          .from('turmas')
          .update(turmaData)
          .eq('id', id);

        if (error) throw error;
      } else {
        const { data: newTurma, error } = await supabase
          .from('turmas')
          .insert([turmaData])
          .select()
          .single();

        if (error) throw error;
        turmaId = newTurma.id;
      }

      // Update auxiliary professors
      if (turmaId) {
        await supabase.from('turmas_auxiliares').delete().eq('turma_id', turmaId);
        
        if (data.professoresAuxiliares && data.professoresAuxiliares.length > 0) {
          const auxiliaresToInsert = data.professoresAuxiliares.map(profId => ({
            turma_id: turmaId,
            funcionario_id: profId
          }));
          await supabase.from('turmas_auxiliares').insert(auxiliaresToInsert);
        }
      }
      
      navigate('/turmas');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar os dados.');
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Carregando dados...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate(-1)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{id ? 'Editar Turma' : 'Nova Turma'}</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Local e Modalidade */}
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900 border-b pb-2 flex items-center">
            <MapPin className="w-5 h-5 mr-2 text-emerald-600" />
            Local e Modalidade
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Código da Turma (Ex: FUT-01)</label>
              <input 
                {...register('codigo')} 
                placeholder="Identificação alfanumérica"
                className="w-full px-3 py-2 border rounded-md focus:ring-emerald-500 focus:border-emerald-500" 
              />
              {errors.codigo && <p className="text-red-500 text-xs">{errors.codigo.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Modalidade</label>
              <select {...register('modalidadeId')} className="w-full px-3 py-2 border rounded-md focus:ring-emerald-500 focus:border-emerald-500 bg-white">
                <option value="">Selecione a modalidade...</option>
                {modalidades?.map(m => (
                  <option key={m.id} value={m.id}>{m.nome}</option>
                ))}
              </select>
              {errors.modalidadeId && <p className="text-red-500 text-xs">{errors.modalidadeId.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Equipamento Esportivo (Bairro)</label>
              <select {...register('equipamentoId')} className="w-full px-3 py-2 border rounded-md focus:ring-emerald-500 focus:border-emerald-500 bg-white">
                <option value="">Selecione o equipamento...</option>
                {filteredEquipamentos.map(e => (
                  <option key={e.id} value={e.id}>{e.tipo} ({e.bairro})</option>
                ))}
              </select>
              {errors.equipamentoId && <p className="text-red-500 text-xs">{errors.equipamentoId.message}</p>}
            </div>
          </div>
        </div>

        {/* Dias e Horários */}
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900 border-b pb-2 flex items-center">
            <Calendar className="w-5 h-5 mr-2 text-emerald-600" />
            Dias e Horários
          </h2>
          
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">Dias da Semana</label>
            <div className="flex flex-wrap gap-2 sm:gap-3">
              {DIAS_SEMANA.map((dia) => (
                <label key={dia} className="flex items-center space-x-2 bg-gray-50 px-3 sm:px-4 py-2 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors">
                  <input
                    type="checkbox"
                    value={dia}
                    {...register('diasSemana')}
                    className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                  />
                  <span className="text-sm font-medium text-gray-700">{dia}</span>
                </label>
              ))}
            </div>
            {errors.diasSemana && <p className="text-red-500 text-xs">{errors.diasSemana.message}</p>}
          </div>

          <div className="space-y-8">
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700 flex items-center">
                <Clock className="w-4 h-4 mr-1 text-emerald-600" />
                Horário de Início
              </label>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {HORARIOS_SUGERIDOS.map((h) => (
                  <button
                    key={`start-${h}`}
                    type="button"
                    onClick={() => setValue('horaInicio', h)}
                    className={`py-2 text-xs font-medium rounded-md border transition-all ${
                      horaInicio === h
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300 hover:bg-emerald-50'
                    }`}
                  >
                    {h}
                  </button>
                ))}
              </div>
              <div className="flex items-center space-x-2">
                <input 
                  type="time" 
                  {...register('horaInicio')} 
                  className="w-32 px-3 py-1.5 border rounded-md focus:ring-emerald-500 focus:border-emerald-500 text-sm" 
                />
                <span className="text-xs text-gray-400 font-italic">(ou digite o horário)</span>
              </div>
              {errors.horaInicio && <p className="text-red-500 text-xs">{errors.horaInicio.message}</p>}
            </div>

            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <label className="block text-sm font-medium text-gray-700 flex items-center">
                  <Clock className="w-4 h-4 mr-1 text-emerald-600" />
                  Horário de Término
                </label>
                
                {horaInicio && (
                  <div className="flex items-center space-x-2 overflow-x-auto pb-1 sm:pb-0">
                    <span className="text-[10px] font-bold text-gray-400 uppercase whitespace-nowrap">Duração:</span>
                    {DURRACOES.map((d) => (
                      <button
                        key={d.value}
                        type="button"
                        onClick={() => aplicarDuracao(d.value)}
                        className="px-2 py-1 bg-gray-100 hover:bg-emerald-100 hover:text-emerald-700 text-gray-600 rounded text-[10px] font-bold transition-colors whitespace-nowrap"
                      >
                        +{d.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {HORARIOS_SUGERIDOS.map((h) => (
                  <button
                    key={`end-${h}`}
                    type="button"
                    onClick={() => setValue('horaFim', h)}
                    className={`py-2 text-xs font-medium rounded-md border transition-all ${
                      horaFim === h
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                    }`}
                  >
                    {h}
                  </button>
                ))}
              </div>
              <div className="flex items-center space-x-2">
                <input 
                  type="time" 
                  {...register('horaFim')} 
                  className="w-32 px-3 py-1.5 border rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm" 
                />
                <span className="text-xs text-gray-400 font-italic">(ou digite o horário)</span>
              </div>
              {errors.horaFim && <p className="text-red-500 text-xs">{errors.horaFim.message}</p>}
            </div>
          </div>
        </div>

        {/* Professores */}
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900 border-b pb-2 flex items-center">
            <Users className="w-5 h-5 mr-2 text-emerald-600" />
            Professores
          </h2>
          
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Professor Responsável</label>
              <select {...register('professorId')} className="w-full md:w-1/2 px-3 py-2 border rounded-md focus:ring-emerald-500 focus:border-emerald-500 bg-white">
                <option value="">Selecione o professor...</option>
                {professores?.map(p => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
              {errors.professorId && <p className="text-red-500 text-xs">{errors.professorId.message}</p>}
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">Professores Auxiliares</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {professores?.map(p => (
                  <label key={p.id} className="flex items-center p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      value={p.id}
                      {...register('professoresAuxiliares')}
                      className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 mr-3"
                    />
                    <span className="text-sm text-gray-700">{p.nome}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto flex items-center justify-center px-6 py-3 bg-emerald-600 text-white font-medium rounded-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 transition-colors"
          >
            <Save className="w-5 h-5 mr-2" />
            {isSubmitting ? 'Salvando...' : (id ? 'Salvar Alterações' : 'Cadastrar Turma')}
          </button>
        </div>
      </form>
    </div>
  );
}
