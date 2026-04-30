import { useState, useEffect, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, ArrowLeft, Upload, Camera, RefreshCw } from 'lucide-react';
import Webcam from 'react-webcam';
import { supabase } from '../lib/supabase';

const parQSchema = z.object({
  q1: z.string(),
  q2: z.string(),
  q3: z.string(),
  q4: z.string(),
  q5: z.string(),
  q6: z.string(),
  q7: z.string(),
});

const alunoSchema = z.object({
  nome: z.string().min(3, 'Nome é obrigatório'),
  cep: z.string().min(8, 'CEP inválido'),
  endereco: z.string().min(5, 'Endereço é obrigatório'),
  complemento: z.string().optional(),
  bairro: z.string().min(2, 'Bairro é obrigatório'),
  telefone: z.string().min(10, 'Telefone inválido'),
  email: z.string().email('E-mail inválido'),
  dataNascimento: z.string().min(10, 'Data de nascimento é obrigatória'),
  parQ: parQSchema,
  turmas: z.array(z.string()).min(1, 'Selecione pelo menos uma turma'),
  termoResponsabilidade: z.boolean().optional(),
  termoVeracidade: z.boolean().refine((val) => val === true, {
    message: 'Você deve aceitar o termo de veracidade',
  }),
}).refine(
  (data) => {
    const hasYes = Object.values(data.parQ).some((val) => val === 'true');
    if (hasYes && !data.termoResponsabilidade) {
      return false;
    }
    return true;
  },
  {
    message: 'O Termo de Responsabilidade é obrigatório pois você respondeu SIM a uma ou mais perguntas do PAR-Q.',
    path: ['termoResponsabilidade'],
  }
);

type AlunoFormData = z.infer<typeof alunoSchema>;

