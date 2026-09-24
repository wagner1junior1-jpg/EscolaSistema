import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Button,
  Input,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Modal,
  useToast,
} from '@/components/ui';
import {
  LogIn,
  KeyRound,
  BookOpen,
  GraduationCap,
  Building2,
  Sparkles,
  School,
  Search,
  CheckCircle,
  ArrowRight,
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const toast = useToast();

  const routes = [
    {
      path: '/entrar',
      title: 'Acesso da Equipe Escolar',
      desc: 'Professores, coordenadores e diretores entram aqui com e-mail e senha.',
      icon: <LogIn className="w-5 h-5" />,
      tag: 'Equipe',
      bgFrom: 'from-indigo-500',
      bgTo: 'to-indigo-700',
      tagBg: 'bg-indigo-50 text-indigo-700',
      hoverText: 'group-hover:text-indigo-600',
    },
    {
      path: '/aluno',
      title: 'Acesso do Aluno',
      desc: 'Entre com o código da turma e PIN de 4 dígitos. Sem e-mail necessário.',
      icon: <KeyRound className="w-5 h-5" />,
      tag: 'Aluno & Família',
      bgFrom: 'from-emerald-400',
      bgTo: 'to-emerald-600',
      tagBg: 'bg-emerald-50 text-emerald-700',
      hoverText: 'group-hover:text-emerald-600',
    },
    {
      path: '/aluno/painel',
      title: 'Painel do Aluno',
      desc: 'Atividades, avisos da turma, boletim e Espaço dos Pais.',
      icon: <BookOpen className="w-5 h-5" />,
      tag: 'Aluno',
      bgFrom: 'from-amber-400',
      bgTo: 'to-amber-600',
      tagBg: 'bg-amber-50 text-amber-700',
      hoverText: 'group-hover:text-amber-600',
    },
    {
      path: '/professor',
      title: 'Portal do Professor',
      desc: 'Chamada P/F/J, atividades, questões, mural e mapa de calor.',
      icon: <GraduationCap className="w-5 h-5" />,
      tag: 'Docente',
      bgFrom: 'from-violet-500',
      bgTo: 'to-violet-700',
      tagBg: 'bg-violet-50 text-violet-700',
      hoverText: 'group-hover:text-violet-600',
    },
    {
      path: '/gestao',
      title: 'Gestão Escolar',
      desc: 'Configura escola, períodos, turmas, disciplinas e relatórios pedagógicos.',
      icon: <Building2 className="w-5 h-5" />,
      tag: 'Diretoria',
      bgFrom: 'from-sky-500',
      bgTo: 'to-sky-700',
      tagBg: 'bg-sky-50 text-sky-700',
      hoverText: 'group-hover:text-sky-600',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-16">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white flex items-center justify-center shadow-md shadow-indigo-200/60">
              <School className="w-5 h-5" />
            </div>
            <div>
              <span className="font-heading font-extrabold text-base tracking-tight text-slate-900">
                SaberPontual
              </span>
              <p className="text-[11px] text-slate-400 font-medium leading-none hidden sm:block">
                Exercícios Rápidos &amp; Diagnóstico Pedagógico
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
              ✦ Plataforma escolar
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 pt-10 space-y-12">
        {/* Hero Section */}
        <div className="text-center max-w-2xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            Plataforma para escolas modernas
          </div>
          <h1 className="font-heading font-black text-3xl sm:text-4xl text-slate-900 tracking-tight leading-tight">
            Aprenda mais.<br className="sm:hidden" /> Ensine melhor.
          </h1>
          <p className="text-sm sm:text-base text-slate-500 leading-relaxed max-w-xl mx-auto">
            Atividades, provas e diagnóstico pedagógico em uma só plataforma — sem complicação, sem e-mail para o aluno.
          </p>
        </div>

        {/* Acesse sua área */}
        <section className="space-y-5">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
            <h2 className="font-heading font-bold text-lg text-slate-900">
              Acesse sua área
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {routes.map((route) => (
              <Link key={route.path} to={route.path} className="group">
                <Card hover className="h-full flex flex-col justify-between p-5">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${route.bgFrom} ${route.bgTo} text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform`}>
                        {route.icon}
                      </div>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${route.tagBg}`}>
                        {route.tag}
                      </span>
                    </div>
                    <div>
                      <h3 className={`font-heading font-bold text-slate-900 text-base transition-colors ${route.hoverText}`}>
                        {route.title}
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        {route.desc}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end text-xs font-semibold text-slate-400 group-hover:text-indigo-500 transition-colors gap-1">
                    Acessar <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {/* Biblioteca de Componentes */}
        <section className="space-y-5 pt-2">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
            <h2 className="font-heading font-bold text-lg text-slate-900">
              Biblioteca de Componentes
            </h2>
            <span className="text-xs text-slate-400">Design system base</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card com Buttons */}
            <Card>
              <CardHeader>
                <CardTitle>Botões</CardTitle>
                <CardDescription>
                  Variantes primária, secundária, outline, ghost e perigo — em três tamanhos.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2.5">
                  <Button variant="primary">Primário</Button>
                  <Button variant="secondary">Secundário</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="danger">Perigo</Button>
                </div>
                <div className="flex flex-wrap items-center gap-2.5 pt-2">
                  <Button size="sm" variant="primary">Pequeno</Button>
                  <Button size="md" variant="primary">Médio</Button>
                  <Button size="lg" variant="primary">Grande</Button>
                  <Button isLoading variant="primary">Carregando</Button>
                </div>
              </CardContent>
            </Card>

            {/* Card com Inputs */}
            <Card>
              <CardHeader>
                <CardTitle>Campos de Entrada</CardTitle>
                <CardDescription>
                  Com rótulo, ícone, texto de ajuda e validação de erro.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  label="Código da Turma"
                  placeholder="Ex: 7A-K3P"
                  leftIcon={<Search className="w-4 h-4" />}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  helperText="Digite o código fornecido pela escola."
                />
                <Input
                  label="PIN do Aluno"
                  placeholder="4 dígitos numéricos"
                  error="O PIN deve conter exatamente 4 números."
                  type="password"
                  maxLength={4}
                />
              </CardContent>
            </Card>

            {/* Card com Modais */}
            <Card>
              <CardHeader>
                <CardTitle>Modal</CardTitle>
                <CardDescription>
                  Janela dialog responsiva com foco, animação, backdrop blur e tecla ESC.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-slate-600">
                  Clique no botão abaixo para abrir a janela modal de demonstração.
                </p>
                <Button variant="outline" onClick={() => setIsModalOpen(true)}>
                  Abrir Modal
                </Button>
              </CardContent>
            </Card>

            {/* Card com Toasts */}
            <Card>
              <CardHeader>
                <CardTitle>Notificações (Toast)</CardTitle>
                <CardDescription>
                  Alertas flutuantes com auto-dismiss em 4 segundos.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                    onClick={() =>
                      toast.success('Atividade enviada com sucesso!', 'Tudo certo')
                    }
                  >
                    Sucesso
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-rose-700 border-rose-200 hover:bg-rose-50"
                    onClick={() =>
                      toast.error('PIN incorreto. 4 tentativas restantes.', 'Erro de acesso')
                    }
                  >
                    Erro
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-amber-700 border-amber-200 hover:bg-amber-50"
                    onClick={() =>
                      toast.warning('Prazo encerra em 2 horas.', 'Atenção')
                    }
                  >
                    Alerta
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-indigo-700 border-indigo-200 hover:bg-indigo-50"
                    onClick={() =>
                      toast.info('Novo aviso no mural institucional.', 'Informação')
                    }
                  >
                    Info
                  </Button>
                </div>
              </CardContent>
              <CardFooter className="text-xs text-slate-500">
                Disponível via hook <code className="font-mono text-indigo-600">useToast()</code> em qualquer tela.
              </CardFooter>
            </Card>
          </div>
        </section>
      </main>

      {/* Modal de Demonstração */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Modal de Demonstração"
        description="Componente Modal padronizado do SaberPontual."
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <p className="text-xs text-indigo-900 leading-relaxed">
              O modal possui backdrop blur, animação fluida, bloqueio de scroll de fundo e fechamento ao clicar fora ou pressionar ESC.
            </p>
          </div>
          <div className="flex justify-end gap-2.5 pt-2">
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>
              Fechar
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                setIsModalOpen(false);
                toast.success('Ação realizada a partir do modal!');
              }}
            >
              Confirmar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default HomePage;
