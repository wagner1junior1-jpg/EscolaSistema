// Main Application Coordinator & Modals Manager for Sistema de Questões Escolar

class App {
  constructor() {
    this.currentMode = "aluno"; // "aluno" or "professora"
    this.modalContainer = null;
  }

  init() {
    this.modalContainer = document.getElementById("modal-root");

    // Check if mode was saved or default to aluno
    const savedMode = localStorage.getItem("sistema_escolar_mode");
    if (savedMode && (savedMode === "aluno" || savedMode === "professora" || savedMode === "coordenacao")) {
      this.currentMode = savedMode;
    }

    this.bindGlobalEvents();
    this.applyMode();

    // Subscribe to storage changes to keep controllers updated
    window.schoolStorage.subscribe(() => {
      if (this.currentMode === "aluno") {
        window.studentController.render();
      } else if (this.currentMode === "professora") {
        window.teacherController.render();
      } else if (this.currentMode === "coordenacao") {
        window.managementController.render();
      }
    });
  }

  setMode(mode) {
    this.currentMode = mode;
    localStorage.setItem("sistema_escolar_mode", mode);
    this.applyMode();
  }

  applyMode() {
    const studentContainer = document.getElementById("student-view-container");
    const teacherContainer = document.getElementById("teacher-view-container");
    const managementContainer = document.getElementById("management-view-container");
    const btnNavAluno = document.getElementById("btn-nav-aluno");
    const btnNavProfessora = document.getElementById("btn-nav-professora");
    const btnNavCoordenacao = document.getElementById("btn-nav-coordenacao");

    // Hide all containers first
    studentContainer?.classList.add("hidden");
    teacherContainer?.classList.add("hidden");
    managementContainer?.classList.add("hidden");

    // Reset button styles
    [btnNavAluno, btnNavProfessora, btnNavCoordenacao].forEach(btn => {
      if (btn) {
        btn.classList.remove("bg-indigo-600", "text-white", "shadow-sm");
        btn.classList.add("text-slate-600", "hover:bg-slate-200/60");
      }
    });

    if (this.currentMode === "aluno") {
      studentContainer?.classList.remove("hidden");
      if (btnNavAluno) {
        btnNavAluno.classList.add("bg-indigo-600", "text-white", "shadow-sm");
        btnNavAluno.classList.remove("text-slate-600", "hover:bg-slate-200/60");
      }
      window.studentController.init();
    } else if (this.currentMode === "professora") {
      teacherContainer?.classList.remove("hidden");
      if (btnNavProfessora) {
        btnNavProfessora.classList.add("bg-indigo-600", "text-white", "shadow-sm");
        btnNavProfessora.classList.remove("text-slate-600", "hover:bg-slate-200/60");
      }
      window.teacherController.init();
    } else if (this.currentMode === "coordenacao") {
      managementContainer?.classList.remove("hidden");
      if (btnNavCoordenacao) {
        btnNavCoordenacao.classList.add("bg-indigo-600", "text-white", "shadow-sm");
        btnNavCoordenacao.classList.remove("text-slate-600", "hover:bg-slate-200/60");
      }
      window.managementController.init();
    }
  }

  bindGlobalEvents() {
    const btnNavAluno = document.getElementById("btn-nav-aluno");
    const btnNavProfessora = document.getElementById("btn-nav-professora");
    const btnNavCoordenacao = document.getElementById("btn-nav-coordenacao");
    const btnRoteiroDiretora = document.getElementById("btn-nav-roteiro");
    const btnResetDemo = document.getElementById("btn-reset-demo");

    if (btnNavAluno) {
      btnNavAluno.addEventListener("click", () => this.setMode("aluno"));
    }
    if (btnNavProfessora) {
      btnNavProfessora.addEventListener("click", () => this.setMode("professora"));
    }
    if (btnNavCoordenacao) {
      btnNavCoordenacao.addEventListener("click", () => this.setMode("coordenacao"));
    }
    if (btnRoteiroDiretora) {
      btnRoteiroDiretora.addEventListener("click", () => this.openModalRoteiroDiretora());
    }
    if (btnResetDemo) {
      btnResetDemo.addEventListener("click", () => {
        if (confirm("Deseja restaurar os dados originais de demonstração para a apresentação? Todas as alterações de teste serão resetadas.")) {
          window.schoolStorage.resetToDemo();
          this.showToast("Dados de demonstração restaurados com sucesso!", "success");
          setTimeout(() => location.reload(), 400);
        }
      });
    }
  }

