import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Search, 
  MapPin, 
  Clock, 
  Filter,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Activity
} from 'lucide-react';
import { useNotification } from '../components/Notification';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

const atividadeSchema = z.object({
  titulo: z.string().min(3, 'Mínimo 3 caracteres'),
  equipamentoId: z.string().uuid('Selecione um equipamento'),
  diaSemana: z.string(),
  horarioInicio: z.string(),
  horarioFim: z.string(),
  tipo: z.enum(['proprio', 'terceiros']),
  descricao: z.string().optional(),
});

type AtividadeFormData = z.infer<typeof atividadeSchema>;

export default function Agendamentos() {
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();
  const [showNewModal, setShowNewModal] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filterEquipamento, setFilterEquipamento] = React.useState('all');
  const [view, setView] = React.useState<'list' | 'week'>('week');

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<AtividadeFormData>({
    resolver: zodResolver(atividadeSchema),
    defaultValues: {
      diaSemana: 'Segunda',
      tipo: 'proprio'
    }
  });

  const { data: equipamentos } = useQuery({
    queryKey: ['equipamentos-select'],
    queryFn: async () => {
      const { data, error } = await supabase.from('equipamentos').select('id, bairro, tipo').order('bairro');
      if (error) throw error;
      return data;
    }
  });

  const { data: atividades, isLoading } = useQuery({
    queryKey: ['atividades-externas', filterEquipamento],
    queryFn: async () => {
      let query = supabase.from('atividades_externas').select(`
        *,
        equipamentos (id, bairro, tipo)
      `);

      if (filterEquipamento !== 'all') {
        query = query.eq('equipamento_id', filterEquipamento);
      }

      const { data, error } = await query.order('dia_semana');
      if (error) throw error;
      return data;
    }
  });

  const { data: turmas } = useQuery({
    queryKey: ['turmas-agendamentos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('turmas').select(`
        id,
        codigo,
        modalidades (nome),
        equipamentos (id, bairro, tipo),
        dias_semana,
        hora_inicio,
        hora_fim,
        status
      `);
      if (error) throw error;
      return data?.filter((t: any) => {
        const s = (t.status || '').toLowerCase();
        const inactiveKeywords = ['inativa', 'fechada', 'encerrada', 'cancelada', 'suspensa'];
        return !inactiveKeywords.some(keyword => s.includes(keyword));
      }) || [];
    }
  });

  const createAtividade = useMutation({
    mutationFn: async (data: AtividadeFormData) => {
      const { error } = await supabase.from('atividades_externas').insert([{
        titulo: data.titulo,
        equipamento_id: data.equipamentoId,
        dia_semana: data.diaSemana,
        horario_inicio: data.horarioInicio,
        horario_fim: data.horarioFim,
        tipo: data.tipo,
        descricao: data.descricao
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atividades-externas'] });
      showNotification('success', 'Atividade agendada!', 'O novo agendamento foi salvo com sucesso.');
      setShowNewModal(false);
      reset();
    },
    onError: (error: any) => {
      showNotification('error', 'Falha ao agendar', error.message);
    }
  });

  const deleteAtividade = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('atividades_externas').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['atividades-externas'] });
      showNotification('success', 'Agendamento removido', 'A atividade foi excluída com sucesso.');
    }
  });

  const days = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

  const onSubmit = (data: AtividadeFormData) => {
    createAtividade.mutate(data);
  };

  const filteredAtividades = (atividades || []).filter(a => 
    a.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.equipamentos?.bairro.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agendamentos</h1>
          <p className="text-sm text-gray-500">Gestão de atividades e ocupação dos equipamentos</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView(view === 'list' ? 'week' : 'list')}
            className="flex items-center px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
          >
            {view === 'list' ? 'Ver Quadro' : 'Ver Lista'}
          </button>
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5 mr-2" />
            Novo Agendamento
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por título ou bairro..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <select
              className="pl-9 pr-8 py-2 border border-gray-200 rounded-lg appearance-none bg-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
              value={filterEquipamento}
              onChange={(e) => setFilterEquipamento(e.target.value)}
            >
              <option value="all">Todos Equipamentos</option>
              {equipamentos?.map(eq => (
                <option key={eq.id} value={eq.id}>{eq.bairro} ({eq.tipo})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {view === 'week' ? (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <div className="min-w-[1200px]">
            <div className="grid grid-cols-7 gap-4">
              {days.map((day) => (
                <div key={day} className="space-y-4">
                  <div className="text-center font-bold text-gray-700 text-sm border-b pb-2 mb-4">
                    {day}
                  </div>
                  <div className="space-y-3">
                    {/* Turmas do Sistema */}
                    {turmas?.filter(t => t.dias_semana?.some((d: string) => d.includes(day)))
                      .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))
                      .map((t: any) => (
                        <div key={t.id} className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg group cursor-default">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-emerald-700">
                              {t.hora_inicio.substring(0, 5)} - {t.hora_fim.substring(0, 5)}
                            </span>
                            <span className="text-[9px] bg-emerald-200 text-emerald-900 px-1 rounded font-mono">
                              {t.codigo}
                            </span>
                          </div>
                          <div className="text-sm font-bold text-gray-900 truncate">
                            {t.modalidades?.nome}
                          </div>
                          <div className="text-[10px] text-gray-500 flex items-center mt-1">
                            <MapPin className="w-2.5 h-2.5 mr-1" />
                            <span className="truncate">{t.equipamentos?.bairro}</span>
                          </div>
                        </div>
                      ))}

                    {/* Atividades Externas / Agendamentos */}
                    {filteredAtividades?.filter(a => a.dia_semana === day)
                      .sort((a, b) => a.horario_inicio.localeCompare(b.horario_inicio))
                      .map(a => (
                        <div key={a.id} className={`p-3 border rounded-lg group relative ${
                          a.tipo === 'terceiros' 
                          ? 'bg-red-50 border-red-100' 
                          : 'bg-blue-50 border-blue-100'
                        }`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-[10px] font-bold ${a.tipo === 'terceiros' ? 'text-red-700' : 'text-blue-700'}`}>
                              {a.horario_inicio.substring(0, 5)} - {a.horario_fim.substring(0, 5)}
                            </span>
                            <span className={`text-[9px] px-1 rounded font-mono ${a.tipo === 'terceiros' ? 'bg-red-200 text-red-900' : 'bg-blue-200 text-blue-900'}`}>
                              {a.tipo === 'terceiros' ? 'EXT' : 'PRP'}
                            </span>
                          </div>
                          <div className="text-sm font-bold text-gray-900 truncate">
                            {a.titulo}
                          </div>
                          <div className="text-[10px] text-gray-500 flex items-center mt-1">
                            <MapPin className="w-2.5 h-2.5 mr-1" />
                            <span className="truncate">{a.equipamentos?.bairro}</span>
                          </div>
                          <button
                            onClick={() => {
                              if (window.confirm('Excluir este agendamento?')) {
                                deleteAtividade.mutate(a.id);
                              }
                            }}
                            className="absolute -top-2 -right-2 p-1 bg-white border border-gray-200 text-red-500 rounded-full opacity-0 group-hover:opacity-100 shadow-sm transition-opacity"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}

                    {turmas?.filter(t => t.dias_semana?.some((d: string) => d.includes(day))).length === 0 &&
                     filteredAtividades?.filter(a => a.dia_semana === day).length === 0 && (
                      <div className="text-[10px] text-gray-400 text-center italic py-8 border border-dashed border-gray-100 rounded-lg">
                        Livre
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Atividade</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Equipamento</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Data/Horário</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredAtividades?.map(a => (
                <tr key={a.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className={`p-2 rounded-lg mr-3 ${a.tipo === 'terceiros' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                        <CalendarIcon className="w-4 h-4" />
                      </div>
                      <span className="font-medium text-gray-900">{a.titulo}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="text-sm text-gray-900">{a.equipamentos?.bairro}</span>
                      <span className="text-xs text-gray-500">{a.equipamentos?.tipo}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-900">{a.dia_semana}</span>
                      <span className="text-xs text-gray-500">{a.horario_inicio.substring(0, 5)} - {a.horario_fim.substring(0, 5)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      a.tipo === 'terceiros' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {a.tipo === 'terceiros' ? 'Eventos/Terceiros' : 'Atividade Própria'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => {
                        if (window.confirm('Excluir este agendamento?')) {
                          deleteAtividade.mutate(a.id);
                        }
                      }}
                      className="text-gray-400 hover:text-red-600 transition-colors p-1"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredAtividades?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500 italic">
                    Nenhum agendamento encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 bg-emerald-600 flex items-center justify-between text-white">
              <h3 className="text-lg font-bold">Novo Agendamento</h3>
              <button onClick={() => setShowNewModal(false)} className="hover:bg-white/10 p-1 rounded-full text-white">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título da Atividade</label>
                <input
                  {...register('titulo')}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="Ex: Treino de Vôlei Master"
                />
                {errors.titulo && <p className="text-xs text-red-500 mt-1">{errors.titulo.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Equipamento</label>
                  <select
                    {...register('equipamentoId')}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="">Selecionar...</option>
                    {equipamentos?.map(eq => (
                      <option key={eq.id} value={eq.id}>{eq.bairro} ({eq.tipo})</option>
                    ))}
                  </select>
                  {errors.equipamentoId && <p className="text-xs text-red-500 mt-1">{errors.equipamentoId.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select
                    {...register('tipo')}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    <option value="proprio">Próprio</option>
                    <option value="terceiros">Terceiros/Intervenção</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dia</label>
                  <select
                    {...register('diaSemana')}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    {days.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Início</label>
                  <input
                    type="time"
                    {...register('horarioInicio')}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fim</label>
                  <input
                    type="time"
                    {...register('horarioFim')}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição (Opcional)</label>
                <textarea
                  {...register('descricao')}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                  placeholder="Informações adicionais..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-6 py-2 text-gray-600 font-medium hover:bg-gray-50 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? 'Salvando...' : 'Salvar Agendamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
