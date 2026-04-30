import { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { LogOut, Users, MapPin, Activity, Calendar, LayoutDashboard, BookOpen, Menu, X, Clock, Bot } from 'lucide-react';
import AIAssistant from './AIAssistant';

export default function Layout({ onDemoLogout }: { onDemoLogout?: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    if (onDemoLogout) {
      onDemoLogout();
    }
    await supabase.auth.signOut();
    navigate('/login');
  };

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/alunos', icon: Users, label: 'Alunos' },
    { path: '/turmas', icon: Calendar, label: 'Turmas' },
    { path: '/equipamentos', icon: MapPin, label: 'Equipamentos' },
    { path: '/modalidades', icon: Activity, label: 'Modalidades' },
    { path: '/funcionarios', icon: Users, label: 'Funcionários' },
    { path: '/relatorios', icon: BookOpen, label: 'Relatórios' },
    { path: '/agendamentos', icon: Clock, label: 'Agendamentos' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Mobile Header */}
      <div className="md:hidden bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4 sticky top-0 z-20">
        <h1 className="text-xl font-bold text-emerald-600">GEsporte SeMEsp</h1>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-gray-600 hover:bg-gray-100 rounded-md"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-10"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-20
        w-64 bg-white border-r border-gray-200 flex flex-col
        transform transition-transform duration-200 ease-in-out
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="h-16 hidden md:flex items-center px-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-emerald-600">GEsporte SeMEsp</h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path || 
                            (item.path !== '/' && location.pathname.startsWith(item.path));
            
            return (
              <Link 
                key={item.path}
                to={item.path} 
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center px-3 py-2 rounded-md transition-colors ${
                  isActive 
                    ? 'bg-emerald-50 text-emerald-600 font-medium' 
                    : 'text-gray-700 hover:bg-gray-50 hover:text-emerald-600'
                }`}
              >
                <Icon className={`w-5 h-5 mr-3 ${isActive ? 'text-emerald-600' : 'text-gray-400'}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        
        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="flex items-center w-full px-3 py-2 text-gray-700 rounded-md hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-5 h-5 mr-3 text-gray-400" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 w-full overflow-hidden relative">
        <div className="p-4 md:p-8 max-w-7xl mx-auto w-full overflow-x-hidden">
          <Outlet />
        </div>
        <AIAssistant />
      </main>
    </div>
  );
}
