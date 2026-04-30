import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, ArrowLeft, Activity } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

const modalidadeSchema = z.object({
  nome: z.string().min(3, 'Nome da modalidade é obrigatório'),
  descricao: z.string().optional(),
});

type ModalidadeFormData = z.infer<typeof modalidadeSchema>;

export default function NovaModalidade() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = Boolean(id);
  
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ModalidadeFormData>({
    resolver: zodResolver(modalidadeSchema),
  });

  const { data: modalidade } = useQuery({
    queryKey: ['modalidade', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase.from('modalidades').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
    enabled: isEditing
  });

  useEffect(() => {
    if (modalidade) {
      reset({
        nome: modalidade.nome,
        descricao: modalidade.descricao || '',
      });
    }
  }, [modalidade, reset]);

  const onSubmit = async (data: ModalidadeFormData) => {
    try {
      if (isEditing) {
        const { error } = await supabase
          .from('modalidades')
          .update({
            nome: data.nome,
            descricao: data.descricao,
          })
          .eq('id', id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase.from('modalidades').insert([{
          nome: data.nome,
          descricao: data.descricao,
        }]);
        
        if (error) throw error;
      }
      
      navigate('/modalidades');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar modalidade.');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate(-1)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditing ? 'Editar Modalidade' : 'Nova Modalidade'}
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900 border-b pb-2 flex items-center">
            <Activity className="w-5 h-5 mr-2 text-emerald-600" />
            Detalhes da Modalidade
          </h2>
          
          <div className="grid grid-cols-1 gap-4 sm:gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Nome da Modalidade</label>
              <input 
                {...register('nome')} 
                placeholder="Ex: Futebol de Campo, Natação, Judô"
                className="w-full px-3 py-2 border rounded-md focus:ring-emerald-500 focus:border-emerald-500" 
              />
              {errors.nome && <p className="text-red-500 text-xs">{errors.nome.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Descrição (Opcional)</label>
              <textarea 
                {...register('descricao')} 
                rows={3}
                placeholder="Breve descrição sobre a modalidade..."
                className="w-full px-3 py-2 border rounded-md focus:ring-emerald-500 focus:border-emerald-500 resize-none" 
              />
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
            {isSubmitting ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Cadastrar Modalidade'}
          </button>
        </div>
      </form>
    </div>
  );
}