export default function NovoAluno() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [availableTurmas, setAvailableTurmas] = useState<any[]>([]);
  const webcamRef = useRef<Webcam>(null);
  
  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AlunoFormData>({
    resolver: zodResolver(alunoSchema),
    defaultValues: {
      parQ: {
        q1: 'false', q2: 'false', q3: 'false', q4: 'false', q5: 'false', q6: 'false', q7: 'false'
      },
      turmas: []
    }
  });

  useEffect(() => {
    async function fetchData() {
      setIsLoading(true);
      try {
        // Fetch turmas
        const { data: turmasData } = await supabase
          .from('turmas')
          .select('*, modalidades(nome), equipamentos(tipo)')
          .eq('status', 'ativa');
        
        if (turmasData) setAvailableTurmas(turmasData);

        if (id) {
          const { data: aluno, error } = await supabase
            .from('alunos')
            .select('*, matriculas(turma_id)')
            .eq('id', id)
            .single();

          if (error) throw error;

          if (aluno) {
            reset({
              nome: aluno.nome,
              dataNascimento: aluno.data_nascimento,
              bairro: aluno.bairro,
              telefone: aluno.telefone_responsavel,
              cep: '00000000',
              endereco: 'Endereço',
              email: 'email@example.com',
              turmas: aluno.matriculas?.map((m: any) => m.turma_id) || [],
              parQ: {
                q1: 'false', q2: 'false', q3: 'false', q4: 'false', q5: 'false', q6: 'false', q7: 'false'
              },
              termoVeracidade: true,
            });
            if (aluno.foto_url) setFotoUrl(aluno.foto_url);
          }
        }
      } catch (error) {
        console.error('Erro ao buscar dados:', error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [id, reset]);

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      setFotoUrl(imageSrc);
      setShowCamera(false);
    }
  }, [webcamRef]);

  const parQValues = watch('parQ');
  const requiresTermo = Object.values(parQValues || {}).some((val) => val === 'true');

  const onSubmit = async (data: AlunoFormData) => {
    try {
      const alunoData = {
        nome: data.nome,
        data_nascimento: data.dataNascimento,
        bairro: data.bairro,
        telefone_responsavel: data.telefone,
        foto_url: fotoUrl,
      };

      let alunoId = id;

      if (id) {
        const { error } = await supabase
          .from('alunos')
          .update(alunoData)
          .eq('id', id);

        if (error) throw error;
      } else {
        const matricula = `ESP${Math.floor(100000 + Math.random() * 900000)}`;
        const { data: newAluno, error } = await supabase
          .from('alunos')
          .insert([{ ...alunoData, matricula }])
          .select()
          .single();

        if (error) throw error;
        alunoId = newAluno.id;
      }

      // Update matriculas
      if (alunoId) {
        // Delete old matriculas if editing
        if (id) {
          await supabase.from('matriculas').delete().eq('aluno_id', alunoId);
        }

        // Insert new matriculas
        const matriculasToInsert = data.turmas.map(turmaId => ({
          aluno_id: alunoId,
          turma_id: turmaId,
          status: 'ativa',
          data_matricula: new Date().toISOString()
        }));

        const { error: mError } = await supabase.from('matriculas').insert(matriculasToInsert);
        if (mError) throw mError;
      }
      
      navigate('/alunos');
    } catch (error) {
      console.error('Erro ao salvar:', error);
      alert('Erro ao salvar os dados.');
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Carregando dados...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate(-1)} className="p-2 text-gray-500 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{id ? 'Editar Aluno' : 'Novo Aluno'}</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Foto 3x4 com Câmera */}
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">Foto do Aluno</h2>
          <div className="flex flex-col items-center space-y-4">
            {showCamera ? (
              <div className="relative w-full max-w-sm overflow-hidden rounded-lg border-2 border-gray-300">
                {/* @ts-ignore */}
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  videoConstraints={{ facingMode: "environment" }}
                  className="w-full"
                  onUserMediaError={(err) => console.error('Webcam error:', err)}
                />
                <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-4">
                  <button
                    type="button"
                    onClick={capture}
                    className="p-3 bg-emerald-600 text-white rounded-full shadow-lg hover:bg-emerald-700"
                  >
                    <Camera className="w-6 h-6" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCamera(false)}
                    className="p-3 bg-gray-600 text-white rounded-full shadow-lg hover:bg-gray-700"
                  >
                    <RefreshCw className="w-6 h-6" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center space-y-4">
                {fotoUrl ? (
                  <div className="relative w-32 h-40 border-2 border-gray-200 rounded-lg overflow-hidden">
                    <img src={fotoUrl} alt="Foto do aluno" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setShowCamera(true)}
                      className="absolute bottom-0 left-0 right-0 bg-black/50 text-white py-1 text-xs hover:bg-black/70"
                    >
                      Alterar
                    </button>
                  </div>
                ) : (
                  <div className="w-32 h-40 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center bg-gray-50">
                    <Camera className="w-8 h-8 text-gray-400 mb-2" />
                    <button
                      type="button"
                      onClick={() => setShowCamera(true)}
                      className="text-xs text-emerald-600 font-medium hover:underline"
                    >
                      Tirar Foto
                    </button>
                  </div>
                )}
                <div className="flex items-center justify-center w-full">
                  <label className="flex items-center px-4 py-2 bg-white border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer">
                    <Upload className="w-4 h-4 mr-2 text-gray-400" />
                    Upload de Arquivo
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => setFotoUrl(reader.result as string);
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Informações Pessoais */}
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">Informações Pessoais</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Nome Completo</label>
              <input {...register('nome')} className="w-full px-3 py-2 border rounded-md focus:ring-emerald-500 focus:border-emerald-500" />
              {errors.nome && <p className="text-red-500 text-xs">{errors.nome.message}</p>}
            </div>
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Data de Nascimento</label>
              <input type="date" {...register('dataNascimento')} className="w-full px-3 py-2 border rounded-md focus:ring-emerald-500 focus:border-emerald-500" />
              {errors.dataNascimento && <p className="text-red-500 text-xs">{errors.dataNascimento.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">E-mail</label>
              <input type="email" {...register('email')} className="w-full px-3 py-2 border rounded-md focus:ring-emerald-500 focus:border-emerald-500" />
              {errors.email && <p className="text-red-500 text-xs">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Telefone</label>
              <input {...register('telefone')} className="w-full px-3 py-2 border rounded-md focus:ring-emerald-500 focus:border-emerald-500" />
              {errors.telefone && <p className="text-red-500 text-xs">{errors.telefone.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">CEP</label>
              <input {...register('cep')} className="w-full px-3 py-2 border rounded-md focus:ring-emerald-500 focus:border-emerald-500" />
              {errors.cep && <p className="text-red-500 text-xs">{errors.cep.message}</p>}
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Endereço</label>
              <input {...register('endereco')} className="w-full px-3 py-2 border rounded-md focus:ring-emerald-500 focus:border-emerald-500" />
              {errors.endereco && <p className="text-red-500 text-xs">{errors.endereco.message}</p>}
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">Complemento</label>
              <input {...register('complemento')} className="w-full px-3 py-2 border rounded-md focus:ring-emerald-500 focus:border-emerald-500" />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Bairro</label>
              <input {...register('bairro')} className="w-full px-3 py-2 border rounded-md focus:ring-emerald-500 focus:border-emerald-500" />
              {errors.bairro && <p className="text-red-500 text-xs">{errors.bairro.message}</p>}
            </div>
          </div>
        </div>

        {/* Matrícula em Turmas */}
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">Matrícula em Turmas</h2>
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">Selecione as Turmas</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {availableTurmas.map((turma) => (
                <label key={turma.id} className="flex items-center p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    value={turma.id}
                    {...register('turmas')}
                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 mr-3"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">{turma.modalidades?.nome}</div>
                    <div className="text-xs text-gray-500">
                      {turma.equipamentos?.tipo} - {turma.dias_semana.join(', ')} ({turma.horario_inicio})
                    </div>
                  </div>
                </label>
              ))}
            </div>
            {errors.turmas && <p className="text-red-500 text-xs">{errors.turmas.message}</p>}
          </div>
        </div>

        {/* PAR-Q */}
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100 space-y-6">
          <h2 className="text-lg font-semibold text-gray-900 border-b pb-2">Anamnese: PAR-Q</h2>
          <p className="text-sm text-gray-600 mb-4">
            Este questionário tem o objetivo de identificar a necessidade de avaliação por um médico antes do início da atividade física.
          </p>

          <div className="space-y-4">
            {[
              { id: 'q1', text: '1. Algum médico já disse que você possui algum problema de coração e que só deveria realizar atividade física supervisionado por profissionais de saúde?' },
              { id: 'q2', text: '2. Você sente dores no peito quando pratica atividade física?' },
              { id: 'q3', text: '3. No último mês, você sentiu dores no peito quando praticou atividade física?' },
              { id: 'q4', text: '4. Você apresenta desequilíbrio devido à tontura e/ou perda de consciência?' },
              { id: 'q5', text: '5. Você possui algum problema ósseo ou articular que poderia ser piorado pela atividade física?' },
              { id: 'q6', text: '6. Você toma atualmente algum medicamento para pressão arterial e/ou problema de coração?' },
              { id: 'q7', text: '7. Sabe de alguma outra razão pela qual você não deve praticar atividade física?' },
            ].map((q) => (
              <div key={q.id} className="flex flex-col sm:flex-row sm:items-start sm:justify-between p-3 bg-gray-50 rounded-lg gap-3 sm:gap-0">
                <span className="text-sm text-gray-700 flex-1 sm:pr-4">{q.text}</span>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input type="radio" {...register(`parQ.${q.id as keyof typeof parQValues}`)} value="true" className="mr-2 text-emerald-600 focus:ring-emerald-500" />
                    Sim
                  </label>
                  <label className="flex items-center">
                    <input type="radio" {...register(`parQ.${q.id as keyof typeof parQValues}`)} value="false" className="mr-2 text-emerald-600 focus:ring-emerald-500" />
                    Não
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Termos */}
        <div className="space-y-4">
          {requiresTermo && (
            <div className="bg-orange-50 p-4 sm:p-6 rounded-xl border border-orange-200 space-y-4">
              <h3 className="text-lg font-bold text-orange-800">Termo de Responsabilidade para Prática de Atividade Física</h3>
              <p className="text-sm text-orange-900">
                Estou ciente de que é recomendável conversar com um médico antes de aumentar meu nível atual de atividade física, por ter respondido “SIM” a uma ou mais perguntas do “Questionário de Prontidão para Atividade Física” (PAR-Q). Assumo plena responsabilidade por qualquer atividade física praticada sem o atendimento a essa recomendação.
              </p>
              <label className="flex items-start mt-4">
                <input type="checkbox" {...register('termoResponsabilidade')} className="mt-1 mr-3 rounded text-orange-600 focus:ring-orange-500" />
                <span className="text-sm font-medium text-orange-900">Li e aceito o termo de responsabilidade acima.</span>
              </label>
              {errors.termoResponsabilidade && <p className="text-red-500 text-xs mt-1">{errors.termoResponsabilidade.message}</p>}
            </div>
          )}

          <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100">
            <label className="flex items-start">
              <input type="checkbox" {...register('termoVeracidade')} className="mt-1 mr-3 rounded text-emerald-600 focus:ring-emerald-500" />
              <span className="text-sm text-gray-700">Declaro que as informações prestadas são verdadeiras e assumo total responsabilidade sobre elas.</span>
            </label>
            {errors.termoVeracidade && <p className="text-red-500 text-xs mt-1">{errors.termoVeracidade.message}</p>}
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto flex items-center justify-center px-6 py-3 bg-emerald-600 text-white font-medium rounded-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 transition-colors"
          >
            <Save className="w-5 h-5 mr-2" />
            {isSubmitting ? 'Salvando...' : (id ? 'Salvar Alterações' : 'Cadastrar Aluno')}
          </button>
        </div>
      </form>
    </div>
  );
}
