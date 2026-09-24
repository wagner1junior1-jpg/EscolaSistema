import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, useToast } from '@/components/ui';
import { gestaoService } from '@/services';
import { Building2, Save, Loader2, AlertCircle } from 'lucide-react';

export const GestaoEscolaSecao: React.FC = () => {
  const toast = useToast();
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Campos do formulário
  const [nome, setNome] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [anoLetivo, setAnoLetivo] = useState<number>(2026);

  useEffect(() => {
    let montado = true;
    async function carregar() {
      setCarregando(true);
      setErro(null);
      try {
        const esc = await gestaoService.obterEscola();
        if (montado) {
          setNome(esc.nome);
          if (esc.cidade_uf) {
            const partes = esc.cidade_uf.split('-');
            if (partes.length > 1) {
              setCidade(partes[0].trim());
              setEstado(partes[1].trim().toUpperCase().slice(0, 2));
            } else {
              setCidade(esc.cidade_uf.trim());
              setEstado('');
            }
          }
          setAnoLetivo(esc.ano_letivo_atual);
        }
      } catch (err: unknown) {
        if (montado) {
          setErro(err instanceof Error ? err.message : 'Falha ao obter dados da escola.');
        }
      } finally {
        if (montado) setCarregando(false);
      }
    }
    carregar();
    return () => {
      montado = false;
    };
  }, []);

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error('O nome da escola não pode ficar vazio.');
      return;
    }
    if (!cidade.trim() || !estado.trim()) {
      toast.error('Cidade e Estado (UF) são obrigatórios.');
      return;
    }
    if (!anoLetivo || anoLetivo < 2000) {
      toast.error('Ano letivo inválido.');
      return;
    }

    setSalvando(true);
    try {
      await gestaoService.atualizarEscola({
        nome: nome.trim(),
        cidade_uf: `${cidade.trim()} - ${estado.trim().toUpperCase()}`,
        ano_letivo_atual: Number(anoLetivo),
      });

      toast.success('Dados da escola atualizados com sucesso!');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar dados da escola.');
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <p className="text-sm font-medium">Carregando dados da instituição...</p>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-center gap-3">
        <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
        <p className="text-sm font-medium">{erro}</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="font-heading font-black text-xl sm:text-2xl text-slate-900 tracking-tight">
          Configurações da Instituição
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Apenas a direção escolar pode atualizar os dados oficiais da escola.
        </p>
      </div>

      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base">Dados Cadastrais</CardTitle>
              <p className="text-xs text-slate-500">
                Informações exibidas nos cabeçalhos e nas filipetas de acesso dos alunos.
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-5">
          <form onSubmit={handleSalvar} className="space-y-4">
            <Input
              label="Nome da Escola / Instituição *"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Escola Estadual Professor Silva"
              disabled={salvando}
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <Input
                  label="Cidade *"
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  placeholder="Ex: São Paulo"
                  disabled={salvando}
                  required
                />
              </div>

              <div>
                <Input
                  label="UF (Estado) *"
                  value={estado}
                  onChange={(e) => setEstado(e.target.value.toUpperCase().slice(0, 2))}
                  placeholder="SP"
                  maxLength={2}
                  disabled={salvando}
                  required
                />
              </div>
            </div>

            <Input
              label="Ano Letivo Corrente *"
              type="number"
              value={anoLetivo}
              onChange={(e) => setAnoLetivo(parseInt(e.target.value, 10) || 2026)}
              disabled={salvando}
              helperText="Ano de referência para turmas e bimestres."
              required
            />

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <Button
                type="submit"
                variant="primary"
                isLoading={salvando}
                leftIcon={<Save className="w-4 h-4" />}
              >
                Salvar alterações
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
