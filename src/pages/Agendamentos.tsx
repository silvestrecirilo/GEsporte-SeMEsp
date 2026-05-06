import { useState, useEffect, FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, MapPin, Clock, Filter, ChevronLeft, ChevronRight, Activity, Plus, X, AlertCircle } from 'lucide-react';
import { useNotification } from '../components/Notification';

export default function Agendamentos() {
  const { showNotification } = useNotification();
  const [loading, setLoading] = useState(true);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [equipamentos, setEquipamentos] = useState<any[]>([]);
  const [atividadesExternas, setAtividadesExternas] = useState<any[]>([]);
  const [selectedEquipamento, setSelectedEquipamento] = useState<string>('all');
  const [viewType, setViewType] = useState<'semana' | 'dia'>('semana');
  const [selectedDay, setSelectedDay] = useState<string>('Segunda');
  const [showModal, setShowModal] = useState(false);
  const [newActivity, setNewActivity] = useState({
    titulo: '',
    equipamento_id: '',
    dia_semana: 'Segunda',
    horario_inicio: '08:00',
    horario_fim: '09:00',
    tipo: 'proprio',
    data_inicio: '',
    data_fim: '',
    descricao: ''
  });
  
  const diasSemana = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

  async function fetchData() {
    try {
      const [turmasRes, equipamentosRes, atividadesRes] = await Promise.all([
        supabase.from('turmas').select(`
          id,
          dias_semana,
          horario_inicio,
          horario_fim,
          modalidades (nome),
          equipamentos (id, bairro, tipo)
        `).eq('status', 'ativa'),
        supabase.from('equipamentos').select('id, bairro, tipo').order('bairro'),
        supabase.from('atividades_externas').select('*')
      ]);

      if (turmasRes.error) throw turmasRes.error;
      if (equipamentosRes.error) throw equipamentosRes.error;
      if (atividadesRes.error) throw atividadesRes.error;

      setTurmas(turmasRes.data || []);
      setEquipamentos(equipamentosRes.data || []);
      setAtividadesExternas(atividadesRes.data || []);
    } catch (error) {
      console.error('Erro ao buscar agendamentos:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateActivity = async (e: FormEvent) => {
    e.preventDefault();

    if (newActivity.horario_fim <= newActivity.horario_inicio) {
      showNotification('warning', 'Horário inválido', 'O horário de fim deve ser posterior ao horário de início.');
      return;
    }

    // Check for conflicts with regular classes (turmas)
    const conflictWithTurma = turmas.find(t => 
      t.equipamentos?.id === newActivity.equipamento_id &&
      t.dias_semana?.includes(newActivity.dia_semana) &&
      ((newActivity.horario_inicio < t.horario_fim) && (newActivity.horario_fim > t.horario_inicio))
    );

    // Check for conflicts with other external activities
    const conflictWithExterna = atividadesExternas.find(a => {
      const sameEquipment = a.equipamento_id === newActivity.equipamento_id;
      const sameDay = a.dia_semana === newActivity.dia_semana;
      const timeOverlap = (newActivity.horario_inicio < a.horario_fim) && (newActivity.horario_fim > a.horario_inicio);
      
      if (!sameEquipment || !sameDay || !timeOverlap) return false;

      // If both have date ranges, check for date overlap
      if (newActivity.data_inicio && newActivity.data_fim && a.data_inicio && a.data_fim) {
        return (newActivity.data_inicio <= a.data_fim) && (newActivity.data_fim >= a.data_inicio);
      }
      
      // If one is recurring (no dates) and the other has dates, it's a conflict on that day
      return true;
    });

    if (conflictWithTurma || conflictWithExterna) {
      const conflictName = conflictWithTurma ? `Turma: ${conflictWithTurma.modalidades?.nome}` : `Atividade: ${conflictWithExterna?.titulo}`;
      showNotification('error', 'Conflito de horário', `Já existe uma atividade agendada neste local, dia e horário: ${conflictName}`);
      return;
    }

    try {
      const { error } = await supabase.from('atividades_externas').insert([newActivity]);
      if (error) throw error;
      showNotification('success', 'Atividade criada com sucesso!');
      setShowModal(false);
      setNewActivity({
        titulo: '',
        equipamento_id: '',
        dia_semana: 'Segunda',
        horario_inicio: '08:00',
        horario_fim: '09:00',
        tipo: 'proprio',
        data_inicio: '',
        data_fim: '',
        descricao: ''
      });
      fetchData();
    } catch (error: any) {
      console.error('Erro ao criar atividade:', error);
      showNotification('error', 'Erro ao criar atividade', error.message || 'Houve um problema ao conectar com o banco de dados.');
    }
  };

  const filteredTurmas = selectedEquipamento === 'all' 
    ? turmas 
    : turmas.filter(t => t.equipamentos?.id === selectedEquipamento);

  const filteredAtividades = selectedEquipamento === 'all'
    ? atividadesExternas
    : atividadesExternas.filter(a => a.equipamento_id === selectedEquipamento);

  const getEquipmentUtilization = (equipmentId: string) => {
    const eqTurmas = turmas.filter(t => t.equipamentos?.id === equipmentId);
    const eqAtividades = atividadesExternas.filter(a => a.equipamento_id === equipmentId);
    
    const totalHours = eqTurmas.reduce((acc, t) => {
      const start = parseInt(t.horario_inicio.split(':')[0]);
      const end = parseInt(t.horario_fim.split(':')[0]);
      return acc + (end - start) * (t.dias_semana?.length || 0);
    }, 0) + eqAtividades.reduce((acc, a) => {
      const start = parseInt(a.horario_inicio.split(':')[0]);
      const end = parseInt(a.horario_fim.split(':')[0]);
      return acc + (end - start);
    }, 0);

    // Assume 12h per day (8h to 20h) * 7 days = 84h capacity
    return Math.min(Math.round((totalHours / 84) * 100), 100);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Carregando agendamentos...</div>;
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agendamentos e Utilização</h1>
          <p className="text-sm text-gray-500 mt-1">Ocupação dos equipamentos esportivos por dia e horário</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
            <button
              onClick={() => setViewType('semana')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                viewType === 'semana' 
                  ? 'bg-white text-emerald-600 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Semana
            </button>
            <button
              onClick={() => setViewType('dia')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                viewType === 'dia' 
                  ? 'bg-white text-emerald-600 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Dia
            </button>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center justify-center px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nova Atividade
          </button>

          <div className="flex items-center space-x-2 bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
            <Filter className="w-4 h-4 text-gray-400 ml-2" />
            <select
              value={selectedEquipamento}
              onChange={(e) => setSelectedEquipamento(e.target.value)}
              className="text-sm border-none focus:ring-0 bg-transparent pr-8"
            >
              <option value="all">Todos os Equipamentos</option>
              {equipamentos.map(eq => (
                <option key={eq.id} value={eq.id}>
                  {eq.tipo} - {eq.bairro}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {viewType === 'dia' && (
        <div className="flex overflow-x-auto pb-2 scrollbar-hide space-x-2">
          {diasSemana.map(dia => (
            <button
              key={dia}
              onClick={() => setSelectedDay(dia)}
              className={`px-6 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all border ${
                selectedDay === dia
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-md transform scale-105'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-200'
              }`}
            >
              {dia}
            </button>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Utilization Summary */}
        <div className="p-4 border-b border-gray-100 bg-gray-50/30">
          <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center">
            <Activity className="w-4 h-4 mr-2 text-emerald-600" />
            Resumo de Utilização por Equipamento
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {equipamentos.slice(0, 4).map(eq => {
              const util = getEquipmentUtilization(eq.id);
              return (
                <div key={eq.id} className="p-3 bg-white border border-gray-100 rounded-lg">
                  <div className="flex justify-between text-xs font-medium text-gray-500 mb-2">
                    <span className="truncate">{eq.tipo} - {eq.bairro}</span>
                    <span>{util}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div 
                      className={`h-1.5 rounded-full ${util > 70 ? 'bg-orange-500' : 'bg-emerald-500'}`}
                      style={{ width: `${util}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {viewType === 'semana' ? (
          <div className="overflow-x-auto">
            <div className="min-w-[1000px]">
              <div className="grid grid-cols-7 border-b border-gray-100 bg-gray-50/50">
                {diasSemana.map(dia => (
                  <div key={dia} className="p-4 text-center font-bold text-gray-700 text-sm border-r border-gray-100 last:border-r-0">
                    {dia}
                  </div>
                ))}
              </div>
              
              <div className="grid grid-cols-7 min-h-[500px]">
                {diasSemana.map(dia => {
                  const dayTurmas = filteredTurmas.filter(t => t.dias_semana?.includes(dia));
                  const dayAtividades = filteredAtividades.filter(a => a.dia_semana === dia);
                  const allEvents = [
                    ...dayTurmas.map(t => ({ ...t, eventType: 'turma' })),
                    ...dayAtividades.map(a => ({ ...a, eventType: 'externa' }))
                  ].sort((a, b) => a.horario_inicio.localeCompare(b.horario_inicio));

                  return (
                    <div key={dia} className="p-3 space-y-3 border-r border-gray-100 last:border-r-0 bg-white">
                      {allEvents.map((event, idx) => {
                        const isExterna = event.eventType === 'externa';
                        const colorClass = isExterna 
                          ? (event.tipo === 'terceiros' ? 'border-red-100 bg-red-50/50 text-red-700' : 'border-blue-100 bg-blue-50/50 text-blue-700')
                          : 'border-emerald-100 bg-emerald-50/50 text-emerald-700';
                        const iconColor = isExterna
                          ? (event.tipo === 'terceiros' ? 'text-red-600' : 'text-blue-600')
                          : 'text-emerald-600';

                        return (
                          <div 
                            key={`${event.id}-${dia}-${idx}`}
                            className={`p-3 rounded-lg border ${colorClass} transition-colors group relative`}
                          >
                            <div className={`flex items-center text-[10px] font-bold mb-1 ${iconColor}`}>
                              <Clock className="w-3 h-3 mr-1" />
                              {event.horario_inicio} - {event.horario_fim}
                            </div>
                            <div className="text-sm font-bold text-gray-900 leading-tight mb-1">
                              {isExterna ? event.titulo : event.modalidades?.nome}
                            </div>
                            {isExterna && event.data_inicio && (
                              <div className="text-[9px] text-gray-400 mb-1 flex items-center">
                                <Calendar className="w-2.5 h-2.5 mr-1" />
                                {new Date(event.data_inicio).toLocaleDateString()} {event.data_fim ? `- ${new Date(event.data_fim).toLocaleDateString()}` : ''}
                              </div>
                            )}
                            <div className="text-[10px] text-gray-500 flex items-start">
                              <MapPin className="w-2.5 h-2.5 mr-1 mt-0.5 flex-shrink-0" />
                              <span className="leading-tight">
                                {isExterna ? equipamentos.find(e => e.id === event.equipamento_id)?.tipo : event.equipamentos?.tipo}<br/>
                                <span className="text-gray-400">
                                  {isExterna ? equipamentos.find(e => e.id === event.equipamento_id)?.bairro : event.equipamentos?.bairro}
                                </span>
                              </span>
                            </div>
                            {isExterna && (
                              <div className={`mt-2 text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded inline-block ${event.tipo === 'terceiros' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                                {event.tipo === 'terceiros' ? 'Terceiros' : 'Próprio'}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {allEvents.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-32 text-gray-300">
                          <Calendar className="w-8 h-8 mb-2 opacity-20" />
                          <span className="text-[10px] italic">Livre</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedDay}</h2>
                  <p className="text-sm text-gray-500">Programação detalhada por faixa de horário</p>
                </div>
              </div>
            </div>

            <div className="space-y-12">
              {['Manhã (07:00 - 12:00)', 'Tarde (12:00 - 18:00)', 'Noite (18:00 - 22:00)'].map(periodo => {
                const range = periodo.match(/\((.*?)\)/)?.[1].split(' - ');
                const startLimit = range?.[0] || '00:00';
                const endLimit = range?.[1] || '23:59';

                const dayTurmas = filteredTurmas.filter(t => t.dias_semana?.includes(selectedDay));
                const dayAtividades = filteredAtividades.filter(a => a.dia_semana === selectedDay);
                
                const periodEvents = [
                  ...dayTurmas.map(t => ({ ...t, eventType: 'turma' })),
                  ...dayAtividades.map(a => ({ ...a, eventType: 'externa' }))
                ].filter(event => {
                  const start = event.horario_inicio;
                  return start >= startLimit && start < endLimit;
                }).sort((a, b) => a.horario_inicio.localeCompare(b.horario_inicio));

                return (
                  <div key={periodo} className="relative">
                    <div className="flex items-center mb-4">
                      <div className="h-px flex-1 bg-gray-100"></div>
                      <span className="px-4 text-xs font-bold text-gray-400 uppercase tracking-widest">{periodo}</span>
                      <div className="h-px flex-1 bg-gray-100"></div>
                    </div>

                    {periodEvents.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {periodEvents.map((event, idx) => {
                          const isExterna = event.eventType === 'externa';
                          const colorClass = isExterna 
                            ? (event.tipo === 'terceiros' ? 'border-red-100 bg-red-50/30' : 'border-blue-100 bg-blue-50/30')
                            : 'border-emerald-100 bg-emerald-50/30';
                          
                          return (
                            <div key={`${event.id}-${idx}`} className={`p-4 rounded-xl border-2 ${colorClass} flex items-start space-x-4`}>
                              <div className="flex-shrink-0 w-16 text-center">
                                <div className="text-sm font-black text-gray-900">{event.horario_inicio}</div>
                                <div className="text-[10px] text-gray-400 font-medium">{event.horario_fim}</div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-base font-bold text-gray-900 truncate">
                                  {isExterna ? event.titulo : event.modalidades?.nome}
                                </div>
                                {isExterna && event.data_inicio && (
                                  <div className="text-xs text-gray-400 mt-0.5 flex items-center">
                                    <Calendar className="w-3 h-3 mr-1" />
                                    {new Date(event.data_inicio).toLocaleDateString()} {event.data_fim ? `- ${new Date(event.data_fim).toLocaleDateString()}` : ''}
                                  </div>
                                )}
                                <div className="flex items-center text-xs text-gray-500 mt-1">
                                  <MapPin className="w-3 h-3 mr-1 text-gray-400" />
                                  <span className="truncate">
                                    {isExterna ? equipamentos.find(e => e.id === event.equipamento_id)?.tipo : event.equipamentos?.tipo} - {isExterna ? equipamentos.find(e => e.id === event.equipamento_id)?.bairro : event.equipamentos?.bairro}
                                  </span>
                                </div>
                                {isExterna && (
                                  <span className={`mt-2 inline-block text-[9px] font-bold uppercase px-2 py-0.5 rounded ${event.tipo === 'terceiros' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                    {event.tipo === 'terceiros' ? 'Terceiros' : 'Próprio'}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-8 text-center text-gray-300 italic text-sm">
                        Nenhuma atividade agendada para este período.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Legenda ou Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
          <h3 className="text-sm font-bold text-emerald-800 mb-2 flex items-center">
            <Activity className="w-4 h-4 mr-2" />
            Turmas Regulares
          </h3>
          <p className="text-xs text-emerald-700">
            Atividades fixas da secretaria de esportes.
          </p>
        </div>
        
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
          <h3 className="text-sm font-bold text-blue-800 mb-2 flex items-center">
            <Calendar className="w-4 h-4 mr-2" />
            Eventos Próprios
          </h3>
          <p className="text-xs text-blue-700">
            Eventos pontuais organizados pela prefeitura.
          </p>
        </div>

        <div className="bg-red-50 p-4 rounded-xl border border-red-100">
          <h3 className="text-sm font-bold text-red-800 mb-2 flex items-center">
            <AlertCircle className="w-4 h-4 mr-2" />
            Uso de Terceiros
          </h3>
          <p className="text-xs text-red-700">
            Solicitações externas para uso do espaço.
          </p>
        </div>

        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
          <h3 className="text-sm font-bold text-gray-800 mb-2 flex items-center">
            <MapPin className="w-4 h-4 mr-2" />
            Polos Ativos
          </h3>
          <p className="text-xs text-gray-700">
            {equipamentos.length} equipamentos em {new Set(equipamentos.map(e => e.bairro)).size} bairros.
          </p>
        </div>
      </div>

      {/* Modal Nova Atividade */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Nova Atividade Externa</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleCreateActivity} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título da Atividade</label>
                <input
                  required
                  type="text"
                  value={newActivity.titulo}
                  onChange={e => setNewActivity({...newActivity, titulo: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  placeholder="Ex: Torneio de Vôlei"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Equipamento</label>
                <select
                  required
                  value={newActivity.equipamento_id}
                  onChange={e => setNewActivity({...newActivity, equipamento_id: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                >
                  <option value="">Selecione um equipamento</option>
                  {equipamentos.map(eq => (
                    <option key={eq.id} value={eq.id}>{eq.tipo} - {eq.bairro}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dia da Semana</label>
                  <select
                    value={newActivity.dia_semana}
                    onChange={e => setNewActivity({...newActivity, dia_semana: e.target.value})}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  >
                    {diasSemana.map(dia => (
                      <option key={dia} value={dia}>{dia}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                  <select
                    value={newActivity.tipo}
                    onChange={e => setNewActivity({...newActivity, tipo: e.target.value as 'proprio' | 'terceiros'})}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  >
                    <option value="proprio">Evento Próprio (Azul)</option>
                    <option value="terceiros">Uso de Terceiros (Vermelho)</option>
                  </select>
                </div>
              </div>

              {newActivity.tipo === 'proprio' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data Inicial</label>
                    <input
                      type="date"
                      value={newActivity.data_inicio}
                      onChange={e => setNewActivity({...newActivity, data_inicio: e.target.value})}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data Final</label>
                    <input
                      type="date"
                      value={newActivity.data_fim}
                      onChange={e => setNewActivity({...newActivity, data_fim: e.target.value})}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Início</label>
                  <input
                    type="time"
                    value={newActivity.horario_inicio}
                    onChange={e => setNewActivity({...newActivity, horario_inicio: e.target.value})}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fim</label>
                  <input
                    type="time"
                    value={newActivity.horario_fim}
                    onChange={e => setNewActivity({...newActivity, horario_fim: e.target.value})}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição (Opcional)</label>
                <textarea
                  value={newActivity.descricao}
                  onChange={e => setNewActivity({...newActivity, descricao: e.target.value})}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none h-20 resize-none"
                />
              </div>

              <div className="pt-4 flex space-x-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-bold"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
