import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlunoLayout, CartaoVidro, BotaoGrande, ChipInfo } from '@/components/aluno';
import { alunoService } from '@/services';
import { useToast } from '@/components/ui';
import { LogOut, Sparkles, GraduationCap, Loader2 } from 'lucide-react';

export const AlunoPainelPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const [nome, setNome] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let montado = true;
    const token = localStorage.getItem('saberpontual_aluno_token');

    if (!token) {
      navigate('/aluno', { replace: true });
      return;
    }

    async function validarSessao() {
      try {
        const dados = await alunoService.meuDesempenho(token!);
        if (montado) {
          setNome(dados.aluno.nome_completo);
        }
      } catch (err) {
        if (montado) {
          localStorage.removeItem('saberpontual_aluno_token');
          if (err instanceof Error && err.message.includes('Os dados foram atualizados em outra aba')) {
            toast.warning(err.message, 'Atenção');
          } else {
            toast.error('Sessão expirada ou inválida. Por favor, acesse novamente.', 'Acesso encerrado');
          }
          navigate('/aluno', { replace: true });
        }
      } finally {
        if (montado) {
          setCarregando(false);
        }
      }
    }

    validarSessao();

    return () => {
      montado = false;
    };
  }, [navigate, toast]);

  const handleSair = () => {
    localStorage.removeItem('saberpontual_aluno_token');
    navigate('/aluno', { replace: true });
  };

  if (carregando) {
    return (
      <AlunoLayout containerClassName="items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-indigo-700">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="font-heading font-bold text-base">Carregando painel...</p>
        </div>
      </AlunoLayout>
    );
  }

  return (
    <AlunoLayout containerClassName="items-center justify-center p-4 py-12">
      <main className="w-full max-w-lg space-y-4">
        <CartaoVidro className="p-6 sm:p-10 space-y-6 text-center">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center shadow-lg shadow-indigo-300/50">
            <GraduationCap className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5">
              <ChipInfo color="emerald" icon={<Sparkles className="w-3.5 h-3.5 text-emerald-600" />}>
                Aluno Conectado
              </ChipInfo>
            </div>
            <h1 className="font-heading font-black text-2xl sm:text-3xl text-slate-900 tracking-tight">
              Olá, {nome}!
            </h1>
            <p className="text-sm text-slate-600 font-sans leading-relaxed">
              Bem-vindo ao seu portal de estudos. Em breve você poderá resolver atividades, provas e acompanhar seu desempenho.
            </p>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <BotaoGrande
              variant="outline"
              onClick={handleSair}
              leftIcon={<LogOut className="w-4 h-4 text-slate-600" />}
              className="w-full text-sm sm:text-base text-slate-700"
            >
              Sair
            </BotaoGrande>
          </div>
        </CartaoVidro>
      </main>
    </AlunoLayout>
  );
};

export default AlunoPainelPage;
