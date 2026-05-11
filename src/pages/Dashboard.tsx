import { useEffect, useState } from 'react';
import { Users, Activity, MapPin, Calendar, TrendingUp } from 'lucide-react';
import { useNotification } from '../components/Notification';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import { supabase } from '../lib/supabase';

export default function Dashboard() {
  const { showNotification } = useNotification();
  const [stats, setStats] = useState({
    totalAlunos: 0,
    turmasAtivas: 0,
    totalModalidades: 0,
    totalEquipamentos: 0,
    totalAtendimentos: 0,
    volumeAtendimentos: 0,
  });
  const [alunosPorModalidade, setAlunosPorModalidade] = useState<{name: string, alunos: number}[]>([]);
  const [alunosPorBairro, setAlunosPorBairro] = useState<{name: string, alunos: number}[]>([]);
  const [frequenciaMensal, setFrequenciaMensal] = useState<{name: string, frequencia: number}[]>([]);
  const [turmasSchedule, setTurmasSchedule] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const today = new Date();
        const fourWeeksAgo = new Date();
        fourWeeksAgo.setDate(today.getDate() - 28);

        const isDemo = localStorage.getItem('demo_auth') === 'true';
        let userProfile: any = null;

        if (isDemo) {
          userProfile = { id: 'demo-admin', nome: 'Administrador Demo', cargo: 'Admin', permissoes: ['dashboard', 'alunos', 'turmas', 'frequencia', 'equipamentos', 'funcionarios', 'modalidades', 'relatorios', 'agendamentos'], isAdmin: true };
        } else {
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.email) {
            const { data: funcionario } = await supabase
              .from('funcionarios')
              .select('id, nome, cargo, permissoes')
              .eq('email', user.email)
              .single();
            
            if (funcionario) {
              userProfile = { ...funcionario, isAdmin: false };
            } else {
              userProfile = { 
                id: user.id, 
                nome: user.user_metadata?.full_name || user.email.split('@')[0], 
                cargo: 'Gestor Autenticado', 
                permissoes: ['dashboard', 'alunos', 'turmas', 'frequencia', 'equipamentos', 'modalidades', 'relatorios', 'agendamentos', 'funcionarios'],
                isAdmin: true 
              };
            }
          }
        }

        const canManageTurmas = userProfile?.permissoes?.includes('turmas') || userProfile?.isAdmin;
        const hasFrequenciaOnly = userProfile?.permissoes?.includes('frequencia') && !canManageTurmas;

        // Fetch counts
        const fetchTurmasRobust = async () => {
          let res = await supabase.from('turmas').select(`
            id,
            codigo,
            dias_semana,
            horario_inicio,
            horario_fim,
            hora_inicio,
            hora_fim,
            modalidades (nome),
            equipamentos (bairro, tipo),
            professor_id,
            professor:funcionarios!professor_id (nome),
            turmas_auxiliares (funcionario_id),
            status
          `);
          
          if (res.error) {
            console.warn('Detailed turmas fetch failed, trying simple fetch:', res.error);
            res = await supabase.from('turmas').select(`
              id,
              codigo,
              dias_semana,
              horario_inicio,
              horario_fim,
              hora_inicio,
              hora_fim,
              modalidades (nome),
              equipamentos (bairro, tipo),
              status,
              professor_id,
              turmas_auxiliares (funcionario_id)
            `);
          }
          return res;
        };

        const fetchTurmasWithMatriculas = async () => {
          let res = await supabase.from('turmas').select(`
            id,
            dias_semana,
            horario_inicio,
            horario_fim,
            hora_inicio,
            hora_fim,
            modalidades (nome),
            matriculas (count),
            professor_id,
            turmas_auxiliares (funcionario_id),
            status
          `);

          if (res.error) {
            res = await supabase.from('turmas').select(`
              id,
              dias_semana,
              horario_inicio,
              horario_fim,
              hora_inicio,
              hora_fim,
              modalidades (nome),
              status,
              professor_id,
              turmas_auxiliares (funcionario_id)
            `);
          }
          return res;
        };

        const fetchAtividadesExternas = async () => {
          try {
            const { data, error } = await supabase.from('atividades_externas').select(`
              id,
              titulo,
              equipamento_id,
              equipamentos (bairro, tipo),
              dia_semana,
              horario_inicio,
              horario_fim,
              tipo
            `);
            if (error) {
              console.warn('atividades_externas table may be missing:', error);
              return { data: [] };
            }
            return { data };
          } catch (e) {
            console.error('Error fetching activities:', e);
            return { data: [] };
          }
        };

        const [
          { count: alunosCount },
          turmasCountRes,
          { count: modalidadesCount },
          { count: equipamentosCount },
          { count: matriculasCount },
          turmasDataRes,
          { data: frequenciaData },
          { data: alunosData },
          scheduleDataRes,
          { data: atividadesExternasData }
        ] = await Promise.all([
          supabase.from('alunos').select('*', { count: 'exact', head: true }),
          supabase.from('turmas').select('*', { count: 'exact', head: true }),
          supabase.from('modalidades').select('*', { count: 'exact', head: true }),
          supabase.from('equipamentos').select('*', { count: 'exact', head: true }),
          supabase.from('matriculas').select('*', { count: 'exact', head: true }).eq('status', 'ativa'),
          fetchTurmasWithMatriculas(),
          supabase.from('frequencia')
            .select('data_aula, status_aula')
            .gte('data_aula', fourWeeksAgo.toISOString().split('T')[0])
            .lte('data_aula', today.toISOString().split('T')[0]),
          supabase.from('alunos').select('bairro'),
          fetchTurmasRobust(),
          fetchAtividadesExternas().then(res => ({ data: res.data }))
        ]);

        const turmasCount = turmasCountRes.count || 0;
        const turmasDataRaw = turmasDataRes.data;
        const scheduleDataRaw = scheduleDataRes.data;
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

        // senior expert normalization
        const normalizeTurmas = (data: any[] | null) => {
          return (data || []).map((t: any) => {
            // Handle equipamentos join which might be an array or object
            const eq = t.equipamentos;
            const normalizedEquipamento = Array.isArray(eq) ? eq[0] : eq;

            // Handle professor/professores join
            const prof = t.professor || t.professores;
            const normalizedProfessor = Array.isArray(prof) ? prof[0] : prof;

            // Handle modalidades join
            const mod = t.modalidades;
            const normalizedModalidade = Array.isArray(mod) ? mod[0] : mod;

            // Normalize dias_semana
            let dias = t.dias_semana;
            if (typeof dias === 'string') {
              // Robust handle for various postgres/json return formats
              dias = dias.replace(/{|}|\[|\]|"/g, '').split(/[ ,;/]+/).filter(Boolean).map((s: string) => s.trim());
            }
            if (Array.isArray(dias)) {
              dias = dias.map(normalizeDay).filter(Boolean);
            } else {
              dias = [];
            }

            return {
              ...t,
              horario_inicio: t.horario_inicio || (t as any).hora_inicio || '00:00',
              horario_fim: t.horario_fim || (t as any).hora_fim || '00:00',
              equipamentos: normalizedEquipamento,
              professor: normalizedProfessor,
              modalidades: normalizedModalidade,
              dias_semana: dias
            };
          });
        };

        const checkStatus = (status: string) => {
          const s = (status || '').toLowerCase();
          if (!s) return true; // Default to shown if no status
          
          const inactiveKeywords = ['inativa', 'fechada', 'encerrada', 'cancelada', 'suspensa'];
          const isExplicitlyInactive = inactiveKeywords.some(keyword => s.includes(keyword));
          
          const activeKeywords = ['ativa', 'funcionamento', 'aberta', 'andamento', 'progresso', 'ok', 'vigente'];
          const isExplicitlyActive = activeKeywords.some(keyword => s.includes(keyword));
          
          return isExplicitlyActive || (!isExplicitlyInactive);
        };

        const turmasData = normalizeTurmas(turmasDataRaw).filter((t: any) => checkStatus(t.status));
        const scheduleData = normalizeTurmas(scheduleDataRaw).filter((t: any) => checkStatus(t.status));

        // Normalize Atividades Externas
        const normalizedAtividades = (atividadesExternasData || []).map((a: any) => {
          const eq = a.equipamentos;
          const normalizedEquipamento = Array.isArray(eq) ? eq[0] : eq;

          return {
            ...a,
            eventType: 'externa',
            dias_semana: [normalizeDay(a.dia_semana)], // Normalize day for compatibility with filter
            horario_inicio: a.horario_inicio || '00:00',
            horario_fim: a.horario_fim || '00:00',
            equipamentos: normalizedEquipamento
          };
        });

        // Filter data based on permissions
        let filteredTurmasData = turmasData || [];
        let filteredScheduleData = scheduleData || [];
        let filteredAtividades = normalizedAtividades;

        if (hasFrequenciaOnly && userProfile?.id) {
          filteredTurmasData = filteredTurmasData.filter((t: any) => 
            t.professor_id === userProfile.id || 
            t.turmas_auxiliares?.some((a: any) => a.funcionario_id === userProfile.id)
          );
          filteredScheduleData = filteredScheduleData.filter((t: any) => 
            t.professor_id === userProfile.id || 
            t.turmas_auxiliares?.some((a: any) => a.funcionario_id === userProfile.id)
          );
          filteredAtividades = [];
        }

        // Calculate Volume de Atendimentos
        const avgFrequency = frequenciaData && frequenciaData.length > 0 
          ? frequenciaData.filter((r: any) => r.status_aula === 'presente' || r.status_aula === 'falta_justificada').length / frequenciaData.length
          : 0.8; // default 80% if no data

        let totalVolume = 0;
        filteredTurmasData.forEach((turma: any) => {
          const students = turma.matriculas?.[0]?.count || 0;
          const classesPerWeek = turma.dias_semana?.length || 0;
          const classesPerMonth = classesPerWeek * 4;
          totalVolume += students * classesPerMonth * avgFrequency;
        });

        setStats({
          totalAlunos: hasFrequenciaOnly ? filteredTurmasData.reduce((acc, t) => acc + (t.matriculas?.[0]?.count || 0), 0) : (alunosCount || 0),
          turmasAtivas: hasFrequenciaOnly ? filteredTurmasData.length : (turmasCount || 0),
          totalModalidades: hasFrequenciaOnly ? new Set(filteredTurmasData.map(t => t.modalidades?.nome).filter(Boolean)).size : (modalidadesCount || 0),
          totalEquipamentos: equipamentosCount || 0,
          totalAtendimentos: hasFrequenciaOnly ? filteredTurmasData.reduce((acc, t) => acc + (t.matriculas?.[0]?.count || 0), 0) : (matriculasCount || 0),
          volumeAtendimentos: Math.round(totalVolume),
        });

        // Merge turmas and external activities
        const combinedSchedule = [
          ...filteredScheduleData.map(t => ({ ...t, eventType: 'turma' })),
          ...filteredAtividades
        ];

        setTurmasSchedule(combinedSchedule);

        // Atendimentos por Bairro
        if (alunosData) {
          const bairroCounts: Record<string, number> = {};
          alunosData.forEach(a => {
            if (a.bairro) {
              bairroCounts[a.bairro] = (bairroCounts[a.bairro] || 0) + 1;
            }
          });
          const bairroChartData = Object.entries(bairroCounts)
            .map(([name, alunos]) => ({ name, alunos }))
            .sort((a, b) => b.alunos - a.alunos)
            .slice(0, 8);
          setAlunosPorBairro(bairroChartData);
        }

        // Calculate students per modality
        if (turmasData) {
          const modalityCounts: Record<string, number> = {};
          
          turmasData.forEach((turma: any) => {
            const modName = turma.modalidades?.nome || 'Desconhecida';
            const matriculasCount = turma.matriculas?.[0]?.count || 0;
            
            if (!modalityCounts[modName]) {
              modalityCounts[modName] = 0;
            }
            modalityCounts[modName] += matriculasCount;
          });

          const chartData = Object.entries(modalityCounts)
            .map(([name, alunos]) => ({ name, alunos }))
            .sort((a, b) => b.alunos - a.alunos)
            .slice(0, 6); // Top 6

          setAlunosPorModalidade(chartData.length > 0 ? chartData : [
            { name: 'Sem dados', alunos: 0 }
          ]);
        }

        // Calculate attendance per week
        if (frequenciaData && frequenciaData.length > 0) {
          const weeks = [
            { name: 'Sem 1', total: 0, presentes: 0, start: new Date(today.getTime() - 28 * 24 * 60 * 60 * 1000), end: new Date(today.getTime() - 21 * 24 * 60 * 60 * 1000) },
            { name: 'Sem 2', total: 0, presentes: 0, start: new Date(today.getTime() - 21 * 24 * 60 * 60 * 1000), end: new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000) },
            { name: 'Sem 3', total: 0, presentes: 0, start: new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000), end: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000) },
            { name: 'Sem 4', total: 0, presentes: 0, start: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000), end: today },
          ];

          frequenciaData.forEach(record => {
            if (record.status_aula === 'aula_cancelada') return;
            
            const recordDate = new Date(record.data_aula);
            const week = weeks.find(w => recordDate >= w.start && recordDate <= w.end);
            
            if (week) {
              week.total++;
              if (record.status_aula === 'presente' || record.status_aula === 'falta_justificada') {
                week.presentes++;
              }
            }
          });

          const freqChartData = weeks.map(w => ({
            name: w.name,
            frequencia: w.total > 0 ? Math.round((w.presentes / w.total) * 100) : 0
          }));

          setFrequenciaMensal(freqChartData);
        } else {
          setFrequenciaMensal([
            { name: 'Sem 1', frequencia: 0 },
            { name: 'Sem 2', frequencia: 0 },
            { name: 'Sem 3', frequencia: 0 },
            { name: 'Sem 4', frequencia: 0 },
          ]);
        }

      } catch (error: any) {
        console.error('Erro ao buscar dados do dashboard:', error);
        showNotification('error', 'Erro ao carregar dashboard', 'Houve um problema ao buscar as estatísticas.');
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64">Carregando dashboard...</div>;
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-900">Visão Geral</h1>
        <div className="text-sm text-gray-500">
          Atualizado hoje às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center text-center space-y-4">
          <div className="p-4 bg-emerald-100 text-emerald-600 rounded-2xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Total Alunos</p>
            <h3 className="text-2xl font-black text-gray-900 leading-none">{stats.totalAlunos}</h3>
            <p className="text-[10px] text-emerald-600 flex items-center justify-center mt-2 font-medium">
              <TrendingUp className="w-3 h-3 mr-1" /> Atualizado
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center text-center space-y-4">
          <div className="p-4 bg-blue-100 text-blue-600 rounded-2xl">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Turmas Ativas</p>
            <h3 className="text-2xl font-black text-gray-900 leading-none">{stats.turmasAtivas}</h3>
            <p className="text-[10px] text-gray-500 mt-2 font-medium">Em andamento</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center text-center space-y-4">
          <div className="p-4 bg-purple-100 text-purple-600 rounded-2xl">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Modalidades</p>
            <h3 className="text-2xl font-black text-gray-900 leading-none">{stats.totalModalidades}</h3>
            <p className="text-[10px] text-gray-500 mt-2 font-medium">Esportivas</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center text-center space-y-4">
          <div className="p-4 bg-orange-100 text-orange-600 rounded-2xl">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Equipamentos</p>
            <h3 className="text-2xl font-black text-gray-900 leading-none">{stats.totalEquipamentos}</h3>
            <p className="text-[10px] text-gray-500 mt-2 font-medium">Polos esportivos</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center text-center space-y-4">
          <div className="p-4 bg-indigo-100 text-indigo-600 rounded-2xl">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Atendimentos</p>
            <h3 className="text-2xl font-black text-gray-900 leading-none">{stats.totalAtendimentos}</h3>
            <p className="text-[10px] text-gray-500 mt-2 font-medium">Matrículas ativas</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center text-center space-y-4">
          <div className="p-4 bg-emerald-100 text-emerald-600 rounded-2xl">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Volume Mensal</p>
            <h3 className="text-2xl font-black text-gray-900 leading-none">{stats.volumeAtendimentos}</h3>
            <p className="text-[10px] text-gray-500 mt-2 font-medium">Projeção mensal</p>
          </div>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Barras */}
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Alunos por Modalidade (Top 6)</h2>
          <div className="h-64 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={alunosPorModalidade} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                <Tooltip 
                  cursor={{ fill: '#f9fafb' }}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="alunos" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico de Linha */}
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Média de Frequência (%) - Último Mês</h2>
          <div className="h-64 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={frequenciaMensal} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="frequencia" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Novo Gráfico: Atendimentos por Bairro */}
      <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Atendimentos por Bairro (Top 8)</h2>
        <div className="h-64 sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={alunosPorBairro} layout="vertical" margin={{ top: 10, right: 30, left: 40, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
              <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
              <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} width={100} />
              <Tooltip 
                cursor={{ fill: '#f9fafb' }}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Bar dataKey="alunos" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quadro de Horários / Agendamentos */}
      <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Quadro de Horários e Utilização</h2>
          <span className="px-3 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
            Turmas Ativas
          </span>
        </div>

        <div className="overflow-x-auto -mx-4 sm:mx-0">
          <div className="min-w-[800px] p-4 sm:p-0">
            <div className="grid grid-cols-7 gap-4">
              {['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'].map((dia) => (
                <div key={dia} className="space-y-4">
                  <div className="text-center font-bold text-gray-700 text-sm border-b pb-2 mb-4">
                    {dia}
                  </div>
                  <div className="space-y-3">
                    {turmasSchedule
                      .filter(t => t.dias_semana?.includes(dia))
                      .sort((a, b) => (a.horario_inicio || '').localeCompare(b.horario_inicio || ''))
                      .map((turma) => {
                        const isExterna = turma.eventType === 'externa';
                        const colorClass = isExterna 
                          ? (turma.tipo === 'terceiros' ? 'border-red-100 bg-red-50 hover:border-red-200 hover:bg-red-100/50' : 'border-blue-100 bg-blue-50 hover:border-blue-200 hover:bg-blue-100/50')
                          : 'bg-gray-50 border-gray-100 hover:border-emerald-200 hover:bg-emerald-50';
                        const timeColor = isExterna
                          ? (turma.tipo === 'terceiros' ? 'text-red-700' : 'text-blue-700')
                          : 'text-emerald-700';

                        return (
                          <div 
                            key={`${turma.id}-${dia}`}
                            className={`p-3 rounded-lg border transition-all group ${colorClass}`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className={`text-xs font-bold ${timeColor}`}>
                                {turma.horario_inicio?.substring(0, 5)} - {turma.horario_fim?.substring(0, 5)}
                              </span>
                              {!isExterna ? (
                                <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 rounded font-mono">
                                  {turma.codigo}
                                </span>
                              ) : (
                                <span className={`text-[9px] px-1 rounded font-mono ${turma.tipo === 'terceiros' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
                                  {turma.tipo === 'terceiros' ? 'EXT' : 'PRP'}
                                </span>
                              )}
                            </div>
                            <div className="text-sm font-semibold text-gray-900 truncate">
                              {isExterna ? turma.titulo : turma.modalidades?.nome}
                            </div>
                            <div className="text-[10px] text-gray-500 flex items-center mt-1">
                              <MapPin className="w-2 h-2 mr-1" />
                              <span className="truncate">{turma.equipamentos?.tipo} - {turma.equipamentos?.bairro}</span>
                            </div>
                             {!isExterna && turma.professor?.nome && (
                               <div className="text-[10px] text-emerald-600 font-medium mt-1">
                                 {turma.professor.nome}
                               </div>
                             )}
                          </div>
                        );
                      })}
                    {turmasSchedule.filter(t => t.dias_semana?.includes(dia)).length === 0 && (
                      <div className="text-[10px] text-gray-400 text-center italic py-4">
                        Sem atividades
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
