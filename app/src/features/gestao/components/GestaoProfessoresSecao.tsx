import React, { useEffect, useState, useCallback } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Input,
  Modal,
  ConfirmDialog,
  useToast,
} from '@/components/ui';
import { gestaoService, Perfil } from '@/services';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  Users,
  UserPlus,
  UserX,
  Loader2,
  AlertCircle,
  Search,
  Mail,
  Key,
  Eye,
  EyeOff,
  Sparkles,
  Copy,
  Check,
} from 'lucide-react';

function gerarSenhaAleatoria(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let pass = 'Prof@';
  for (let i = 0; i < 4; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

export const GestaoProfessoresSecao: React.FC = () => {
  const toast = useToast();
  const { usuario } = useAuth();

  const [professores, setProfessores] = useState<Perfil[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // Busca
  const [busca, setBusca] = useState('');

  // Modal Convidar / Cadastrar
  const [modalConvidarAberto, setModalConvidarAberto] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);
  const [conviteSucesso, setConviteSucesso] = useState<{
    nome: string;
    email: string;
    senha: string;
  } | null>(null);
  const [copiado, setCopiado] = useState(false);

  // Redefinir Senha (apenas direção)
  const [modalRedefinirAberto, setModalRedefinirAberto] = useState(false);
  const [professorParaRedefinir, setProfessorParaRedefinir] = useState<Perfil | null>(null);
  const [novaSenha, setNovaSenha] = useState('');
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false);
  const [redefinindo, setRedefinindo] = useState(false);
  const [erroRedefinir, setErroRedefinir] = useState<string | null>(null);

  // Desativar Professor (apenas direção)
  const [professorParaDesativar, setProfessorParaDesativar] = useState<Perfil | null>(null);
  const [desativando, setDesativando] = useState(false);

  const carregarDados = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const lista = await gestaoService.listarProfessores();
      setProfessores(lista);
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Falha ao carregar professores.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregarDados();
  }, [carregarDados]);

  const abrirModalConvidar = () => {
    setNome('');
    setEmail('');
    setSenha('');
    setMostrarSenha(false);
    setErroForm(null);
    setConviteSucesso(null);
    setCopiado(false);
    setModalConvidarAberto(true);
  };

  const handleConvidar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim() || !email.trim()) {
      setErroForm('Informe o nome e o e-mail do professor.');
      return;
    }
    const senhaLimpa = senha.trim();
    if (senhaLimpa.length > 0 && senhaLimpa.length < 4) {
      setErroForm('A senha deve ter pelo menos 4 caracteres.');
      return;
    }

    setSalvando(true);
    setErroForm(null);
    try {
      const senhaFinal = senhaLimpa || 'demo123';
      await gestaoService.convidarProfessor(email.trim(), nome.trim(), senhaLimpa || undefined);
      toast.success('Professor cadastrado com sucesso!');
      setConviteSucesso({ nome: nome.trim(), email: email.trim(), senha: senhaFinal });
      await carregarDados();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao cadastrar professor.';
      setErroForm(msg);
      toast.error(msg);
    } finally {
      setSalvando(false);
    }
  };

  const handleCopiarAcesso = () => {
    if (!conviteSucesso) return;
    const texto = `Olá, ${conviteSucesso.nome}!\nSeu acesso à plataforma SaberPontual foi criado:\n\nE-mail: ${conviteSucesso.email}\nSenha: ${conviteSucesso.senha}\n\nAcesse pelo link da escola no sistema.`;
    navigator.clipboard.writeText(texto);
    setCopiado(true);
    toast.success('Dados de acesso copiados para a área de transferência!');
    setTimeout(() => setCopiado(false), 3000);
  };

  const abrirModalRedefinir = (prof: Perfil) => {
    setProfessorParaRedefinir(prof);
    setNovaSenha('');
    setMostrarNovaSenha(false);
    setErroRedefinir(null);
    setModalRedefinirAberto(true);
  };

  const handleConfirmarRedefinicao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!professorParaRedefinir) return;
    const senhaLimpa = novaSenha.trim();
    if (!senhaLimpa || senhaLimpa.length < 4) {
      setErroRedefinir('A nova senha deve ter pelo menos 4 caracteres.');
      return;
    }

    setRedefinindo(true);
    setErroRedefinir(null);
    try {
      await gestaoService.redefinirSenhaProfessor(professorParaRedefinir.id, senhaLimpa);
      toast.success(`Senha do professor ${professorParaRedefinir.nome} atualizada com sucesso!`);
      setModalRedefinirAberto(false);
      setProfessorParaRedefinir(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Não foi possível redefinir a senha.';
      setErroRedefinir(msg);
      toast.error(msg);
    } finally {
      setRedefinindo(false);
    }
  };

  const handleConfirmarDesativacao = async () => {
    if (!professorParaDesativar) return;

    setDesativando(true);
    try {
      await gestaoService.desativarProfessor(professorParaDesativar.id);
      toast.success(`Professor ${professorParaDesativar.nome} desativado com sucesso.`);
      setProfessorParaDesativar(null);
      await carregarDados();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Não foi possível desativar o professor.';
      toast.error(msg);
    } finally {
      setDesativando(false);
    }
  };

  const professoresFiltrados = professores.filter((p) => {
    const termo = busca.toLowerCase().trim();
    return p.nome.toLowerCase().includes(termo) || (p.email && p.email.toLowerCase().includes(termo));
  });

  const ehDirecao = usuario?.papel === 'direcao';

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-heading font-black text-slate-800 flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600" />
            Professores
          </h2>
          <p className="text-sm text-slate-500">
            Gerencie o corpo docente da escola e envie convites de acesso à plataforma.
          </p>
        </div>

        <Button onClick={abrirModalConvidar} className="flex items-center gap-2 self-start sm:self-auto">
          <UserPlus className="w-4 h-4" />
          Cadastrar Professor
        </Button>
      </div>

      {erro && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {/* Busca */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar professor por nome ou e-mail..."
          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
        />
      </div>

      {/* Lista de Professores */}
      <Card>
        <CardHeader className="py-4">
          <CardTitle className="text-base text-slate-800">
            Docentes Ativos ({professores.length})
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          {carregando ? (
            <div className="p-8 flex justify-center items-center text-slate-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              <span>Carregando professores...</span>
            </div>
          ) : professoresFiltrados.length === 0 ? (
            <div className="p-8 text-center text-slate-500 space-y-2">
              <Users className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="font-semibold text-slate-600">
                {busca ? 'Nenhum professor encontrado com esse termo.' : 'Nenhum professor cadastrado.'}
              </p>
              {busca && (
                <button
                  onClick={() => setBusca('')}
                  className="text-xs text-indigo-600 font-bold hover:underline"
                >
                  Limpar busca
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {professoresFiltrados.map((prof) => (
                <div
                  key={prof.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
                      {prof.nome
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{prof.nome}</p>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span>{prof.email || 'E-mail não informado'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {ehDirecao && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => abrirModalRedefinir(prof)}
                        className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 flex items-center gap-1.5 text-xs"
                        title="Redefinir senha de acesso do professor"
                      >
                        <Key className="w-4 h-4" />
                        <span>Redefinir Senha</span>
                      </Button>
                    )}

                    {ehDirecao ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setProfessorParaDesativar(prof)}
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 flex items-center gap-1.5 text-xs"
                        title="Desativar professor"
                      >
                        <UserX className="w-4 h-4" />
                        <span>Desativar</span>
                      </Button>
                    ) : (
                      <span className="text-xs text-slate-400 italic">
                        Ações restritas à direção
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Cadastrar Professor */}
      <Modal
        isOpen={modalConvidarAberto}
        onClose={() => !salvando && setModalConvidarAberto(false)}
        title="Cadastrar Novo Professor"
      >
        {conviteSucesso ? (
          <div className="space-y-4 py-2">
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 space-y-3">
              <p className="font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-600" />
                Professor cadastrado com sucesso!
              </p>
              <p className="text-xs">
                O professor <strong>{conviteSucesso.nome}</strong> já pode acessar a plataforma com as credenciais abaixo:
              </p>
              <div className="p-3 bg-white rounded-lg border border-emerald-200 text-xs font-mono space-y-1.5">
                <div>E-mail: <strong>{conviteSucesso.email}</strong></div>
                <div className="flex items-center gap-1.5 text-indigo-700 font-bold">
                  <Key className="w-3.5 h-3.5" />
                  <span>Senha: <strong>{conviteSucesso.senha}</strong></span>
                </div>
              </div>

              <div className="pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopiarAcesso}
                  className="w-full flex items-center justify-center gap-1.5 text-xs bg-white hover:bg-emerald-100/50 border-emerald-300 text-emerald-800 font-semibold"
                >
                  {copiado ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  {copiado ? 'Dados de acesso copiados!' : 'Copiar dados para enviar ao professor'}
                </Button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={() => setModalConvidarAberto(false)}>
                Fechar
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleConvidar} className="space-y-4">
            <Input
              label="Nome Completo do Professor"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Maria Fernandes"
              required
              disabled={salvando}
              autoFocus
            />

            <Input
              label="E-mail Institucional ou Pessoal"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Ex: maria.prof@escola.com"
              required
              disabled={salvando}
            />

            {/* Campo de Senha de Acesso Inicial */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Senha de Acesso Inicial
                </label>
                <button
                  type="button"
                  onClick={() => setSenha(gerarSenhaAleatoria())}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 hover:underline"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Gerar senha automática
                </button>
              </div>

              <Input
                type={mostrarSenha ? 'text' : 'password'}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="Ex: demo123 (ou digite uma senha própria)"
                disabled={salvando}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setMostrarSenha(!mostrarSenha)}
                    className="text-slate-400 hover:text-slate-600 focus:outline-none"
                    title={mostrarSenha ? 'Ocultar senha' : 'Ver senha'}
                  >
                    {mostrarSenha ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                }
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Deixe em branco para usar a senha padrão (<strong>demo123</strong>) ou informe uma senha (mínimo de 4 caracteres).
              </p>
            </div>

            {erroForm && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
                {erroForm}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalConvidarAberto(false)}
                disabled={salvando}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={salvando} className="flex items-center gap-2">
                {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
                {salvando ? 'Cadastrando...' : 'Cadastrar Professor'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal Redefinir Senha do Professor */}
      <Modal
        isOpen={modalRedefinirAberto}
        onClose={() => !redefinindo && setModalRedefinirAberto(false)}
        title={`Redefinir Senha: ${professorParaRedefinir?.nome || ''}`}
      >
        <form onSubmit={handleConfirmarRedefinicao} className="space-y-4">
          <p className="text-xs text-slate-600">
            Defina uma nova senha de acesso para o professor <strong>{professorParaRedefinir?.nome}</strong> ({professorParaRedefinir?.email}).
          </p>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">Nova Senha</label>
              <button
                type="button"
                onClick={() => setNovaSenha(gerarSenhaAleatoria())}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 hover:underline"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Gerar senha automática
              </button>
            </div>

            <Input
              type={mostrarNovaSenha ? 'text' : 'password'}
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              placeholder="Digite a nova senha (mínimo 4 caracteres)"
              required
              disabled={redefinindo}
              rightIcon={
                <button
                  type="button"
                  onClick={() => setMostrarNovaSenha(!mostrarNovaSenha)}
                  className="text-slate-400 hover:text-slate-600 focus:outline-none"
                  title={mostrarNovaSenha ? 'Ocultar senha' : 'Ver senha'}
                >
                  {mostrarNovaSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
            />
          </div>

          {erroRedefinir && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
              {erroRedefinir}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setModalRedefinirAberto(false)}
              disabled={redefinindo}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={redefinindo} className="flex items-center gap-2">
              {redefinindo && <Loader2 className="w-4 h-4 animate-spin" />}
              {redefinindo ? 'Salvando...' : 'Salvar Nova Senha'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Diálogo de Confirmação de Desativação */}
      <ConfirmDialog
        isOpen={!!professorParaDesativar}
        onClose={() => setProfessorParaDesativar(null)}
        onConfirm={handleConfirmarDesativacao}
        title="Desativar Professor"
        message={`Tem certeza que deseja desativar o acesso do professor "${professorParaDesativar?.nome}"? Ele não conseguirá mais entrar na plataforma nem gerenciar suas ofertas e atividades.`}
        confirmText={desativando ? 'Desativando...' : 'Sim, desativar'}
        cancelText="Cancelar"
        variant="danger"
        isLoading={desativando}
      />
    </div>
  );
};
