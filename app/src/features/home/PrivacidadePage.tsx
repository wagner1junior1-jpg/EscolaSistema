import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PRIVACIDADE } from '@/lib/privacidade';

const Secao: React.FC<{ titulo: string; children: React.ReactNode }> = ({ titulo, children }) => (
  <section className="space-y-2">
    <h2 className="font-heading font-bold text-lg text-slate-900">{titulo}</h2>
    <div className="space-y-2 text-slate-700 leading-relaxed">{children}</div>
  </section>
);

/** Política de privacidade (LGPD), em linguagem simples, aberta a qualquer pessoa. */
export const PrivacidadePage: React.FC = () => {
  const { operador, email, diasAposContrato, diasResposta, atualizadaEm } = PRIVACIDADE;
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <main className="max-w-3xl mx-auto bg-white rounded-2xl border border-slate-200 p-5 sm:p-8 space-y-6 text-sm sm:text-base">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-700 hover:text-indigo-900">
          <ArrowLeft className="w-4 h-4" />
          Voltar ao início
        </Link>

        <header className="space-y-1">
          <h1 className="font-heading font-black text-2xl text-slate-900">Política de privacidade do SaberPontual</h1>
          <p className="text-xs text-slate-500">Atualizada em {atualizadaEm}.</p>
        </header>

        <Secao titulo="1. Quem cuida dos dados">
          <p>
            O SaberPontual é um sistema de atividades e acompanhamento escolar usado pela escola. A <strong>escola</strong>{' '}
            decide como os dados dos alunos e da equipe são usados (é a <em>controladora</em>, pela Lei Geral de
            Proteção de Dados, LGPD). O sistema é operado por {operador}, que trata os dados só para a escola e
            seguindo as instruções dela (é o <em>operador</em>).
          </p>
          <p>
            Contato para assuntos de privacidade: <a className="text-indigo-700 underline" href={`mailto:${email}`}>{email}</a>.
            Pedidos também podem ser feitos na secretaria da escola.
          </p>
        </Secao>

        <Secao titulo="2. Quais dados o sistema guarda">
          <p><strong>Dos alunos:</strong> nome completo, número de chamada, turma, PIN de acesso (guardado
            embaralhado, de um jeito que ninguém consegue ler, nem a escola), respostas às atividades, notas,
            comentários e observações dos professores, e registros de entrada no sistema.</p>
          <p><strong>Da equipe da escola:</strong> nome, e-mail, função (direção, coordenação ou professor), senha
            (também guardada embaralhada) e registros de uso da geração de questões por IA.</p>
          <p><strong>O que o sistema não pede:</strong> CPF, endereço, telefone, foto, data de nascimento,
            dados de saúde, localização nem contato dos pais.</p>
        </Secao>

        <Secao titulo="3. Para que os dados são usados">
          <p>Só para fins pedagógicos: o aluno fazer as atividades, o professor corrigir e acompanhar, e a escola ver
            relatórios de desempenho. Os dados <strong>não</strong> são vendidos, não são usados para propaganda e
            não servem para montar perfis comerciais.</p>
          <p>A inteligência artificial do sistema ajuda o professor a criar questões. Ela <strong>não</strong> avalia
            nem toma decisões sobre os alunos.</p>
        </Secao>

        <Secao titulo="4. Crianças e adolescentes">
          <p>Os dados dos alunos são tratados no melhor interesse deles (LGPD, art. 14): o sistema guarda o mínimo
            necessário, o aluno entra com o código da turma e um PIN, e só a equipe da própria escola vê os dados.
            Cada professor vê apenas as turmas em que dá aula.</p>
          <p>A escola informa as famílias e colhe a autorização de um dos pais ou responsável quando a lei exigir.</p>
        </Secao>

        <Secao titulo="5. Com quem os dados são compartilhados">
          <p>Com ninguém para fins próprios. Para funcionar, o sistema usa estes serviços:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Supabase</strong>: banco de dados e login (servidores da Amazon Web Services; na versão de
              produção, na região de São Paulo).</li>
            <li><strong>Vercel</strong>: entrega as telas do site. Não guarda os dados dos alunos.</li>
            <li><strong>Google (Gemini)</strong>: gera questões. Recebe só o material que o professor envia (tema,
              texto de apoio e fotos de material didático), <strong>nunca</strong> nomes, notas ou respostas dos
              alunos. Esse serviço pode funcionar fora do Brasil.</li>
          </ul>
          <p>Os dados também podem ser entregues a autoridades quando a lei obrigar.</p>
        </Secao>

        <Secao titulo="6. O que fica guardado no aparelho">
          <p>Para manter a pessoa conectada, o navegador guarda o acesso da sessão (a do aluno vale por até 30 dias
            ou até ele tocar em "Sair"), a preferência de som e o avatar escolhido pelo aluno. O sistema não usa
            cookies de propaganda nem ferramentas de rastreamento.</p>
          <p>Em computador compartilhado, toque sempre em "Sair" no fim do uso.</p>
        </Secao>

        <Secao titulo="7. Por quanto tempo">
          <p>Enquanto a escola usar o sistema. Se a escola encerrar o contrato, ela recebe uma cópia dos dados e tudo
            é apagado em até {diasAposContrato} dias. A pedido do responsável, a escola pode apagar antes os dados de
            um aluno. As cópias de segurança automáticas são substituídas em poucos dias.</p>
        </Secao>

        <Secao titulo="8. Como os dados são protegidos">
          <ul className="list-disc pl-5 space-y-1">
            <li>Conexão sempre criptografada (HTTPS).</li>
            <li>Cada pessoa vê só o que a sua função permite, com a regra aplicada no próprio banco de dados.</li>
            <li>PINs e senhas guardados embaralhados; bloqueio depois de tentativas erradas.</li>
            <li>A chave da inteligência artificial fica só no servidor.</li>
            <li>Toda exportação e exclusão de dados de aluno fica registrada.</li>
          </ul>
        </Secao>

        <Secao titulo="9. Seus direitos">
          <p>O aluno e o seu responsável podem pedir, a qualquer momento: confirmar se há dados guardados, ver os
            dados, corrigir o que estiver errado, receber uma cópia, apagar os dados, saber com quem foram
            compartilhados e retirar uma autorização dada antes (LGPD, art. 18).</p>
          <p>Faça o pedido na secretaria da escola ou pelo e-mail{' '}
            <a className="text-indigo-700 underline" href={`mailto:${email}`}>{email}</a>. A resposta vem em até{' '}
            {diasResposta} dias. Também é possível reclamar à Autoridade Nacional de Proteção de Dados (ANPD).</p>
        </Secao>

        <Secao titulo="10. Se algo der errado">
          <p>Se houver um incidente de segurança que possa trazer risco aos alunos ou à equipe, a escola é avisada
            sem demora e, junto com ela, as famílias e a ANPD, como manda a lei.</p>
        </Secao>

        <Secao titulo="11. Mudanças nesta política">
          <p>Esta página mostra sempre a versão em vigor e a data da última atualização. Mudanças importantes são
            avisadas à escola antes de valer.</p>
        </Secao>
      </main>
    </div>
  );
};

export default PrivacidadePage;
