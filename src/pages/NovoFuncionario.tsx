import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, ArrowLeft, User, Briefcase, Phone, Mail, MapPin } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useNotification } from '../components/Notification';

const funcionarioSchema = z.object({
  nome: z.string().min(3, 'Nome é obrigatório'),
  cargo: z.string().min(1, 'Cargo é obrigatório'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  telefone: z.string().optional().or(z.literal('')),
  permissoes: z.array(z.string()),
});

const PERMISSOES_DISPONIVEIS = [
  { id: 'dashboard', label: 'Visualizar Dashboard' },
  { id: 'alunos', label: 'Gerenciar Alunos' },
  { id: 'turmas', label: 'Gerenciar Turmas' },
  { id: 'frequencia', label: 'Lançar Frequência' },
  { id: 'equipamentos', label: 'Gerenciar Equipamentos' },
  { id: 'funcionarios', label: 'Gerenciar Funcionários' },
  { id: 'modalidades', label: 'Gerenciar Modalidades' },
  { id: 'relatorios', label: 'Visualizar Relatórios' },
];

type FuncionarioFormData = z.infer<typeof funcionarioSchema>;

export default function NovoFuncionario() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { showNotification } = useNotification();
  const queryClient = useQueryClient();
  const isEditing = Boolean(id);
  
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FuncionarioFormData>({
    resolver: zodResolver(funcionarioSchema),
    defaultValues: {
      permissoes: [],
    }
  });

  const { data: funcionario } = useQuery({
    queryKey: ['funcionario', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase.from('funcionarios').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
    enabled: isEditing
  });

  useEffect(() => {
    if (funcionario) {
      reset({
        nome: funcionario.nome,
        cargo: funcionario.cargo || '',
        email: funcionario.email || '',
        telefone: funcionario.telefone || '',
        permissoes: funcionario.permissoes || [],
      });
    }
  }, [funcionario, reset]);

  const onSubmit = async (data: FuncionarioFormData) => {
    try {
      const payload = {
        nome: data.nome,
        cargo: data.cargo,
        email: data.email || null,
        telefone: data.telefone || null,
        permissoes: data.permissoes,
        role: data.cargo.toLowerCase().includes('prof') ? 'professor' : 'funcionario'
      };

      if (isEditing) {
        const { error } = await supabase
          .from('funcionarios')
          .update(payload)
          .eq('id', id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase.from('funcionarios').insert([payload]);
        if (error) throw error;
      }
      
      // Invalidate queries to update UI
      queryClient.invalidateQueries({ queryKey: ['funcionarios'] });
      queryClient.invalidateQueries({ queryKey: ['professores-select'] });
      
      showNotification('success', isEditing ? 'Funcionário atualizado com sucesso!' : 'Funcionário cadastrado com sucesso!');
      navigate('/funcionarios');
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      let errorMessage = error.message || 'Houve um problema ao conectar com o banco de dados.';
      
      if (error.code === '23505') {
        if (error.message.includes('email')) {
          errorMessage = 'Este e-mail já está cadastrado para outro funcionário.';
        } else {
          errorMessage = 'Já existe um registro com estes dados únicos no sistema.';
        }
      }

      showNotification('error', 'Erro ao salvar funcionário', errorMessage);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate(-1)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEditing ? 'Editar Funcionário' : 'Novo Funcionário'}
          </h1>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900 border-b pb-2 flex items-center">
            <User className="w-5 h-5 mr-2 text-emerald-600" />
            Informações Pessoais e Profissionais
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Nome Completo</label>
              <div className="relative">
                <input 
                  {...register('nome')} 
                  placeholder="Nome completo do funcionário"
                  className="w-full pl-10 pr-3 py-2 border rounded-md focus:ring-emerald-500 focus:border-emerald-500" 
                />
                <User className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
              </div>
              {errors.nome && <p className="text-red-500 text-xs">{errors.nome.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Cargo / Função</label>
              <div className="relative">
                <select 
                  {...register('cargo')} 
                  className="w-full pl-10 pr-3 py-2 border rounded-md focus:ring-emerald-500 focus:border-emerald-500 bg-white appearance-none"
                >
                  <option value="">Selecione um cargo</option>
                  <option value="Professor">Professor</option>
                  <option value="Professor Substituto">Professor Substituto</option>
                  <option value="Equipe Técnica">Equipe Técnica</option>
                  <option value="Administrativo">Administrativo</option>
                  <option value="Coordenador">Coordenador</option>
                </select>
                <Briefcase className="w-5 h-5 text-gray-400 absolute left-3 top-2.5 pointer-events-none" />
              </div>
              {errors.cargo && <p className="text-red-500 text-xs">{errors.cargo.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Telefone (Opcional)</label>
              <div className="relative">
                <input 
                  {...register('telefone')} 
                  placeholder="(00) 00000-0000"
                  className="w-full pl-10 pr-3 py-2 border rounded-md focus:ring-emerald-500 focus:border-emerald-500" 
                />
                <Phone className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
              </div>
              {errors.telefone && <p className="text-red-500 text-xs">{errors.telefone.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Email (Opcional)</label>
              <div className="relative">
                <input 
                  {...register('email')} 
                  placeholder="email@exemplo.com"
                  className="w-full pl-10 pr-3 py-2 border rounded-md focus:ring-emerald-500 focus:border-emerald-500" 
                />
                <Mail className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
              </div>
              {errors.email && <p className="text-red-500 text-xs">{errors.email.message}</p>}
            </div>
          </div>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900 border-b pb-2 flex items-center">
            <Save className="w-5 h-5 mr-2 text-emerald-600" />
            Permissões de Acesso
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PERMISSOES_DISPONIVEIS.map((perm) => (
              <label key={perm.id} className="flex items-center space-x-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  value={perm.id}
                  {...register('permissoes')}
                  className="w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500"
                />
                <span className="text-sm text-gray-700">{perm.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto flex items-center justify-center px-6 py-3 bg-emerald-600 text-white font-medium rounded-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 transition-colors"
          >
            <Save className="w-5 h-5 mr-2" />
            {isSubmitting ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Cadastrar Funcionário'}
          </button>
        </div>
      </form>
    </div>
  );
}
