import React, { useEffect, useState } from 'react';
import { Download, Trash2, ShieldCheck, Loader2 } from 'lucide-react';
import { Modal, Button, Input, useToast } from '@/components/ui';
import { gestaoService, AlunoPublico } from '@/services';

interface ModalDadosAlunoProps {
  aluno: AlunoPublico | null;
  /** Só a direção apaga (a coordenação só exporta). */
  podeApagar: boolean;
  onFechar: () => void;
  onApagado: () => void;
}

/** Nome de arquivo sem acento nem espaço: dados-aluno-maria-souza-2026-10-27.json */
export function nomeArquivoExportacao(nome: string, data = new Date()): string {
  const slug = nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `dados-aluno-${slug || 'sem-nome'}-${data.toISOString().slice(0, 10)}.json`;
}

/**
 * Pedidos do titular pela LGPD (art. 18): baixar todos os dados do aluno e apagá-los de vez.
 * A escola é a controladora; a direção atende o pedido aqui.
 */
export const ModalDadosAluno: React.FC<ModalDadosAlunoProps> = ({ aluno, podeApagar, onFechar, onApagado }) => {
  const toast = useToast();
  const [exportando, setExportando] = useState(false);
  const [confirmacao, setConfirmacao] = useState('');
  const [apagando, setApagando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setConfirmacao('');
    setErro(null);
  }, [aluno?.id]);

  if (!aluno) return null;
  const nomeConfere = confirmacao.trim().toLowerCase() === aluno.nome_completo.trim().toLowerCase();

  const exportar = async () => {
    setExportando(true);
    setErro(null);
    try {
      const dados = await gestaoService.exportarDadosAluno(aluno.id);
      const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = nomeArquivoExportacao(aluno.nome_completo);
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Arquivo com os dados do aluno baixado.');
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Não foi possível exportar os dados.');
    } finally {
      setExportando(false);
    }
  };

  const apagar = async () => {
    if (!nomeConfere) return;
    setApagando(true);
    setErro(null);
    try {
      const r = await gestaoService.apagarDadosAluno(aluno.id, confirmacao);
      toast.success(
        `Dados de ${aluno.nome_completo} apagados (${r.respostas} resposta(s) e ${r.observacoes} observação(ões)).`
      );
      onApagado();
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Não foi possível apagar os dados.');
    } finally {
      setApagando(false);
    }
  };

  const ocupado = exportando || apagando;

  return (
    <Modal isOpen onClose={() => !ocupado && onFechar()} title="Dados do aluno (LGPD)" maxWidth="lg">
      <div className="space-y-5 text-sm text-slate-700">
        <p>
          Use quando o responsável pedir para ver ou apagar os dados de{' '}
          <strong className="text-slate-900">{aluno.nome_completo}</strong>. Cada pedido fica registrado.
        </p>

        <section className="p-4 rounded-xl border border-slate-200 space-y-2">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            Baixar os dados
          </h3>
          <p className="text-xs text-slate-500">
            Arquivo com o cadastro, a turma, as respostas, as notas e as observações dos professores. Não leva o
            PIN nem o gabarito.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={exportar}
            disabled={ocupado}
            className="flex items-center gap-1.5"
          >
            {exportando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            {exportando ? 'Preparando...' : 'Baixar arquivo (.json)'}
          </Button>
        </section>

        {podeApagar ? (
          <section className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 space-y-2">
            <h3 className="font-semibold text-rose-800 flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              Apagar de vez
            </h3>
            <p className="text-xs text-rose-800">
              Apaga o aluno, o PIN, as respostas e as observações. As médias da turma mudam. <strong>Não tem
              volta.</strong> Baixe o arquivo antes, se a família quiser uma cópia. Para só tirar o aluno da turma,
              use "Editar" e marque como inativo.
            </p>
            <Input
              label={`Digite o nome completo para confirmar: ${aluno.nome_completo}`}
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              disabled={ocupado}
              autoComplete="off"
            />
            <Button
              variant="danger"
              size="sm"
              onClick={apagar}
              disabled={!nomeConfere || ocupado}
              className="flex items-center gap-1.5"
            >
              {apagando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              {apagando ? 'Apagando...' : 'Apagar todos os dados'}
            </Button>
          </section>
        ) : (
          <p className="text-xs text-slate-500">Apagar os dados de um aluno é só com a direção.</p>
        )}

        {erro && (
          <p role="alert" className="text-sm text-rose-700">
            {erro}
          </p>
        )}
      </div>
    </Modal>
  );
};

export default ModalDadosAluno;
