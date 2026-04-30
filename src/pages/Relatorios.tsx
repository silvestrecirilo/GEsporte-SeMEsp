import { useState, useRef } from 'react';
import { FileText, Download, Filter, Users, Activity, MapPin, Calendar, Printer, ChevronLeft, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Relatorios() {
  const [activeTab, setActiveTab] = useState('alunos');
  const [selectedTurmaId, setSelectedTurmaId] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const printRef = useRef<HTMLDivElement>(null);

  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  const { data: alunos } = useQuery({
    queryKey: ['alunos-relatorio'],
    queryFn: async () => {
      const { data, error } = await supabase.from('alunos').select('*');
      if (error) throw error;
      return data;
    }
  });

  const { data: turmas } = useQuery({
    queryKey: ['turmas-relatorio'],
    queryFn: async () => {
      const { data, error } = await supabase.from('turmas').select('*, modalidades(nome), equipamentos(bairro)');
      if (error) throw error;
      return data;
    }
  });

  const { data: equipamentos } = useQuery({
    queryKey: ['equipamentos-relatorio'],
    queryFn: async () => {
      const { data, error } = await supabase.from('equipamentos').select('*');
      if (error) throw error;
      return data;
    }
  });

  const { data: matriculas } = useQuery({
    queryKey: ['matriculas-relatorio'],
    queryFn: async () => {
      const { data, error } = await supabase.from('matriculas').select('*, turmas(modalidade_id, modalidades(nome))');
      if (error) throw error;
      return data;
    }
  });

  const { data: attendanceData, isLoading: isLoadingAttendance } = useQuery({
    queryKey: ['attendance-sheet', selectedTurmaId, selectedMonth, selectedYear],
    queryFn: async () => {
      if (!selectedTurmaId) return null;

      const startDate = format(new Date(selectedYear, selectedMonth, 1), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(new Date(selectedYear, selectedMonth, 1)), 'yyyy-MM-dd');

      // Get enrolled students
      const { data: matriculas, error: mError } = await supabase
        .from('matriculas')
        .select('aluno_id, alunos(id, nome, matricula)')
        .eq('turma_id', selectedTurmaId)
        .eq('status', 'ativa');

      if (mError) throw mError;

      // Get attendance records
      const { data: frequencia, error: fError } = await supabase
        .from('frequencia')
        .select('*')
        .eq('turma_id', selectedTurmaId)
        .gte('data_aula', startDate)
        .lte('data_aula', endDate);

      if (fError) throw fError;

      // Get turma details for class days
      const { data: turma, error: tError } = await supabase
        .from('turmas')
        .select('*, modalidades(nome), equipamentos(bairro), funcionarios(nome)')
        .eq('id', selectedTurmaId)
        .single();

      if (tError) throw tError;

      return {
        students: matriculas.map(m => m.alunos).sort((a: any, b: any) => a.nome.localeCompare(b.nome)),
        attendance: frequencia,
        turma: turma
      };
    },
    enabled: activeTab === 'frequencia' && !!selectedTurmaId
  });

  const getAlunosPorBairro = () => {
    if (!alunos) return [];
    const counts: Record<string, number> = {};
    alunos.forEach(a => {
      const bairro = a.bairro || 'Não Informado';
      counts[bairro] = (counts[bairro] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  };

  const getModalidadePopularity = () => {
    if (!matriculas) return [];
    const counts: Record<string, number> = {};
    matriculas.forEach(m => {
      if (m.status === 'ativa') {
        const nome = m.turmas?.modalidades?.nome || 'Desconhecida';
        counts[nome] = (counts[nome] || 0) + 1;
      }
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <style>{`
        @media print {
          body {
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          .print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 0 !important;
            margin: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }
          table {
            border-collapse: collapse !important;
          }
          th, td {
            border: 1px solid #ccc !important;
          }
        }
      `}</style>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <h1 className="text-2xl font-bold text-gray-900">Relatórios e Estatísticas</h1>
        <button className="flex items-center justify-center px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors">
          <Download className="w-5 h-5 mr-2" />
          Exportar PDF
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex border-b overflow-x-auto">
          <button
            onClick={() => setActiveTab('alunos')}
            className={`px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === 'alunos'
                ? 'border-emerald-600 text-emerald-600 bg-emerald-50/50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Users className="w-4 h-4 inline-block mr-2" />
            Alunos por Bairro
          </button>
          <button
            onClick={() => setActiveTab('modalidades')}
            className={`px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === 'modalidades'
                ? 'border-emerald-600 text-emerald-600 bg-emerald-50/50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Activity className="w-4 h-4 inline-block mr-2" />
            Alunos por Modalidade
          </button>
          <button
            onClick={() => setActiveTab('turmas')}
            className={`px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === 'turmas'
                ? 'border-emerald-600 text-emerald-600 bg-emerald-50/50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Calendar className="w-4 h-4 inline-block mr-2" />
            Ocupação de Turmas
          </button>
          <button
            onClick={() => setActiveTab('equipamentos')}
            className={`px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === 'equipamentos'
                ? 'border-emerald-600 text-emerald-600 bg-emerald-50/50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <MapPin className="w-4 h-4 inline-block mr-2" />
            Equipamentos por Bairro
          </button>
          <button
            onClick={() => setActiveTab('frequencia')}
            className={`px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === 'frequencia'
                ? 'border-emerald-600 text-emerald-600 bg-emerald-50/50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <FileText className="w-4 h-4 inline-block mr-2" />
            Ficha de Frequência
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'alunos' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Distribuição de Alunos por Bairro</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {getAlunosPorBairro().map(([bairro, count]) => (
                  <div key={bairro} className="p-4 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">{bairro}</p>
                      <p className="text-2xl font-bold text-gray-900">{count}</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
                      <Users className="h-5 w-5 text-emerald-600" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'modalidades' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Popularidade das Modalidades</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {getModalidadePopularity().map(([nome, count]) => (
                  <div key={nome} className="p-4 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600">{nome}</p>
                      <p className="text-2xl font-bold text-gray-900">{count}</p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <Activity className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'turmas' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Resumo de Turmas e Horários</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-full sm:min-w-[600px]">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b">
                      <th className="px-4 py-3 font-medium">Turma</th>
                      <th className="px-4 py-3 font-medium">Cód</th>
                      <th className="px-4 py-3 font-medium">Modalidade</th>
                      <th className="px-4 py-3 font-medium">Dias</th>
                      <th className="px-4 py-3 font-medium">Horário</th>
                      <th className="px-4 py-3 font-medium text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {turmas?.map((turma) => (
                      <tr key={turma.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{turma.nome || 'N/A'}</td>
                        <td className="px-4 py-3 text-sm text-emerald-600 font-bold">{turma.codigo || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{turma.modalidades?.nome}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{turma.dias_semana?.join(', ')}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{turma.horario_inicio} - {turma.horario_fim}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-1 text-xs font-medium bg-emerald-100 text-emerald-700 rounded-full">
                            Ativa
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'equipamentos' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Inventário de Equipamentos por Localidade</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.entries(
                  (equipamentos || []).reduce((acc, eq) => {
                    const bairro = eq.bairro || 'Não Informado';
                    if (!acc[bairro]) acc[bairro] = [];
                    acc[bairro].push(eq);
                    return acc;
                  }, {} as Record<string, any[]>)
                ).map(([bairro, items]) => (
                  <div key={bairro} className="p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-bold text-gray-900 flex items-center">
                        <MapPin className="w-4 h-4 mr-2 text-emerald-600" />
                        {bairro}
                      </h4>
                      <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {(items as any[]).length} itens
                      </span>
                    </div>
                    <ul className="space-y-2">
                      {(items as any[]).map((item) => (
                        <li key={item.id} className="text-sm text-gray-600 flex items-center justify-between">
                          <span>{item.tipo}</span>
                          <span className="text-xs text-gray-400">{item.status || 'Disponível'}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'frequencia' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row gap-4 no-print">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Turma</label>
                  <select
                    value={selectedTurmaId}
                    onChange={(e) => setSelectedTurmaId(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    <option value="">Selecione uma turma</option>
                    {turmas?.map((t) => (
                      <option key={t.id} value={t.id}>
                        [{t.codigo || 'S/C'}] {t.modalidades?.nome} - {t.equipamentos?.bairro || 'Local não informado'} ({t.horario_inicio})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="w-full md:w-48">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mês</label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    {months.map((m, i) => (
                      <option key={i} value={i}>{m}</option>
                    ))}
                  </select>
                </div>
                <div className="w-full md:w-32">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ano</label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                    className="w-full p-2 border border-gray-300 rounded-md focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    {years.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handlePrint}
                    disabled={!selectedTurmaId || isLoadingAttendance}
                    className="flex items-center justify-center px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-900 transition-colors disabled:opacity-50"
                  >
                    <Printer className="w-5 h-5 mr-2" />
                    Imprimir Ficha
                  </button>
                </div>
              </div>

              {selectedTurmaId && attendanceData ? (
                <div ref={printRef} className="print-container bg-white p-4 sm:p-8 border rounded-xl overflow-x-auto">
                  <div className="text-center mb-6 border-b pb-4">
                    <h2 className="text-xl font-bold uppercase tracking-tight">Ficha de Frequência Mensal</h2>
                    <div className="flex justify-center mt-1">
                      <span className="bg-emerald-600 text-white px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase">
                        Código: {attendanceData.turma.codigo || 'NÃO INFORMADO'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-left text-sm">
                      <div>
                        <span className="font-bold block text-gray-500 uppercase text-[10px]">Modalidade</span>
                        <span className="text-gray-900 font-medium">{attendanceData.turma.modalidades?.nome}</span>
                      </div>
                      <div>
                        <span className="font-bold block text-gray-500 uppercase text-[10px]">Local</span>
                        <span className="text-gray-900 font-medium">{attendanceData.turma.equipamentos?.bairro}</span>
                      </div>
                      <div>
                        <span className="font-bold block text-gray-500 uppercase text-[10px]">Professor</span>
                        <span className="text-gray-900 font-medium">{attendanceData.turma.funcionarios?.nome}</span>
                      </div>
                      <div>
                        <span className="font-bold block text-gray-500 uppercase text-[10px]">Mês/Ano</span>
                        <span className="text-gray-900 font-medium">{months[selectedMonth]} / {selectedYear}</span>
                      </div>
                      <div className="col-span-2 md:col-span-4 mt-2 border-t pt-2">
                        <span className="font-bold block text-gray-500 uppercase text-[10px]">Datas Previstas das Aulas</span>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {eachDayOfInterval({
                            start: startOfMonth(new Date(selectedYear, selectedMonth, 1)),
                            end: endOfMonth(new Date(selectedYear, selectedMonth, 1))
                          }).filter(day => {
                            const diasSemanaMap = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
                            const capitalizedDay = diasSemanaMap[getDay(day)];
                            return attendanceData.turma.dias_semana?.includes(capitalizedDay);
                          }).map(day => (
                            <span key={day.toString()} className="bg-emerald-50 border border-emerald-100 px-2 py-1 rounded text-[11px] text-emerald-700 font-medium">
                              {format(day, 'dd/MM')}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <table className="w-full border-collapse border border-gray-300 text-[10px]">
                    <thead>
                      <tr>
                        <th className="border border-gray-300 p-1 text-left w-64">Nome do Aluno</th>
                        {eachDayOfInterval({
                          start: startOfMonth(new Date(selectedYear, selectedMonth, 1)),
                          end: endOfMonth(new Date(selectedYear, selectedMonth, 1))
                        }).filter(day => {
                          const diasSemanaMap = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
                          const capitalizedDay = diasSemanaMap[getDay(day)];
                          return attendanceData.turma.dias_semana?.includes(capitalizedDay);
                        }).map((day) => {
                          const dayNameShort = format(day, 'EEEEEE', { locale: ptBR });
                          return (
                            <th 
                              key={day.toString()} 
                              className="border border-gray-300 p-0.5 text-center w-10"
                            >
                              <div className="font-bold text-[11px]">{format(day, 'dd/MM')}</div>
                              <div className="text-[8px] uppercase text-gray-500">{dayNameShort}</div>
                            </th>
                          );
                        })}
                        <th className="border border-gray-300 p-1 text-center w-16 bg-gray-50">Total Faltas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceData.students.map((student: any) => {
                        const monthDays = eachDayOfInterval({
                          start: startOfMonth(new Date(selectedYear, selectedMonth, 1)),
                          end: endOfMonth(new Date(selectedYear, selectedMonth, 1))
                        }).filter(day => {
                          const diasSemanaMap = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
                          const capitalizedDay = diasSemanaMap[getDay(day)];
                          return attendanceData.turma.dias_semana?.includes(capitalizedDay);
                        });

                        const totalFaltas = monthDays.reduce((acc, day) => {
                          const dateStr = format(day, 'yyyy-MM-dd');
                          const record = attendanceData.attendance.find((f: any) => f.aluno_id === student.id && f.data_aula === dateStr);
                          return acc + (record?.status === 'falta' ? 1 : 0);
                        }, 0);

                        return (
                          <tr key={student.id}>
                            <td className="border border-gray-300 p-1 font-medium truncate max-w-[150px]">{student.nome}</td>
                            {monthDays.map((day) => {
                              const dateStr = format(day, 'yyyy-MM-dd');
                              const record = attendanceData.attendance.find((f: any) => f.aluno_id === student.id && f.data_aula === dateStr);
                              
                              let content = '';
                              let colorClass = '';
                              
                              if (record) {
                                if (record.status === 'presente') { content = '0'; colorClass = 'text-emerald-600 font-bold'; }
                                else if (record.status === 'falta') { content = '1'; colorClass = 'text-red-600 font-bold'; }
                                else if (record.status === 'falta_justificada') { content = 'J'; colorClass = 'text-yellow-600 font-bold'; }
                                else if (record.status === 'aula_cancelada') { content = 'C'; colorClass = 'text-gray-400'; }
                              }

                              return (
                                <td 
                                  key={day.toString()} 
                                  className={`border border-gray-300 p-0.5 text-center ${colorClass}`}
                                >
                                  {content}
                                </td>
                              );
                            })}
                            <td className="border border-gray-300 p-1 text-center font-bold bg-gray-50">{totalFaltas}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  <div className="mt-8 flex justify-between text-[10px] text-gray-500 italic">
                    <div>Legenda: 0 = Presente | 1 = Falta | J = Justificada | C = Cancelada</div>
                    <div>Gerado em: {new Date().toLocaleString('pt-BR')}</div>
                  </div>
                  
                  <div className="mt-12 flex justify-around no-print">
                    <div className="border-t border-gray-400 w-48 text-center pt-1 text-[10px]">Assinatura do Professor</div>
                    <div className="border-t border-gray-400 w-48 text-center pt-1 text-[10px]">Assinatura da Coordenação</div>
                  </div>
                </div>
              ) : selectedTurmaId ? (
                <div className="flex justify-center items-center h-64 text-gray-500">
                  Carregando dados da ficha...
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-gray-400 bg-gray-50 rounded-xl border-2 border-dashed">
                  <FileText className="w-12 h-12 mb-2 opacity-20" />
                  <p>Selecione uma turma para visualizar a ficha de frequência</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
