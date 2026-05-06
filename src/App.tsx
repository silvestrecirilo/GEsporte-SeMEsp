/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Alunos from './pages/Alunos';
import NovoAluno from './pages/NovoAluno';
import MatriculaAluno from './pages/MatriculaAluno';
import Turmas from './pages/Turmas';
import NovaTurma from './pages/NovaTurma';
import Frequencia from './pages/Frequencia';
import Equipamentos from './pages/Equipamentos';
import NovoEquipamento from './pages/NovoEquipamento';
import Modalidades from './pages/Modalidades';
import NovaModalidade from './pages/NovaModalidade';
import Funcionarios from './pages/Funcionarios';
import NovoFuncionario from './pages/NovoFuncionario';
import Relatorios from './pages/Relatorios';
import Agendamentos from './pages/Agendamentos';
import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import { Session } from '@supabase/supabase-js';
import { NotificationProvider } from './components/Notification';

const queryClient = new QueryClient();

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(localStorage.getItem('demo_auth') === 'true');
  const [showConfigWarning, setShowConfigWarning] = useState(false);

  useEffect(() => {
    const isPlaceholder = !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL.includes('placeholder');
    setShowConfigWarning(isPlaceholder);

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  const isAuthenticated = session || isDemo;

  const handleDemoLogin = () => {
    localStorage.setItem('demo_auth', 'true');
    setIsDemo(true);
  };

  const handleDemoLogout = () => {
    localStorage.removeItem('demo_auth');
    setIsDemo(false);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <NotificationProvider>
        <Router>
        {showConfigWarning && (
          <div className="fixed top-0 left-0 right-0 bg-amber-500 text-white text-center py-1 text-xs z-[9999] shadow-sm font-medium">
            Project not fully configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your secrets.
          </div>
        )}
        <Routes>
          <Route path="/login" element={!isAuthenticated ? <Login onDemoLogin={handleDemoLogin} /> : <Navigate to="/" />} />
          
          <Route element={isAuthenticated ? <Layout onDemoLogout={handleDemoLogout} /> : <Navigate to="/login" />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/alunos" element={<Alunos />} />
            <Route path="/alunos/novo" element={<NovoAluno />} />
            <Route path="/alunos/:id/editar" element={<NovoAluno />} />
            <Route path="/alunos/:id/matricula" element={<MatriculaAluno />} />
            
            <Route path="/turmas" element={<Turmas />} />
            <Route path="/turmas/nova" element={<NovaTurma />} />
            <Route path="/turmas/:id/editar" element={<NovaTurma />} />
            <Route path="/turmas/:id/frequencia" element={<Frequencia />} />
            
            <Route path="/equipamentos" element={<Equipamentos />} />
            <Route path="/equipamentos/novo" element={<NovoEquipamento />} />
            <Route path="/equipamentos/:id/editar" element={<NovoEquipamento />} />
            
            <Route path="/modalidades" element={<Modalidades />} />
            <Route path="/modalidades/nova" element={<NovaModalidade />} />
            <Route path="/modalidades/:id/editar" element={<NovaModalidade />} />

            <Route path="/funcionarios" element={<Funcionarios />} />
            <Route path="/funcionarios/novo" element={<NovoFuncionario />} />
            <Route path="/funcionarios/:id/editar" element={<NovoFuncionario />} />

            <Route path="/relatorios" element={<Relatorios />} />
            <Route path="/agendamentos" element={<Agendamentos />} />
          </Route>
        </Routes>
      </Router>
    </NotificationProvider>
  </QueryClientProvider>
);
}
