/**
 * SaberPontual — Cache de poucos segundos para leituras repetidas dos serviços Supabase
 *
 * Cada método dos serviços confere o perfil do usuário e a oferta antes de agir. Uma tela como o
 * painel do professor chama dezenas de métodos de uma vez, e sem cache isso virava centenas de
 * leituras idênticas (395 requisições e 27 s no painel da Profª Ana).
 *
 * - Chamadas simultâneas para a mesma chave compartilham uma única consulta.
 * - O resultado vale por `ttlMs`; depois disso é lido de novo.
 * - ERRO nunca fica guardado: a próxima chamada tenta de novo.
 *
 * Isto só poupa a conferência feita no cliente. A segurança de verdade é a RLS do banco, que
 * continua valendo em toda leitura e gravação.
 */
export class CacheCurto<T> {
  private readonly itens = new Map<string, { expira: number; valor: Promise<T> }>();

  constructor(
    private readonly ttlMs: number,
    private readonly agora: () => number = Date.now
  ) {}

  obter(chave: string, carregar: () => Promise<T>): Promise<T> {
    const agora = this.agora();
    const existente = this.itens.get(chave);
    if (existente && existente.expira > agora) return existente.valor;

    if (this.itens.size >= 200) {
      for (const [k, v] of this.itens) {
        if (v.expira <= agora) this.itens.delete(k);
      }
    }

    const valor: Promise<T> = carregar().catch((erro) => {
      if (this.itens.get(chave)?.valor === valor) this.itens.delete(chave);
      throw erro;
    });
    this.itens.set(chave, { expira: agora + this.ttlMs, valor });
    return valor;
  }

  limpar(): void {
    this.itens.clear();
  }
}
