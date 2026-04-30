import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, ArrowLeft, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useState, useEffect } from 'react';

const equipamentoSchema = z.object({
  tipo: z.string().min(3, 'Tipo de equipamento é obrigatório'),
  bairro: z.string().min(2, 'Bairro é obrigatório'),
  endereco: z.string().min(5, 'Endereço é obrigatório'),
  latitude: z.number({ message: 'Latitude deve ser um número' }).optional(),
  longitude: z.number({ message: 'Longitude deve ser um número' }).optional(),
});

type EquipamentoFormData = z.infer<typeof equipamentoSchema>;

export default function NovoEquipamento() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [isLoading, setIsLoading] = useState(false);
  
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EquipamentoFormData>({
    resolver: zodResolver(equipamentoSchema),
  });

  useEffect(() => {
    async function fetchEquipamento() {
      if (!id) return;
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('equipamentos')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        if (data) {
          reset({
            bairro: data.bairro,
            tipo: data.tipo,
            endereco: data.endereco,
            latitude: data.latitude,
            longitude: data.longitude
          });
        }
      } catch (error) {
        console.error('Erro ao buscar equipamento:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchEquipamento();
  }, [id, reset]);

  const onSubmit = async (data: EquipamentoFormData) => {
    try {
      const payload = {
        tipo: data.tipo,
        bairro: data.bairro,
        endereco: data.endereco,
        latitude: data.latitude,
        longitude: data.longitude
      };

      if (id) {
        const { error } = await supabase
          .from('equipamentos')
          .update(payload)
          .eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('equipamentos')
          .insert([payload]);
        if (error) throw error;
      }
      
      navigate('/equipamentos');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar os dados.');
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Carregando dados...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate(-1)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{id ? 'Editar Equipamento' : 'Novo Equipamento Esportivo'}</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900 border-b pb-2 flex items-center">
            <MapPin className="w-5 h-5 mr-2 text-emerald-600" />
            Detalhes do Local
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Bairro</label>
              <input 
                {...register('bairro')} 
                className="w-full px-3 py-2 border rounded-md focus:ring-emerald-500 focus:border-emerald-500" 
              />
              {errors.bairro && <p className="text-red-500 text-xs">{errors.bairro.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Tipo de Equipamento</label>
              <input 
                {...register('tipo')} 
                placeholder="Ex: Quadra Poliesportiva, Campo de Futebol"
                className="w-full px-3 py-2 border rounded-md focus:ring-emerald-500 focus:border-emerald-500" 
              />
              {errors.tipo && <p className="text-red-500 text-xs">{errors.tipo.message}</p>}
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Endereço Completo</label>
              <input 
                {...register('endereco')} 
                className="w-full px-3 py-2 border rounded-md focus:ring-emerald-500 focus:border-emerald-500" 
              />
              {errors.endereco && <p className="text-red-500 text-xs">{errors.endereco.message}</p>}
            </div>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">Georreferenciamento (Opcional)</h2>
          <p className="text-sm text-gray-500 mb-4">
            Insira as coordenadas para gerar automaticamente o link do Google Maps.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Latitude</label>
              <input 
                type="number" 
                step="any"
                {...register('latitude', { valueAsNumber: true })} 
                placeholder="Ex: -23.5505"
                className="w-full px-3 py-2 border rounded-md focus:ring-emerald-500 focus:border-emerald-500" 
              />
              {errors.latitude && <p className="text-red-500 text-xs">{errors.latitude.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Longitude</label>
              <input 
                type="number" 
                step="any"
                {...register('longitude', { valueAsNumber: true })} 
                placeholder="Ex: -46.6333"
                className="w-full px-3 py-2 border rounded-md focus:ring-emerald-500 focus:border-emerald-500" 
              />
              {errors.longitude && <p className="text-red-500 text-xs">{errors.longitude.message}</p>}
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
            {isSubmitting ? 'Salvando...' : 'Cadastrar Equipamento'}
          </button>
        </div>
      </form>
    </div>
  );
}
