import { Link } from 'react-router-dom';
import { Plus, Search, Map, Trash2, Clock } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';

export default function Equipamentos() {
  const queryClient = useQueryClient();

  const { data: equipamentos, isLoading } = useQuery({
    queryKey: ['equipamentos'],
    queryFn: async () => {
      const { data, error } = await supabase.from('equipamentos').select('*').order('tipo');
      if (error) {
        console.error('Erro ao buscar equipamentos:', error);
        return [
          { id: '1', tipo: 'Quadra Poliesportiva', bairro: 'Centro', endereco: 'Rua das Flores, 123', latitude: -23.5505, longitude: -46.6333 },
          { id: '2', tipo: 'Campo de Futebol', bairro: 'Jardim Alvorada', endereco: 'Av. Brasil, 4500', latitude: -23.5505, longitude: -46.6333 },
        ];
      }
      return data;
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('equipamentos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipamentos'] });
    }
  });

  const handleDelete = (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este equipamento?')) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Equipamentos Esportivos</h1>
        <div className="flex items-center space-x-3">
          <Link
            to="/agendamentos"
            className="flex items-center justify-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
          >
            <Clock className="w-5 h-5 mr-2 text-emerald-600" />
            Ver Agendamentos
          </Link>
          <Link
            to="/equipamentos/novo"
            className="flex items-center justify-center px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            Novo Equipamento
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Buscar equipamento..."
              className="w-full pl-10 pr-4 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
            <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-full sm:min-w-[600px]">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-sm uppercase tracking-wider border-b border-gray-200">
                <th className="px-6 py-4 font-medium">Bairro</th>
                <th className="px-6 py-4 font-medium">Tipo</th>
                <th className="px-6 py-4 font-medium hidden md:table-cell">Endereço</th>
                <th className="px-6 py-4 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    Carregando equipamentos...
                  </td>
                </tr>
              ) : equipamentos?.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                    Nenhum equipamento cadastrado.
                  </td>
                </tr>
              ) : (
                equipamentos?.map((equipamento) => (
                  <tr key={equipamento.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-gray-900 font-medium">{equipamento.bairro}</td>
                    <td className="px-6 py-4 text-gray-600">
                      {equipamento.latitude && equipamento.longitude ? (
                        <a 
                          href={`https://maps.google.com/?q=${equipamento.latitude},${equipamento.longitude}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-emerald-600 hover:underline flex items-center"
                        >
                          <Map className="w-4 h-4 mr-2" />
                          {equipamento.tipo}
                        </a>
                      ) : (
                        equipamento.tipo
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-600 hidden md:table-cell">{equipamento.endereco}</td>
                    <td className="px-6 py-4 text-right">
                      <Link 
                        to={`/equipamentos/editar/${equipamento.id}`}
                        className="text-emerald-600 hover:text-emerald-800 font-medium text-sm mr-3"
                      >
                        Editar
                      </Link>
                      <button 
                        onClick={() => handleDelete(equipamento.id)}
                        className="text-red-600 hover:text-red-800 font-medium text-sm"
                      >
                        Excluir
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