  showToast(message, type = "info") {
    const toastArea = document.getElementById("toast-area");
    if (!toastArea) return;

    const toast = document.createElement("div");
    const colors = {
      success: "bg-emerald-600 text-white",
      error: "bg-rose-600 text-white",
      warning: "bg-amber-500 text-white",
      info: "bg-slate-800 text-white"
    };

    const icons = {
      success: "fa-check-circle",
      error: "fa-exclamation-circle",
      warning: "fa-exclamation-triangle",
      info: "fa-info-circle"
    };

    toast.className = `flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl text-xs font-semibold ${colors[type] || colors.info} transform transition-all duration-300 translate-y-4 opacity-0 pointer-events-auto`;
    toast.innerHTML = `
      <i class="fas ${icons[type] || icons.info} text-sm"></i>
      <span>${message}</span>
    `;

    toastArea.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.remove("translate-y-4", "opacity-0");
    });

    setTimeout(() => {
      toast.classList.add("translate-y-4", "opacity-0");
      setTimeout(() => toast.remove(), 300);
    }, 3800);
  }

  // --- MODALS SYSTEM ---
  openModal(htmlContent) {
    if (!this.modalContainer) return;
    this.modalContainer.innerHTML = `
      <div class="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="relative bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100 animate-fadeIn" id="modal-box">
          <button id="btn-close-modal" class="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors">
            <i class="fas fa-times text-xs"></i>
          </button>
          ${htmlContent}
        </div>
      </div>
    `;

    document.getElementById("btn-close-modal")?.addEventListener("click", () => this.closeModal());
  }

  closeModal() {
    if (this.modalContainer) {
      this.modalContainer.innerHTML = "";
    }
  }

  // Modal 1: Roteiro de Bolso para o Bate-papo com a Diretora
  openModalRoteiroDiretora() {
    this.openModal(`
      <div>
        <div class="flex items-center gap-3 mb-4">
          <div class="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center text-xl shadow-md shadow-amber-200">
            🤝
          </div>
          <div>
            <h2 class="text-lg font-bold text-slate-800">Roteiro de Bolso com a Diretoria</h2>
            <p class="text-xs text-slate-500">Argumentos-chave para a parceria piloto sem custos</p>
          </div>
        </div>

        <div class="space-y-3.5 text-xs text-slate-700 max-h-[460px] overflow-y-auto pr-1">
          <div class="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100">
            <strong class="text-indigo-900 block font-bold mb-1">1. Apresentação da Proposta:</strong>
            <p class="italic text-slate-700">
              "Estou estruturando uma plataforma de apoio escolar focada em exercícios rápidos para o celular dos alunos, e gostaria de fazer uma parceria piloto com a sua escola, sem custo nenhum."
            </p>
          </div>

          <div class="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
            <strong class="text-slate-900 block font-bold mb-1">2. Diferencial de Acesso (Zero Fricção):</strong>
            <p class="italic text-slate-700">
              "Pensamos em algo que não dá trabalho para os pais nem para a escola: os alunos não precisam de e-mail. Eles só entram com o código da turma e um PIN de 4 números."
            </p>
          </div>

          <div class="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100">
            <strong class="text-emerald-900 block font-bold mb-1">3. Alívio Imediato para a Professora:</strong>
            <p class="italic text-slate-700">
              "A professora não leva folhas de papel para corrigir em casa. A plataforma corrige na hora e gera um gráfico mostrando se a turma inteira teve dúvida na mesma matéria."
            </p>
          </div>

          <div class="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200">
            <strong class="text-amber-950 block font-bold mb-1">4. O Próximo Passo Combinado:</strong>
            <p class="italic text-slate-700">
              "Podemos escolher uma turma de uma professora parceira (ex: 6º ou 7º ano) para testarmos durante 2 semanas. Se der certo, expandimos; se não fizer sentido, a escola não teve gasto algum."
            </p>
          </div>
        </div>

        <div class="mt-5 pt-4 border-t border-slate-100 flex justify-end">
          <button onclick="window.app.closeModal()" class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-100">
            Entendido! Fechar
          </button>
        </div>
      </div>
    `);
  }

  // Modal 2: Nova Turma
  openModalNovaTurma() {
    const series = window.DEFAULT_DATA.seriesDisponiveis;
    const disciplinas = window.DEFAULT_DATA.disciplinas;

    this.openModal(`
      <div>
        <h2 class="text-lg font-bold text-slate-800 mb-1">Cadastrar Nova Turma</h2>
        <p class="text-xs text-slate-500 mb-5">Organize as turmas por série para reaproveitar conteúdos.</p>

        <form id="form-nova-turma" class="space-y-4 text-xs">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Nome da Turma *</label>
            <input type="text" id="turma-nome" placeholder="Ex: 7º Ano C" required class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-600 focus:bg-white focus:outline-none" />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Série / Ano *</label>
              <select id="turma-serie" required class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-600 focus:bg-white focus:outline-none">
                ${series.map(g => `
                  <optgroup label="${g.grupo}">
                    ${g.anos.map(a => `<option value="${a}">${a}</option>`).join("")}
                  </optgroup>
                `).join("")}
              </select>
            </div>

            <div>
              <label class="block font-semibold text-slate-700 mb-1">Disciplina *</label>
              <select id="turma-disciplina" required class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-600 focus:bg-white focus:outline-none">
                ${disciplinas.map(d => `<option value="${d}">${d}</option>`).join("")}
              </select>
            </div>
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">Nome do(a) Professor(a) *</label>
            <input type="text" id="turma-prof" placeholder="Ex: Profª Juliana Costa" required class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-600 focus:bg-white focus:outline-none" />
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">Código de Acesso Personalizado (Opcional)</label>
            <input type="text" id="turma-codigo" placeholder="Deixe em branco para gerar automático (Ex: MAT7C)" maxlength="8" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-600 focus:bg-white focus:outline-none uppercase font-mono" />
          </div>

          <div class="pt-3 flex justify-end gap-2">
            <button type="button" onclick="window.app.closeModal()" class="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50">
              Cancelar
            </button>
            <button type="submit" class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-100">
              Criar Turma
            </button>
          </div>
        </form>
      </div>
    `);

    document.getElementById("form-nova-turma")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const nome = document.getElementById("turma-nome").value;
      const serie_ano = document.getElementById("turma-serie").value;
      const disciplina = document.getElementById("turma-disciplina").value;
      const professor_nome = document.getElementById("turma-prof").value;
      const codigo_acesso = document.getElementById("turma-codigo").value;

      window.teacherController.handleCreateTurma({
        nome,
        serie_ano,
        disciplina,
        professor_nome,
        codigo_acesso
      });
      this.closeModal();
    });
  }

  // Modal 3: Novo Aluno Individual
  openModalNovoAluno(turmaId) {
    this.openModal(`
      <div>
        <h2 class="text-lg font-bold text-slate-800 mb-1">Cadastrar Aluno</h2>
        <p class="text-xs text-slate-500 mb-4">Um PIN de 4 números exclusivo será gerado automaticamente.</p>

        <form id="form-novo-aluno" class="space-y-4 text-xs">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Nome Completo do Aluno *</label>
            <input type="text" id="aluno-nome" placeholder="Ex: Gabriel Santos Silva" required autofocus class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-600 focus:bg-white focus:outline-none" />
          </div>

          <div class="pt-3 flex justify-end gap-2">
            <button type="button" onclick="window.app.closeModal()" class="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50">
              Cancelar
            </button>
            <button type="submit" class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-100">
              Cadastrar Aluno
            </button>
          </div>
        </form>
      </div>
    `);

    document.getElementById("form-novo-aluno")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const nome = document.getElementById("aluno-nome").value;
      window.teacherController.handleCreateAluno(turmaId, nome);
      this.closeModal();
    });
  }

  // Modal 4: Importar Lista de Chamada em Lote
  openModalBatchAlunos(turmaId) {
    this.openModal(`
      <div>
        <h2 class="text-lg font-bold text-slate-800 mb-1">Importar Lista de Chamada</h2>
        <p class="text-xs text-slate-500 mb-4">Cole a lista com os nomes dos alunos (um por linha). O sistema gerará os PINs de 4 números para todos!</p>

        <form id="form-batch-alunos" class="space-y-4 text-xs">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Nomes dos Alunos (um por linha):</label>
            <textarea id="batch-nomes" rows="7" placeholder="Exemplo:&#10;01. Amanda Costa&#10;02. Bruno Carvalho&#10;03. Daniel Pereira" required class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-600 focus:bg-white focus:outline-none font-sans text-xs"></textarea>
          </div>

          <div class="pt-2 flex justify-end gap-2">
            <button type="button" onclick="window.app.closeModal()" class="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50">
              Cancelar
            </button>
            <button type="submit" class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-100">
              Gerar PINs e Salvar Todos
            </button>
          </div>
        </form>
      </div>
    `);

    document.getElementById("form-batch-alunos")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = document.getElementById("batch-nomes").value;
      window.teacherController.handleBatchImportAlunos(turmaId, text);
      this.closeModal();
    });
  }

  // Modal 5: Nova Atividade
  openModalNovaAtividade(turmaId) {
    this.openModal(`
      <div>
        <h2 class="text-lg font-bold text-slate-800 mb-1">Criar Lista de Exercícios</h2>
        <p class="text-xs text-slate-500 mb-4">Defina o tema e o prazo para os alunos responderem.</p>

        <form id="form-nova-ativ" class="space-y-4 text-xs">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Título da Atividade *</label>
            <input type="text" id="ativ-titulo" placeholder="Ex: Frações e Decimais - Lista 1" required class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-600 focus:bg-white focus:outline-none" />
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">Orientação / Descrição Rápida</label>
            <textarea id="ativ-descricao" rows="2" placeholder="Ex: Resolva com atenção aos sinais..." class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-600 focus:bg-white focus:outline-none"></textarea>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Prazo de Entrega (Opcional)</label>
              <input type="date" id="ativ-prazo" class="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-600 focus:bg-white focus:outline-none" />
            </div>
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Status Imediato</label>
              <select id="ativ-ativa" class="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-600 focus:bg-white focus:outline-none">
                <option value="true">Ativa para os Alunos</option>
                <option value="false">Rascunho (Oculta)</option>
              </select>
            </div>
          </div>

          <div class="pt-3 flex justify-end gap-2">
            <button type="button" onclick="window.app.closeModal()" class="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50">
              Cancelar
            </button>
            <button type="submit" class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-100">
              Salvar Atividade
            </button>
          </div>
        </form>
      </div>
    `);

    document.getElementById("form-nova-ativ")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const titulo = document.getElementById("ativ-titulo").value;
      const descricao = document.getElementById("ativ-descricao").value;
      const prazo_entrega = document.getElementById("ativ-prazo").value;
      const ativa = document.getElementById("ativ-ativa").value === "true";

      window.teacherController.handleCreateAtividade({
        turma_id: turmaId,
        titulo,
        descricao,
        prazo_entrega,
        ativa
      });
      this.closeModal();
    });
  }

  // Modal 6: Duplicar Atividade para Outra Turma (1 Clique)
  openModalDuplicateAtividade(atividadeId) {
    const ativ = window.schoolStorage.getAtividadeById(atividadeId);
    if (!ativ) return;
    const turmas = window.schoolStorage.getTurmas();

    this.openModal(`
      <div>
        <h2 class="text-lg font-bold text-slate-800 mb-1">Replicar Atividade</h2>
        <p class="text-xs text-slate-500 mb-4">Copie <strong>"${ativ.titulo}"</strong> e todas as suas questões para outra turma em 1 clique.</p>

        <form id="form-duplicate-ativ" class="space-y-4 text-xs">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Escolha a Turma de Destino:</label>
            <select id="dest-turma-id" required class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-600 focus:bg-white focus:outline-none">
              ${turmas.map(t => `
                <option value="${t.id}" ${t.id === ativ.turma_id ? 'disabled' : ''}>
                  ${t.nome} - ${t.disciplina} (${t.serie_ano}) ${t.id === ativ.turma_id ? '(Atual)' : ''}
                </option>
              `).join("")}
            </select>
          </div>

          <div class="pt-3 flex justify-end gap-2">
            <button type="button" onclick="window.app.closeModal()" class="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50">
              Cancelar
            </button>
            <button type="submit" class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-100">
              Replicar Agora
            </button>
          </div>
        </form>
      </div>
    `);

    document.getElementById("form-duplicate-ativ")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const destTurmaId = document.getElementById("dest-turma-id").value;
      window.teacherController.handleDuplicateAtividade(atividadeId, destTurmaId);
      this.closeModal();
    });
  }

  // Modal 7: Nova Questão Textual (Com Enunciado, 4 Alternativas, Dica Amiga, Explicação Correta e Por Que Errou)
  openModalNovaQuestao(atividadeId) {
    this.openModal(`
      <div class="max-h-[80vh] overflow-y-auto pr-1">
        <h2 class="text-lg font-bold text-slate-800 mb-1">Adicionar Questão Textual</h2>
        <p class="text-xs text-slate-500 mb-4">Estrutura 100% textual com diagnóstico pedagógico e pegadinhas.</p>

        <form id="form-nova-questao" class="space-y-4 text-xs">
          <!-- Enunciado -->
          <div>
            <label class="block font-semibold text-slate-700 mb-1">1. Enunciado Claro e Contextualizado *</label>
            <textarea id="q-enunciado" rows="3" required placeholder="Digite a pergunta ou problema..." class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-600 focus:bg-white focus:outline-none"></textarea>
          </div>

          <!-- Alternativas e Escolha da Correta -->
          <div class="space-y-2 pt-1">
            <label class="block font-semibold text-slate-700">2. Alternativas (Marque o círculo da Correta) *</label>
            
            <div class="flex items-center gap-2">
              <input type="radio" name="q-correct" value="0" checked id="radio-0" class="text-indigo-600 focus:ring-0 cursor-pointer" />
              <input type="text" id="q-alt-0" placeholder="Alternativa A" required class="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-600 focus:bg-white focus:outline-none" />
            </div>

            <div class="flex items-center gap-2">
              <input type="radio" name="q-correct" value="1" id="radio-1" class="text-indigo-600 focus:ring-0 cursor-pointer" />
              <input type="text" id="q-alt-1" placeholder="Alternativa B" required class="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-600 focus:bg-white focus:outline-none" />
            </div>

            <div class="flex items-center gap-2">
              <input type="radio" name="q-correct" value="2" id="radio-2" class="text-indigo-600 focus:ring-0 cursor-pointer" />
              <input type="text" id="q-alt-2" placeholder="Alternativa C" required class="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-600 focus:bg-white focus:outline-none" />
            </div>

            <div class="flex items-center gap-2">
              <input type="radio" name="q-correct" value="3" id="radio-3" class="text-indigo-600 focus:ring-0 cursor-pointer" />
              <input type="text" id="q-alt-3" placeholder="Alternativa D" required class="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-600 focus:bg-white focus:outline-none" />
            </div>
          </div>

          <!-- Dica Amiga -->
          <div class="pt-1">
            <label class="block font-semibold text-amber-800 mb-1">3. 💡 Dica Amiga (Pista reflexiva sem entregar a resposta)</label>
            <input type="text" id="q-dica" placeholder="Ex: Lembre-se da regra da balança ao isolar a incógnita..." class="w-full px-3.5 py-2.5 bg-amber-50/50 border border-amber-200 rounded-xl focus:border-amber-500 focus:bg-white focus:outline-none" />
          </div>

          <!-- Explicação Correta -->
          <div class="pt-1">
            <label class="block font-semibold text-emerald-800 mb-1">4. 📖 Explicação Correta (Passo a passo detalhado)</label>
            <textarea id="q-explicacao" rows="2" placeholder="Ex: Passo 1: Subtrai 5 de ambos os lados..." class="w-full px-3.5 py-2.5 bg-emerald-50/50 border border-emerald-200 rounded-xl focus:border-emerald-500 focus:bg-white focus:outline-none"></textarea>
          </div>

          <!-- Por Que Errou (Pegadinhas) -->
          <div class="pt-1">
            <label class="block font-semibold text-rose-800 mb-1">5. ⚠️ Por Que Errou? (Explique as principais pegadinhas)</label>
            <textarea id="q-pegadinha" rows="2" placeholder="Ex: Pegadinha comum: o aluno esquece de inverter o sinal ao trocar de membro..." class="w-full px-3.5 py-2.5 bg-rose-50/50 border border-rose-200 rounded-xl focus:border-rose-500 focus:bg-white focus:outline-none"></textarea>
          </div>

          <div class="pt-4 flex justify-end gap-2 border-t border-slate-100">
            <button type="button" onclick="window.app.closeModal()" class="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50">
              Cancelar
            </button>
            <button type="submit" class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-100">
              Salvar Questão
            </button>
          </div>
        </form>
      </div>
    `);

    document.getElementById("form-nova-questao")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const enunciado = document.getElementById("q-enunciado").value;
      const alt0 = document.getElementById("q-alt-0").value;
      const alt1 = document.getElementById("q-alt-1").value;
      const alt2 = document.getElementById("q-alt-2").value;
      const alt3 = document.getElementById("q-alt-3").value;
      const correta = parseInt(document.querySelector('input[name="q-correct"]:checked').value, 10);
      const dica = document.getElementById("q-dica").value;
      const explicacao = document.getElementById("q-explicacao").value;
      const pegadinha = document.getElementById("q-pegadinha").value;

      // Construct trap dictionary for wrong options
      const por_que_errou = {};
      [0, 1, 2, 3].forEach(idx => {
        if (idx !== correta && pegadinha) {
          por_que_errou[idx.toString()] = pegadinha;
        }
      });

      window.teacherController.handleSaveQuestao({
        atividade_id: atividadeId,
        enunciado,
        alternativas: [
          `A) ${alt0}`,
          `B) ${alt1}`,
          `C) ${alt2}`,
          `D) ${alt3}`
        ],
        resposta_correta_index: correta,
        dica,
        explicacao,
        por_que_errou
      });
      this.closeModal();
    });
  }

  // Modal 8: Configurações Institucionais da Escola
  openModalConfigEscola() {
    const escola = window.schoolStorage.getEscola();

    this.openModal(`
      <div>
        <h2 class="text-lg font-bold text-slate-800 mb-1">Configurações da Escola</h2>
        <p class="text-xs text-slate-500 mb-4">Informações institucionais exibidas nos cabeçalhos e relatórios.</p>

        <form id="form-config-escola" class="space-y-3.5 text-xs">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Nome da Instituição Escolar *</label>
            <input type="text" id="cfg-nome" value="${escola.nome || ''}" required class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-600 focus:bg-white focus:outline-none" />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Ano Letivo *</label>
              <input type="text" id="cfg-ano" value="${escola.ano_letivo || '2026'}" required class="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-600 focus:bg-white focus:outline-none" />
            </div>

            <div>
              <label class="block font-semibold text-slate-700 mb-1">Bimestre Vigente *</label>
              <select id="cfg-bimestre" class="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-600 focus:bg-white focus:outline-none">
                ${(escola.periodos || ["1º Bimestre", "2º Bimestre", "3º Bimestre", "4º Bimestre"]).map(p => `
                  <option value="${p}" ${p === escola.bimestre_ativo ? 'selected' : ''}>${p}</option>
                `).join("")}
              </select>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Diretor(a) Responsável</label>
              <input type="text" id="cfg-diretor" value="${escola.diretor_nome || ''}" class="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-600 focus:bg-white focus:outline-none" />
            </div>

            <div>
              <label class="block font-semibold text-slate-700 mb-1">Coordenador(a) Pedagógico(a)</label>
              <input type="text" id="cfg-coord" value="${escola.coordenador_nome || ''}" class="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-600 focus:bg-white focus:outline-none" />
            </div>
          </div>

          <div class="pt-3 flex justify-end gap-2 border-t border-slate-100">
            <button type="button" onclick="window.app.closeModal()" class="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50">
              Cancelar
            </button>
            <button type="submit" class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-100">
              Salvar Configurações
            </button>
          </div>
        </form>
      </div>
    `);

    document.getElementById("form-config-escola")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const nome = document.getElementById("cfg-nome").value;
      const ano_letivo = document.getElementById("cfg-ano").value;
      const bimestre_ativo = document.getElementById("cfg-bimestre").value;
      const diretor_nome = document.getElementById("cfg-diretor").value;
      const coordenador_nome = document.getElementById("cfg-coord").value;

      window.managementController.handleSaveEscola({
        nome,
        ano_letivo,
        bimestre_ativo,
        diretor_nome,
        coordenador_nome
      });
      this.closeModal();
    });
  }

  // Modal 9: Cadastrar Professor (Corpo Docente)
  openModalNovoProfessor() {
    const turmas = window.schoolStorage.getTurmas();

    this.openModal(`
      <div>
        <h2 class="text-lg font-bold text-slate-800 mb-1">Cadastrar Professor</h2>
        <p class="text-xs text-slate-500 mb-4">Adicione docentes ao corpo acadêmico da instituição.</p>

        <form id="form-novo-professor" class="space-y-3.5 text-xs">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Nome Completo do Professor *</label>
            <input type="text" id="prof-nome" placeholder="Ex: Prof. Roberto Andrade" required class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-600 focus:bg-white focus:outline-none" />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Disciplina Principal *</label>
              <input type="text" id="prof-especialidade" placeholder="Ex: Matemática" required class="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-600 focus:bg-white focus:outline-none" />
            </div>

            <div>
              <label class="block font-semibold text-slate-700 mb-1">E-mail Funcional (Opcional)</label>
              <input type="email" id="prof-email" placeholder="professor@escola.edu.br" class="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-600 focus:bg-white focus:outline-none" />
            </div>
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1.5">Atribuir Turmas:</label>
            <div class="space-y-1.5 max-h-32 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
              ${turmas.map(t => `
                <label class="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input type="checkbox" name="prof-turma-check" value="${t.id}" class="text-indigo-600 rounded focus:ring-0" />
                  <span>${t.nome} - ${t.disciplina} (${t.serie_ano})</span>
                </label>
              `).join("")}
            </div>
          </div>

          <div class="pt-3 flex justify-end gap-2 border-t border-slate-100">
            <button type="button" onclick="window.app.closeModal()" class="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50">
              Cancelar
            </button>
            <button type="submit" class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-100">
              Cadastrar Docente
            </button>
          </div>
        </form>
      </div>
    `);

    document.getElementById("form-novo-professor")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const nome = document.getElementById("prof-nome").value;
      const especialidade = document.getElementById("prof-especialidade").value;
      const email = document.getElementById("prof-email").value;
      const checkboxes = document.querySelectorAll('input[name="prof-turma-check"]:checked');
      const turmas_ids = Array.from(checkboxes).map(cb => cb.value);

      window.managementController.handleCreateProfessor({
        nome,
        especialidade,
        email,
        turmas_ids
      });
      this.closeModal();
    });
  }

  // Modal 10: Novo Comunicado no Mural
  openModalNovoAviso(preSelectedTurmaId = null) {
    const turmas = window.schoolStorage.getTurmas();
    const isTeacherPosting = !!preSelectedTurmaId;

    this.openModal(`
      <div>
        <h2 class="text-lg font-bold text-slate-800 mb-1">${isTeacherPosting ? 'Novo Recado para a Turma' : 'Publicar Comunicado no Mural'}</h2>
        <p class="text-xs text-slate-500 mb-4">Esta mensagem aparecerá diretamente no portal dos alunos.</p>

        <form id="form-novo-aviso" class="space-y-3.5 text-xs">
          <div>
            <label class="block font-semibold text-slate-700 mb-1">Título do Comunicado *</label>
            <input type="text" id="aviso-titulo" placeholder="Ex: Reunião de Pais e Mestres" required class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-600 focus:bg-white focus:outline-none" />
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">Mensagem *</label>
            <textarea id="aviso-mensagem" rows="3" required placeholder="Digite o texto do comunicado..." class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-600 focus:bg-white focus:outline-none"></textarea>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block font-semibold text-slate-700 mb-1">Alcance / Destinatários *</label>
              <select id="aviso-alcance" class="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-600 focus:bg-white focus:outline-none">
                ${!preSelectedTurmaId ? `<option value="escola">Toda a Escola (Todos os Alunos)</option>` : ''}
                ${turmas.map(t => `
                  <option value="${t.id}" ${t.id === preSelectedTurmaId ? 'selected' : ''}>
                    Turma ${t.nome} (${t.disciplina})
                  </option>
                `).join("")}
              </select>
            </div>

            <div>
              <label class="block font-semibold text-slate-700 mb-1">Prioridade</label>
              <select id="aviso-prioridade" class="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-600 focus:bg-white focus:outline-none">
                <option value="normal">Informativo Normal</option>
                <option value="media" selected>Média Prioridade</option>
                <option value="alta">Alta Prioridade (Alerta)</option>
              </select>
            </div>
          </div>

          <div>
            <label class="block font-semibold text-slate-700 mb-1">Assinatura / Autor *</label>
            <input type="text" id="aviso-autor" value="${isTeacherPosting ? 'Professora' : 'Coordenação Pedagógica'}" required class="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-600 focus:bg-white focus:outline-none" />
          </div>

          <div class="pt-3 flex justify-end gap-2 border-t border-slate-100">
            <button type="button" onclick="window.app.closeModal()" class="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50">
              Cancelar
            </button>
            <button type="submit" class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md shadow-indigo-100">
              Publicar no Mural
            </button>
          </div>
        </form>
      </div>
    `);

    document.getElementById("form-novo-aviso")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const titulo = document.getElementById("aviso-titulo").value;
      const mensagem = document.getElementById("aviso-mensagem").value;
      const alcance = document.getElementById("aviso-alcance").value;
      const prioridade = document.getElementById("aviso-prioridade").value;
      const autor = document.getElementById("aviso-autor").value;

      window.schoolStorage.saveAviso({
        titulo,
        mensagem,
        alcance,
        prioridade,
        autor
      });
      window.app.showToast("Comunicado publicado com sucesso!", "success");
      this.closeModal();
    });
  }
}

window.app = new App();

// Auto boot on DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
  window.app.init();
});
