import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AlunoLayout, CartaoVidro, BotaoGrande, ChipInfo } from '@/components/aluno';
import { alunoService } from '@/services';
import { AlunoResumido } from '@/lib/types';
import { useToast } from '@/components/ui';
import {
  GraduationCap,
  ArrowLeft,
  Search,
  Delete,
  AlertCircle,
  Loader2,
  X,
} from 'lucide-react';

type PassoLoginAluno = 'codigo' | 'nome' | 'pin';

export const AlunoLoginPage: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const [passo, setPasso] = useState<PassoLoginAluno>('codigo');
  const [codigoTurma, setCodigoTurma] = useState('');
  const [alunos, setAlunos] = useState<AlunoResumido[]>([]);
  const [buscaAluno, setBuscaAluno] = useState('');
  const [alunoSelecionado, setAlunoSelecionado] = useState<AlunoResumido | null>(null);
  const [pin, setPin] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const pinInputRef = useRef<HTMLInputElement>(null);

  // Foco automático no input escondido apenas quando NÃO for dispositivo de toque
  useEffect(() => {
    if (passo === 'pin' && pinInputRef.current) {
      const isTouch =
        typeof window !== 'undefined' &&
        window.matchMedia('(pointer: coarse)').matches;
      if (!isTouch) {
        pinInputRef.current.focus();
      }
    }
  }, [passo]);

  const handleFocarInputNaoTouch = () => {
    const isTouch =
      typeof window !== 'undefined' &&
      window.matchMedia('(pointer: coarse)').matches;
    if (!isTouch) {
      pinInputRef.current?.focus();
    }
  };

  // Passo A: Buscar turma pelo código
  const handleBuscarTurma = async (e: React.FormEvent) => {
    e.preventDefault();
    const codigoLimpo = codigoTurma.trim().toUpperCase();
    if (!codigoLimpo) {
      setErro('Por favor, informe o código da sua turma.');
      return;
    }

    setErro(null);
    setCarregando(true);
    try {
      const listaAlunos = await alunoService.listarTurma(codigoLimpo);
      if (!listaAlunos || listaAlunos.length === 0) {
        setErro('Nenhum aluno ativo encontrado para esta turma.');
        return;
      }

      setAlunos(listaAlunos.sort((a, b) => a.numero_chamada - b.numero_chamada));
      setCodigoTurma(codigoLimpo);
      setBuscaAluno('');
      setPasso('nome');
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes('Os dados foram atualizados em outra aba')) {
          toast.warning(err.message, 'Atenção');
        }
        setErro(err.message);
      } else {
        setErro('Turma não encontrada. Verifique o código e tente novamente.');
      }
    } finally {
      setCarregando(false);
    }
  };

  // Passo B: Selecionar o aluno
  const alunosFiltrados = useMemo(() => {
    const termo = buscaAluno.trim().toLowerCase();
    if (!termo) return alunos;
    return alunos.filter(
      (a) =>
        a.nome_completo.toLowerCase().includes(termo) ||
        String(a.numero_chamada).includes(termo)
    );
  }, [alunos, buscaAluno]);

  const handleSelecionarAluno = (aluno: AlunoResumido) => {
    setAlunoSelecionado(aluno);
    setPin('');
    setErro(null);
    setPasso('pin');
  };

  // Passo C: Submeter PIN de 4 dígitos
  const submeterPin = async (pinDigitado: string) => {
    if (!alunoSelecionado || pinDigitado.length !== 4) return;

    setErro(null);
    setCarregando(true);
    try {
      const { token } = await alunoService.login(alunoSelecionado.id, pinDigitado);
      localStorage.setItem('saberpontual_aluno_token', token);
      navigate('/aluno/painel', { replace: true });
    } catch (err) {
      setPin('');
      if (err instanceof Error) {
        if (err.message.includes('Os dados foram atualizados em outra aba')) {
          toast.warning(err.message, 'Atenção');
        }
        setErro(err.message);
      } else {
        setErro('Não foi possível entrar. Tente novamente.');
      }
    } finally {
      setCarregando(false);
    }
  };

  // Manipulação de dígitos no teclado na tela
  const handleDigitoTeclado = (digito: string) => {
    if (carregando || pin.length >= 4) return;
    const novoPin = pin + digito;
    setPin(novoPin);
    setErro(null);

    if (novoPin.length === 4) {
      submeterPin(novoPin);
    }
  };

  const handleApagarDigito = () => {
    if (carregando || pin.length === 0) return;
    setPin((prev) => prev.slice(0, -1));
    setErro(null);
  };

  const handleLimparPin = () => {
    if (carregando) return;
    setPin('');
    setErro(null);
  };

  // Tratamento via onChange para teclado físico e Android
  const handleChangePinInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (carregando) return;
    const digitos = e.target.value.replace(/\D/g, '').slice(0, 4);
    setPin(digitos);
    setErro(null);

    if (digitos.length === 4) {
      submeterPin(digitos);
    }
  };

  return (
    <AlunoLayout containerClassName="items-center justify-center p-4 py-8">
      <div className="w-full max-w-md space-y-4">
        {/* Link de Navegação / Voltar ao Início */}
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-heading font-bold text-slate-500 hover:text-indigo-600 transition-colors p-1 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Página inicial</span>
          </Link>

          {passo !== 'codigo' && (
            <ChipInfo color="indigo">
              Turma {codigoTurma}
            </ChipInfo>
          )}
        </div>

        {/* Card Principal */}
        <CartaoVidro className="p-6 sm:p-8 space-y-6">
          {/* ============================================================== */}
          {/* PASSO A: CÓDIGO DA TURMA */}
          {/* ============================================================== */}
          {passo === 'codigo' && (
            <div className="space-y-6 text-center">
              <div className="space-y-3 flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-indigo-200">
                  <GraduationCap className="w-8 h-8" />
                </div>
                <h1 className="font-heading font-black text-2xl sm:text-3xl text-slate-900 tracking-tight">
                  Portal do Aluno
                </h1>
                <p className="text-xs sm:text-sm text-slate-600 font-sans">
                  Digite o código da sua turma fornecido pelo professor
                </p>
              </div>

              {erro && (
                <div
                  role="alert"
                  className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs sm:text-sm flex items-start gap-2.5 text-left"
                >
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <span>{erro}</span>
                </div>
              )}

              <form onSubmit={handleBuscarTurma} className="space-y-4 text-left" noValidate>
                <div>
                  <label
                    htmlFor="codigo-turma"
                    className="block text-xs sm:text-sm font-heading font-bold text-slate-700 mb-1.5 text-center"
                  >
                    Código da Turma
                  </label>
                  <div className="relative">
                    <input
                      id="codigo-turma"
                      type="text"
                      autoFocus
                      autoComplete="off"
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder="Ex: 7A-MAT"
                      value={codigoTurma}
                      onChange={(e) => {
                        setCodigoTurma(e.target.value.toUpperCase());
                        setErro(null);
                      }}
                      className="block w-full text-center px-4 py-3 rounded-2xl border-2 border-slate-200 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500 text-xl sm:text-2xl font-heading font-black uppercase tracking-widest text-slate-900 placeholder-slate-400 bg-white transition-all min-h-[52px] focus:outline-none"
                    />
                  </div>
                  <p className="mt-2 text-center text-xs text-slate-400">
                    O código é em letras maiúsculas (ex: 5A-MAT ou 6B-CIE).
                  </p>
                </div>

                <BotaoGrande
                  type="submit"
                  variant="primary"
                  isLoading={carregando}
                  className="w-full text-base sm:text-lg min-h-[52px]"
                >
                  Continuar
                </BotaoGrande>
              </form>
            </div>
          )}

          {/* ============================================================== */}
          {/* PASSO B: SELEÇÃO DO NOME COM FILTRO RÁPIDO */}
          {/* ============================================================== */}
          {passo === 'nome' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div>
                  <h1 className="font-heading font-black text-xl sm:text-2xl text-slate-900 tracking-tight">
                    Quem é você?
                  </h1>
                  <p className="text-xs text-slate-500 font-sans mt-0.5">
                    {alunos.length} alunos na turma
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPasso('codigo');
                    setErro(null);
                  }}
                  className="text-xs font-heading font-bold text-indigo-600 hover:text-indigo-800 transition-colors p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  Trocar turma
                </button>
              </div>

              {/* Barra de Busca Rápida (Fundamental para turmas com 20-35 alunos) */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  placeholder="Buscar seu nome ou número..."
                  value={buscaAluno}
                  onChange={(e) => setBuscaAluno(e.target.value)}
                  className="w-full pl-9 pr-9 py-2.5 rounded-xl border-2 border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 text-sm font-sans placeholder-slate-400 bg-white focus:outline-none min-h-[44px]"
                />
                {buscaAluno && (
                  <button
                    type="button"
                    onClick={() => setBuscaAluno('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    aria-label="Limpar busca"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Lista de Alunos em cartões touch grandes */}
              <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-0.5 no-scrollbar">
                {alunosFiltrados.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 text-xs sm:text-sm">
                    Nenhum aluno encontrado para "{buscaAluno}".
                  </div>
                ) : (
                  alunosFiltrados.map((aluno) => (
                    <button
                      key={aluno.id}
                      type="button"
                      onClick={() => handleSelecionarAluno(aluno)}
                      className="w-full p-3 sm:p-3.5 rounded-2xl border-2 border-slate-200 hover:border-indigo-400 active:border-indigo-600 bg-white hover:bg-indigo-50/40 active:bg-indigo-50 text-left transition-all flex items-center justify-between gap-3 group shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[56px] cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 font-heading font-black text-xs sm:text-sm flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                          {aluno.numero_chamada}
                        </div>
                        <span className="font-heading font-bold text-sm sm:text-base text-slate-800 group-hover:text-indigo-900 truncate">
                          {aluno.nome_completo}
                        </span>
                      </div>
                      <span className="text-xs font-bold text-indigo-600 shrink-0">
                        Entrar →
                      </span>
                    </button>
                  ))
                )}
              </div>

              <div className="pt-2">
                <BotaoGrande
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPasso('codigo');
                    setErro(null);
                  }}
                  leftIcon={<ArrowLeft className="w-4 h-4" />}
                  className="w-full text-sm min-h-[48px]"
                >
                  Voltar
                </BotaoGrande>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* PASSO C: DIGITAÇÃO DO PIN */}
          {/* ============================================================== */}
          {passo === 'pin' && alunoSelecionado && (
            <div className="space-y-4 text-center">
              <div className="space-y-1">
                <span className="text-xs font-heading font-bold text-indigo-600 uppercase tracking-wider">
                  Nº {alunoSelecionado.numero_chamada}
                </span>
                <h1 className="font-heading font-black text-xl sm:text-2xl text-slate-900 tracking-tight truncate px-2">
                  {alunoSelecionado.nome_completo}
                </h1>
                <p className="text-xs text-slate-500 font-sans">
                  Digite seu PIN de 4 dígitos
                </p>
              </div>

              {/* Mensagem de Erro ou Bloqueio do Serviço */}
              {erro && (
                <div
                  role="alert"
                  className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs sm:text-sm flex items-start gap-2.5 text-left"
                >
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <span className="leading-snug">{erro}</span>
                </div>
              )}

              {/* 4 Caixas do PIN */}
              <div
                className="flex items-center justify-center gap-2.5 sm:gap-3.5 py-1 cursor-pointer"
                onClick={handleFocarInputNaoTouch}
              >
                {[0, 1, 2, 3].map((index) => {
                  const preenchido = pin.length > index;
                  const atual = pin.length === index;
                  return (
                    <div
                      key={index}
                      className={`
                        w-12 h-14 sm:w-14 sm:h-16 rounded-2xl flex items-center justify-center border-2 transition-all
                        ${
                          preenchido
                            ? 'border-indigo-600 bg-indigo-50/60 shadow-sm scale-105'
                            : atual
                            ? 'border-indigo-400 bg-white ring-2 ring-indigo-200'
                            : 'border-slate-200 bg-slate-50/70'
                        }
                      `}
                    >
                      {preenchido ? (
                        <div className="w-4 h-4 rounded-full bg-indigo-600 transition-transform scale-100" />
                      ) : (
                        <span className="text-slate-300 font-mono text-xl">•</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Input escondido para acessibilidade, teclado físico e Android via onChange */}
              <input
                ref={pinInputRef}
                id="pin-input"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={pin}
                onChange={handleChangePinInput}
                className="sr-only"
                aria-label="PIN numérico de 4 dígitos"
              />

              {carregando && (
                <div className="flex items-center justify-center gap-2 text-indigo-600 text-sm font-heading font-bold py-1">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verificando PIN...</span>
                </div>
              )}

              {/* Teclado Numérico na Tela (botões h-14 a h-16, toque confortável) */}
              <div className="grid grid-cols-3 gap-2 sm:gap-2.5 max-w-[290px] sm:max-w-[310px] w-full mx-auto pt-1">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                  <button
                    key={num}
                    type="button"
                    disabled={carregando || pin.length >= 4}
                    onClick={() => handleDigitoTeclado(num)}
                    className="h-14 sm:h-16 min-h-[52px] rounded-2xl border-2 border-slate-200 hover:border-indigo-400 active:border-indigo-600 bg-white hover:bg-indigo-50/60 active:bg-indigo-100 active:scale-95 text-slate-800 font-heading font-black text-2xl shadow-sm transition-all flex items-center justify-center disabled:opacity-40 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {num}
                  </button>
                ))}

                <button
                  type="button"
                  disabled={carregando || pin.length === 0}
                  onClick={handleLimparPin}
                  aria-label="Limpar PIN"
                  className="h-14 sm:h-16 min-h-[52px] rounded-2xl border border-slate-200 hover:border-slate-300 active:bg-slate-200 bg-slate-100/90 active:scale-95 text-slate-600 font-heading font-bold text-xs uppercase shadow-sm transition-all flex items-center justify-center disabled:opacity-30 cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-300"
                >
                  Limpar
                </button>

                <button
                  type="button"
                  disabled={carregando || pin.length >= 4}
                  onClick={() => handleDigitoTeclado('0')}
                  className="h-14 sm:h-16 min-h-[52px] rounded-2xl border-2 border-slate-200 hover:border-indigo-400 active:border-indigo-600 bg-white hover:bg-indigo-50/60 active:bg-indigo-100 active:scale-95 text-slate-800 font-heading font-black text-2xl shadow-sm transition-all flex items-center justify-center disabled:opacity-40 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  0
                </button>

                <button
                  type="button"
                  disabled={carregando || pin.length === 0}
                  onClick={handleApagarDigito}
                  aria-label="Apagar último dígito"
                  className="h-14 sm:h-16 min-h-[52px] rounded-2xl border border-slate-200 hover:border-slate-300 active:bg-slate-200 bg-slate-100/90 active:scale-95 text-slate-600 shadow-sm transition-all flex items-center justify-center disabled:opacity-30 cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-300"
                >
                  <Delete className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>

              {/* Botão Voltar para lista de alunos */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setPasso('nome');
                    setPin('');
                    setErro(null);
                  }}
                  className="text-xs font-heading font-bold text-slate-500 hover:text-indigo-600 transition-colors p-2 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 inline-flex items-center gap-1"
                >
                  ← Trocar de aluno
                </button>
              </div>
            </div>
          )}
        </CartaoVidro>
      </div>
    </AlunoLayout>
  );
};

export default AlunoLoginPage;
