import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '../AuthProvider';
import { Modal, Input, Button, useToast } from '@/components/ui';
import { KeyRound, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';

const alterarSenhaSchema = z
  .object({
    senhaAtual: z.string().min(1, 'Informe sua senha atual.'),
    novaSenha: z.string().min(6, 'A nova senha deve ter no mínimo 6 caracteres.'),
    confirmarSenha: z.string().min(1, 'Confirme a nova senha.'),
  })
  .refine((data) => data.novaSenha === data.confirmarSenha, {
    message: 'A confirmação de senha não confere.',
    path: ['confirmarSenha'],
  })
  .refine((data) => data.senhaAtual !== data.novaSenha, {
    message: 'A nova senha não pode ser igual à senha atual.',
    path: ['novaSenha'],
  });

type AlterarSenhaFormData = z.infer<typeof alterarSenhaSchema>;

export interface ModalAlterarSenhaProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ModalAlterarSenha: React.FC<ModalAlterarSenhaProps> = ({ isOpen, onClose }) => {
  const { alterarSenha, usuario } = useAuth();
  const toast = useToast();

  const [mostrarSenhaAtual, setMostrarSenhaAtual] = useState(false);
  const [mostrarNovaSenha, setMostrarNovaSenha] = useState(false);
  const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false);
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AlterarSenhaFormData>({
    resolver: zodResolver(alterarSenhaSchema),
    defaultValues: {
      senhaAtual: '',
      novaSenha: '',
      confirmarSenha: '',
    },
  });

  const handleFechar = () => {
    reset();
    setErroGeral(null);
    setMostrarSenhaAtual(false);
    setMostrarNovaSenha(false);
    setMostrarConfirmarSenha(false);
    onClose();
  };

  const onSubmit = async (data: AlterarSenhaFormData) => {
    setErroGeral(null);
    try {
      await alterarSenha(data.senhaAtual, data.novaSenha);
      toast.success('Sua senha foi alterada com sucesso!', 'Senha Atualizada');
      handleFechar();
    } catch (err) {
      if (err instanceof Error) {
        setErroGeral(err.message);
      } else {
        setErroGeral('Ocorreu um erro ao tentar alterar a senha. Tente novamente.');
      }
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleFechar}
      title={
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <span>Alterar Senha</span>
          </div>
        </div>
      }
      description={`Atualize sua senha de acesso ao portal (${usuario?.email || 'usuário conectado'}).`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-1">
        {erroGeral && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="leading-snug">{erroGeral}</span>
          </div>
        )}

        {/* Senha Atual */}
        <div>
          <Input
            label="Senha atual"
            type={mostrarSenhaAtual ? 'text' : 'password'}
            placeholder="Digite sua senha atual"
            leftIcon={<Lock className="w-4 h-4" />}
            rightIcon={
              <button
                type="button"
                onClick={() => setMostrarSenhaAtual((prev) => !prev)}
                className="p-1 hover:text-slate-600 transition-colors focus:outline-none cursor-pointer"
                title={mostrarSenhaAtual ? 'Ocultar senha' : 'Exibir senha'}
                aria-label={mostrarSenhaAtual ? 'Ocultar senha' : 'Exibir senha'}
              >
                {mostrarSenhaAtual ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
            error={errors.senhaAtual?.message}
            disabled={isSubmitting}
            {...register('senhaAtual')}
          />
        </div>

        {/* Nova Senha */}
        <div>
          <Input
            label="Nova senha"
            type={mostrarNovaSenha ? 'text' : 'password'}
            placeholder="Mínimo de 6 caracteres"
            helperText="A nova senha deve ter no mínimo 6 caracteres e ser diferente da atual."
            leftIcon={<KeyRound className="w-4 h-4" />}
            rightIcon={
              <button
                type="button"
                onClick={() => setMostrarNovaSenha((prev) => !prev)}
                className="p-1 hover:text-slate-600 transition-colors focus:outline-none cursor-pointer"
                title={mostrarNovaSenha ? 'Ocultar senha' : 'Exibir senha'}
                aria-label={mostrarNovaSenha ? 'Ocultar senha' : 'Exibir senha'}
              >
                {mostrarNovaSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
            error={errors.novaSenha?.message}
            disabled={isSubmitting}
            {...register('novaSenha')}
          />
        </div>

        {/* Confirmação da Nova Senha */}
        <div>
          <Input
            label="Confirmar nova senha"
            type={mostrarConfirmarSenha ? 'text' : 'password'}
            placeholder="Digite novamente a nova senha"
            leftIcon={<Lock className="w-4 h-4" />}
            rightIcon={
              <button
                type="button"
                onClick={() => setMostrarConfirmarSenha((prev) => !prev)}
                className="p-1 hover:text-slate-600 transition-colors focus:outline-none cursor-pointer"
                title={mostrarConfirmarSenha ? 'Ocultar senha' : 'Exibir senha'}
                aria-label={mostrarConfirmarSenha ? 'Ocultar senha' : 'Exibir senha'}
              >
                {mostrarConfirmarSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            }
            error={errors.confirmarSenha?.message}
            disabled={isSubmitting}
            {...register('confirmarSenha')}
          />
        </div>

        {/* Botões de Ação */}
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
          <Button
            type="button"
            variant="ghost"
            onClick={handleFechar}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>

          <Button
            type="submit"
            variant="primary"
            isLoading={isSubmitting}
            leftIcon={<KeyRound className="w-4 h-4" />}
          >
            Salvar Nova Senha
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default ModalAlterarSenha;
