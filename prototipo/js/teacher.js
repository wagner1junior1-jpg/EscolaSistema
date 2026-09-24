// Teacher Dashboard Controller for Sistema de Questões Escolar

class TeacherController {
  constructor() {
    this.currentTab = "turmas"; // "turmas", "alunos", "frequencia", "atividades", "mural", "diagnostico"
    this.activeTurmaId = null;
    this.activeAtividadeId = null; // for question editor or diagnostics
    this.editingQuestionId = null;
    this.searchTermAlunos = "";
    this.selectedFreqData = null;
    this.tempPresencas = null;
  }

  init() {
    const turmas = window.schoolStorage.getTurmas();
    const savedTurmaId = window.schoolStorage.getCurrentTeacherClass();
    if (savedTurmaId && turmas.some(t => t.id === savedTurmaId)) {
      this.activeTurmaId = savedTurmaId;
    } else if (turmas.length > 0) {
      this.activeTurmaId = turmas[0].id;
      window.schoolStorage.setCurrentTeacherClass(this.activeTurmaId);
    }

    // Default to ativ-1 if exists
    if (!this.activeAtividadeId) {
      const ativs = window.schoolStorage.getAtividadesByTurma(this.activeTurmaId);
      if (ativs.length > 0) {
        this.activeAtividadeId = ativs[0].id;
      }
    }

    this.render();
  }

  setTab(tab) {
    this.currentTab = tab;
    this.render();
  }

  setActiveTurma(turmaId) {
    this.activeTurmaId = turmaId;
    window.schoolStorage.setCurrentTeacherClass(turmaId);
    
    // reset active activity to first of this class
    const ativs = window.schoolStorage.getAtividadesByTurma(turmaId);
    this.activeAtividadeId = ativs.length > 0 ? ativs[0].id : null;
    this.render();
  }

  // --- ACTIONS ---
  handleCreateTurma(formData) {
    const newId = window.schoolStorage.saveTurma(formData);
    window.app.showToast("Turma criada com sucesso!", "success");
    this.setActiveTurma(newId);
  }

  handleCreateAluno(turmaId, nome) {
    if (!nome.trim()) return;
    const aluno = window.schoolStorage.saveAluno(turmaId, nome);
    window.app.showToast(`Aluno ${aluno.nome_completo} cadastrado com PIN ${aluno.pin_4_digitos}!`, "success");
    this.render();
  }

  handleBatchImportAlunos(turmaId, text) {
    const added = window.schoolStorage.batchAddAlunos(turmaId, text);
    if (added.length > 0) {
      window.app.showToast(`${added.length} alunos importados com novos PINs gerados!`, "success");
      this.render();
    } else {
      window.app.showToast("Nenhum nome válido encontrado no texto.", "warning");
    }
  }

  handleResetPin(alunoId) {
    const aluno = window.schoolStorage.getAlunoById(alunoId);
    if (!aluno) return;

    if (confirm(`Deseja gerar um novo PIN de 4 dígitos para ${aluno.nome_completo}?`)) {
      const newPin = window.schoolStorage.resetPinAluno(alunoId);
      window.app.showToast(`Novo PIN gerado para ${aluno.nome_completo}: ${newPin}`, "success");
      this.render();
    }
  }

  handleDeleteAluno(alunoId) {
    const aluno = window.schoolStorage.getAlunoById(alunoId);
    if (!aluno) return;

    if (confirm(`Excluir o aluno ${aluno.nome_completo} desta turma? As respostas dele também serão removidas.`)) {
      window.schoolStorage.deleteAluno(alunoId);
      window.app.showToast("Aluno removido.", "info");
      this.render();
    }
  }

  handleCreateAtividade(ativData) {
    const newId = window.schoolStorage.saveAtividade(ativData);
    window.app.showToast("Atividade salva com sucesso!", "success");
    this.activeAtividadeId = newId;
    this.setTab("atividades");
  }

  handleDuplicateAtividade(atividadeId, targetTurmaId) {
    const newId = window.schoolStorage.duplicateAtividade(atividadeId, targetTurmaId);
    const targetTurma = window.schoolStorage.getTurmaById(targetTurmaId);
    window.app.showToast(`Atividade duplicada com sucesso para ${targetTurma ? targetTurma.nome : 'outra turma'}!`, "success");
    this.setActiveTurma(targetTurmaId);
    this.activeAtividadeId = newId;
    this.setTab("atividades");
  }

  handleDeleteAtividade(ativId) {
    if (confirm("Tem certeza que deseja excluir esta atividade e todas as suas questões?")) {
      window.schoolStorage.deleteAtividade(ativId);
      window.app.showToast("Atividade excluída.", "info");
      const remaining = window.schoolStorage.getAtividadesByTurma(this.activeTurmaId);
      this.activeAtividadeId = remaining.length > 0 ? remaining[0].id : null;
      this.render();
    }
  }

  handleSaveQuestao(qData) {
    window.schoolStorage.saveQuestao(qData);
    window.app.showToast("Questão salva com sucesso!", "success");
    this.editingQuestionId = null;
    this.render();
  }

  handleDeleteQuestao(qId) {
    if (confirm("Excluir esta questão?")) {
      window.schoolStorage.deleteQuestao(qId);
      window.app.showToast("Questão removida.", "info");
      this.render();
    }
  }

  // --- RENDER MAIN ---
  render() {
    const container = document.getElementById("teacher-view-container");
    if (!container) return;

    const turmas = window.schoolStorage.getTurmas();
    const activeTurma = window.schoolStorage.getTurmaById(this.activeTurmaId) || (turmas[0] || null);

    container.innerHTML = `
      <div class="max-w-6xl mx-auto pt-4 pb-20 px-4">
        <!-- Top Teacher Navbar / Class Switcher -->
        <div class="bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-200/90 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <!-- Class Badge & Selector -->
          <div class="flex flex-wrap items-center gap-3">
            <div class="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-md shadow-indigo-100">
              👩‍🏫
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="text-xs font-semibold text-slate-400">Turma Selecionada:</span>
                <span class="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                  Código: ${activeTurma ? activeTurma.codigo_acesso : '---'}
                </span>
              </div>
              <div class="flex items-center gap-2 mt-0.5">
                <select id="select-active-turma" class="font-bold text-base sm:text-lg text-slate-800 bg-transparent border-0 focus:ring-0 cursor-pointer pr-8 hover:text-indigo-600 transition-colors">
                  ${turmas.map(t => `
                    <option value="${t.id}" ${t.id === (activeTurma ? activeTurma.id : '') ? 'selected' : ''}>
                      ${t.nome} - ${t.disciplina} (${t.serie_ano})
                    </option>
                  `).join("")}
                </select>
              </div>
            </div>
          </div>

          <!-- Quick Top Actions -->
          <div class="flex flex-wrap items-center gap-2">
            <button id="btn-open-modal-nova-turma" class="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-all flex items-center gap-1.5">
              <i class="fas fa-plus text-indigo-600"></i>
              <span>Nova Turma</span>
            </button>
            <button id="btn-print-pin-tickets" class="px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-semibold text-xs transition-all flex items-center gap-1.5">
              <i class="fas fa-print"></i>
              <span>Imprimir PINs da Turma</span>
            </button>
          </div>
        </div>

        <!-- Tab Navigation Buttons -->
        <div class="flex border-b border-slate-200 mb-6 gap-2 sm:gap-4 overflow-x-auto pb-1">
          <button class="teacher-tab-btn py-3 px-4 font-bold text-xs sm:text-sm rounded-t-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            this.currentTab === "turmas" 
              ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' 
              : 'text-slate-500 hover:text-slate-800'
          }" data-tab="turmas">
            <i class="fas fa-chalkboard"></i>
            <span>Painel & Séries</span>
          </button>

          <button class="teacher-tab-btn py-3 px-4 font-bold text-xs sm:text-sm rounded-t-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            this.currentTab === "alunos" 
              ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' 
              : 'text-slate-500 hover:text-slate-800'
          }" data-tab="alunos">
            <i class="fas fa-users"></i>
            <span>Chamada & PINs</span>
          </button>

          <button class="teacher-tab-btn py-3 px-4 font-bold text-xs sm:text-sm rounded-t-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            this.currentTab === "frequencia" 
              ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' 
              : 'text-slate-500 hover:text-slate-800'
          }" data-tab="frequencia">
            <i class="fas fa-calendar-check text-emerald-600"></i>
            <span>Frequência Diária</span>
          </button>

          <button class="teacher-tab-btn py-3 px-4 font-bold text-xs sm:text-sm rounded-t-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            this.currentTab === "atividades" 
              ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' 
              : 'text-slate-500 hover:text-slate-800'
          }" data-tab="atividades">
            <i class="fas fa-file-alt"></i>
            <span>Exercícios & Questões</span>
          </button>

          <button class="teacher-tab-btn py-3 px-4 font-bold text-xs sm:text-sm rounded-t-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            this.currentTab === "mural" 
              ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' 
              : 'text-slate-500 hover:text-slate-800'
          }" data-tab="mural">
            <i class="fas fa-comment-alt text-amber-500"></i>
            <span>Mural da Turma</span>
          </button>

          <button class="teacher-tab-btn py-3 px-4 font-bold text-xs sm:text-sm rounded-t-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            this.currentTab === "diagnostico" 
              ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' 
              : 'text-slate-500 hover:text-slate-800'
          }" data-tab="diagnostico">
            <i class="fas fa-fire text-amber-500"></i>
            <span>Mapa de Calor & Erros</span>
            <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </button>
        </div>

        <!-- Tab Body Content -->
        <div id="teacher-tab-content">
          ${this.renderTabContent(activeTurma)}
        </div>
      </div>

      <!-- Printable Area (Hidden on screen, visible only when printing) -->
      <div id="printable-pin-tickets" class="hidden">
        ${this.renderPrintableTickets(activeTurma)}
      </div>
    `;

    this.bindTeacherEvents(activeTurma);
  }

  renderTabContent(turma) {
    if (!turma) {
      return `
        <div class="bg-white rounded-3xl p-12 text-center border border-slate-200">
          <i class="fas fa-chalkboard-teacher text-4xl text-slate-300 mb-3"></i>
          <h3 class="text-base font-bold text-slate-700">Nenhuma turma cadastrada</h3>
          <p class="text-xs text-slate-400 mt-1 mb-4">Clique no botão abaixo para criar a primeira turma da sua escola.</p>
          <button id="btn-create-first-turma" class="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-xs">
            Criar Primeira Turma
          </button>
        </div>
      `;
    }

    switch (this.currentTab) {
      case "turmas":
        return this.renderTabTurmas(turma);
      case "alunos":
        return this.renderTabAlunos(turma);
      case "frequencia":
        return this.renderTabFrequencia(turma);
      case "atividades":
        return this.renderTabAtividades(turma);
      case "mural":
        return this.renderTabMuralTurma(turma);
      case "diagnostico":
        return this.renderTabDiagnostico(turma);
      default:
        return this.renderTabTurmas(turma);
    }
  }

  // --- TAB 1: PAINEL & SÉRIES ---
  renderTabTurmas(turma) {
    const turmas = window.schoolStorage.getTurmas();
    const alunos = window.schoolStorage.getAlunosByTurma(turma.id);
    const atividades = window.schoolStorage.getAtividadesByTurma(turma.id);

    // Group classes by series segment
    const fund1 = turmas.filter(t => t.segmento === "Fundamental I");
    const fund2 = turmas.filter(t => t.segmento === "Fundamental II");
    const medio = turmas.filter(t => t.segmento === "Ensino Médio");

    return `
      <div class="space-y-6">
        <!-- Top Stats Row -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div class="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm">
            <span class="text-xs font-semibold text-slate-400 block">Alunos na Turma</span>
            <div class="flex items-baseline gap-2 mt-1">
              <span class="text-2xl font-black text-slate-800">${alunos.length}</span>
              <span class="text-[11px] text-emerald-600 font-semibold">100% com PIN</span>
            </div>
          </div>

          <div class="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm">
            <span class="text-xs font-semibold text-slate-400 block">Atividades Ativas</span>
            <div class="flex items-baseline gap-2 mt-1">
              <span class="text-2xl font-black text-slate-800">${atividades.filter(a => a.ativa).length}</span>
              <span class="text-[11px] text-indigo-600 font-semibold">${atividades.length} criadas</span>
            </div>
          </div>

          <div class="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm">
            <span class="text-xs font-semibold text-slate-400 block">Código da Turma</span>
            <div class="flex items-center gap-2 mt-1">
              <span class="text-xl font-mono font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100">
                ${turma.codigo_acesso}
              </span>
            </div>
          </div>

          <div class="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm">
            <span class="text-xs font-semibold text-slate-400 block">Segmento Escolar</span>
            <div class="flex items-baseline gap-1 mt-1">
              <span class="text-sm font-bold text-slate-800">${turma.serie_ano}</span>
              <span class="text-[11px] text-slate-400">(${turma.segmento})</span>
            </div>
          </div>
        </div>

        <!-- Strategy Box (Pitch Highlight for Director) -->
        <div class="bg-gradient-to-r from-indigo-900 to-indigo-800 rounded-3xl p-5 sm:p-6 text-white shadow-md">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/20 text-indigo-100 mb-2">
                🏫 Organização por Séries & Anos Escolares
              </span>
              <h2 class="text-lg sm:text-xl font-bold">Conteúdo direcionado ao nível de cada turma</h2>
              <p class="text-xs sm:text-sm text-indigo-200 mt-1 max-w-xl">
                Crie listas de exercícios para o <strong>${turma.nome}</strong> e replique para outras turmas da mesma série em 1 clique, sem retrabalho.
              </p>
            </div>
            <button id="btn-duplicate-current-ativ" class="px-4 py-2.5 rounded-xl bg-white text-indigo-900 hover:bg-indigo-50 font-bold text-xs transition-all shadow-sm flex items-center justify-center gap-2 shrink-0">
              <i class="fas fa-copy"></i>
              <span>Replicar Atividade para Outra Turma</span>
            </button>
          </div>
        </div>

        <!-- All Classes Grouped by Educational Stage -->
        <div class="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-base font-bold text-slate-800 flex items-center gap-2">
              <i class="fas fa-layer-group text-indigo-600"></i>
              <span>Todas as Turmas da Escola</span>
            </h3>
            <button id="btn-quick-new-turma" class="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
              <i class="fas fa-plus-circle"></i>
              <span>Cadastrar Nova Turma</span>
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <!-- Fundamental II -->
            <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200/70">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-bold text-indigo-900">Fundamental II (6º ao 9º)</span>
                <span class="text-[10px] font-semibold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">${fund2.length} turmas</span>
              </div>
              <div class="space-y-2">
                ${fund2.map(t => `
                  <div class="p-3 bg-white rounded-xl border ${t.id === turma.id ? 'border-indigo-500 shadow-sm ring-2 ring-indigo-100' : 'border-slate-200 hover:border-slate-300'} flex items-center justify-between cursor-pointer btn-select-turma" data-id="${t.id}">
                    <div>
                      <h4 class="text-xs font-bold text-slate-800">${t.nome} - ${t.disciplina}</h4>
                      <p class="text-[11px] text-slate-400">Código: <span class="font-mono font-bold text-indigo-600">${t.codigo_acesso}</span></p>
                    </div>
                    ${t.id === turma.id ? '<span class="text-[10px] bg-indigo-600 text-white font-bold px-2 py-0.5 rounded-full">Ativa</span>' : ''}
                  </div>
                `).join("")}
              </div>
            </div>

            <!-- Fundamental I -->
            <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200/70">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-bold text-indigo-900">Fundamental I (1º ao 5º)</span>
                <span class="text-[10px] font-semibold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">${fund1.length} turmas</span>
              </div>
              <div class="space-y-2">
                ${fund1.length === 0 ? '<p class="text-xs text-slate-400 italic">Nenhuma turma cadastrada</p>' : fund1.map(t => `
                  <div class="p-3 bg-white rounded-xl border ${t.id === turma.id ? 'border-indigo-500 shadow-sm ring-2 ring-indigo-100' : 'border-slate-200 hover:border-slate-300'} flex items-center justify-between cursor-pointer btn-select-turma" data-id="${t.id}">
                    <div>
                      <h4 class="text-xs font-bold text-slate-800">${t.nome} - ${t.disciplina}</h4>
                      <p class="text-[11px] text-slate-400">Código: <span class="font-mono font-bold text-indigo-600">${t.codigo_acesso}</span></p>
                    </div>
                    ${t.id === turma.id ? '<span class="text-[10px] bg-indigo-600 text-white font-bold px-2 py-0.5 rounded-full">Ativa</span>' : ''}
                  </div>
                `).join("")}
              </div>
            </div>

            <!-- Ensino Médio -->
            <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200/70">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-bold text-indigo-900">Ensino Médio (1º ao 3º)</span>
                <span class="text-[10px] font-semibold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">${medio.length} turmas</span>
              </div>
              <div class="space-y-2">
                ${medio.length === 0 ? '<p class="text-xs text-slate-400 italic">Nenhuma turma cadastrada</p>' : medio.map(t => `
                  <div class="p-3 bg-white rounded-xl border ${t.id === turma.id ? 'border-indigo-500 shadow-sm ring-2 ring-indigo-100' : 'border-slate-200 hover:border-slate-300'} flex items-center justify-between cursor-pointer btn-select-turma" data-id="${t.id}">
                    <div>
                      <h4 class="text-xs font-bold text-slate-800">${t.nome} - ${t.disciplina}</h4>
                      <p class="text-[11px] text-slate-400">Código: <span class="font-mono font-bold text-indigo-600">${t.codigo_acesso}</span></p>
                    </div>
                    ${t.id === turma.id ? '<span class="text-[10px] bg-indigo-600 text-white font-bold px-2 py-0.5 rounded-full">Ativa</span>' : ''}
                  </div>
                `).join("")}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // --- TAB 2: CHAMADA & PINS ---
  renderTabAlunos(turma) {
    const alunos = window.schoolStorage.getAlunosByTurma(turma.id);
    const search = this.searchTermAlunos.toLowerCase().trim();
    const filtered = alunos.filter(a => a.nome_completo.toLowerCase().includes(search));

    return `
      <div class="space-y-6">
        <!-- Header & Action Buttons -->
        <div class="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2">
              <i class="fas fa-id-card text-indigo-600"></i>
              <span>Lista de Chamada & PINs • ${turma.nome}</span>
            </h2>
            <p class="text-xs text-slate-500 mt-0.5">
              Alunos não utilizam e-mail. Eles acessam apenas com o código <strong class="text-indigo-600">${turma.codigo_acesso}</strong> e o PIN de 4 dígitos.
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <button id="btn-modal-add-aluno" class="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-sm">
              <i class="fas fa-user-plus"></i>
              <span>Novo Aluno</span>
            </button>
            <button id="btn-modal-batch-alunos" class="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all flex items-center gap-1.5">
              <i class="fas fa-file-import text-indigo-600"></i>
              <span>Colar Lista da Chamada</span>
            </button>
            <button id="btn-print-pin-tickets-2" class="px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold text-xs transition-all flex items-center gap-1.5">
              <i class="fas fa-print"></i>
              <span>Imprimir Filipetas</span>
            </button>
          </div>
        </div>

        <!-- Search Bar -->
        <div class="relative">
          <i class="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
          <input 
            type="text" 
            id="input-search-roster" 
            value="${this.searchTermAlunos}"
            placeholder="Filtrar por nome do aluno..." 
            class="w-full pl-9 pr-4 py-2.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-2xl focus:border-indigo-600 focus:outline-none transition-all shadow-sm"
          />
        </div>

        <!-- Roster Table / Grid -->
        <div class="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th class="px-5 py-3.5">Nº</th>
                  <th class="px-5 py-3.5">Nome do Aluno</th>
                  <th class="px-5 py-3.5">PIN de Acesso (4 Dígitos)</th>
                  <th class="px-5 py-3.5">Atividades Feitas</th>
                  <th class="px-5 py-3.5 text-right">Ações Rápidas</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${filtered.length === 0 ? `
                  <tr>
                    <td colspan="5" class="px-5 py-8 text-center text-slate-400">
                      Nenhum aluno encontrado com este nome.
                    </td>
                  </tr>
                ` : filtered.map((aluno, index) => {
                  const respostas = window.schoolStorage.getRespostasByAluno(aluno.id);
                  const totalAtivs = window.schoolStorage.getAtividadesByTurma(turma.id).length;
                  const fezAlguma = respostas.length > 0;

                  return `
                    <tr class="hover:bg-slate-50/80 transition-colors">
                      <td class="px-5 py-3.5 text-slate-400 font-medium">${index + 1}</td>
                      <td class="px-5 py-3.5">
                        <span class="font-bold text-slate-800 text-sm block">${aluno.nome_completo}</span>
                        <span class="text-[11px] text-slate-400">Cadastrado na turma ${turma.nome}</span>
                      </td>
                      <td class="px-5 py-3.5">
                        <div class="inline-flex items-center gap-2 bg-slate-100 px-3 py-1 rounded-xl border border-slate-200">
                          <i class="fas fa-lock text-indigo-500 text-[10px]"></i>
                          <span class="font-mono font-bold text-sm tracking-widest text-slate-800">${aluno.pin_4_digitos}</span>
                          <button class="btn-copy-pin text-slate-400 hover:text-indigo-600 ml-1 text-xs" data-pin="${aluno.pin_4_digitos}" title="Copiar PIN">
                            <i class="far fa-copy"></i>
                          </button>
                        </div>
                      </td>
                      <td class="px-5 py-3.5">
                        ${fezAlguma ? `
                          <span class="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full text-[11px] font-bold">
                            <i class="fas fa-check-circle text-xs"></i>
                            <span>Ativo (${respostas.length} respostas)</span>
                          </span>
                        ` : `
                          <span class="inline-flex items-center gap-1 text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full text-[11px] font-medium">
                            <i class="far fa-clock text-xs"></i>
                            <span>Ainda não respondeu</span>
                          </span>
                        `}
                      </td>
                      <td class="px-5 py-3.5 text-right space-x-2">
                        <button class="btn-reset-pin px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-semibold border border-amber-200 transition-all" data-id="${aluno.id}" title="Gerar novo PIN se o aluno esqueceu">
                          <i class="fas fa-sync-alt mr-1"></i> Resetar PIN
                        </button>
                        <button class="btn-delete-aluno p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all" data-id="${aluno.id}" title="Excluir aluno">
                          <i class="fas fa-trash text-xs"></i>
                        </button>
                      </td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // --- TAB: FREQUÊNCIA DIÁRIA (DIÁRIO DE CHAMADA) ---
  renderTabFrequencia(turma) {
    const alunos = window.schoolStorage.getAlunosByTurma(turma.id);
    const dataStr = this.selectedFreqData || new Date().toISOString().split("T")[0];
    const existingFreq = window.schoolStorage.getFrequenciaByData(turma.id, dataStr);

    // Initialize temp presences if not present or date changed
    if (!this.tempPresencas || this.tempPresencasData !== dataStr || this.tempPresencasTurma !== turma.id) {
      this.tempPresencas = {};
      this.tempPresencasData = dataStr;
      this.tempPresencasTurma = turma.id;
      alunos.forEach(a => {
        this.tempPresencas[a.id] = (existingFreq && existingFreq.presencas && existingFreq.presencas[a.id]) || "P";
      });
    }

    let presentesCount = 0;
    let faltasCount = 0;
    let justCount = 0;
    Object.values(this.tempPresencas).forEach(v => {
      if (v === "P") presentesCount++;
      else if (v === "F") faltasCount++;
      else if (v === "J") justCount++;
    });

    const taxa = alunos.length > 0 ? Math.round(((presentesCount + justCount) / alunos.length) * 100) : 100;

    return `
      <div class="space-y-6">
        <!-- Frequency Header -->
        <div class="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2">
              <i class="fas fa-calendar-check text-emerald-600"></i>
              <span>Diário de Chamada & Frequência • ${turma.nome}</span>
            </h2>
            <p class="text-xs text-slate-500 mt-0.5">Marque presença, falta ou justificativa em 1 clique para a turma.</p>
          </div>

          <!-- Date Selector & Quick Actions -->
          <div class="flex flex-wrap items-center gap-2">
            <input type="date" id="input-freq-date" value="${dataStr}" class="text-xs font-bold px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:border-indigo-600 focus:outline-none" />
            <button id="btn-all-present" class="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all flex items-center gap-1.5">
              <i class="fas fa-check-double text-emerald-600"></i>
              <span>Todos Presentes</span>
            </button>
            <button id="btn-save-frequencia" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-md shadow-emerald-100">
              <i class="fas fa-save"></i>
              <span>Salvar Frequência</span>
            </button>
          </div>
        </div>

        <!-- Summary KPIs -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <span class="text-xs font-semibold text-slate-400 block">Total de Alunos</span>
            <span class="text-2xl font-black text-slate-800 mt-1 block">${alunos.length}</span>
          </div>
          <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <span class="text-xs font-semibold text-slate-400 block">Presentes (P)</span>
            <span class="text-2xl font-black text-emerald-600 mt-1 block">${presentesCount}</span>
          </div>
          <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <span class="text-xs font-semibold text-slate-400 block">Faltas (F)</span>
            <span class="text-2xl font-black text-rose-600 mt-1 block">${faltasCount}</span>
          </div>
          <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <span class="text-xs font-semibold text-slate-400 block">Taxa do Dia</span>
            <span class="text-2xl font-black text-indigo-700 mt-1 block">${taxa}%</span>
          </div>
        </div>

        <!-- Attendance Table -->
        <div class="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th class="px-5 py-3.5">Nº</th>
                  <th class="px-5 py-3.5">Nome do Aluno</th>
                  <th class="px-5 py-3.5 text-center">Frequência Acumulada</th>
                  <th class="px-5 py-3.5 text-center">Registro do Dia (${dataStr})</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${alunos.map((aluno, index) => {
                  const currentVal = this.tempPresencas[aluno.id] || "P";
                  const hist = window.schoolStorage.getAlunoFrequenciaStats(aluno.id, turma.id);

                  return `
                    <tr class="hover:bg-slate-50/60 transition-colors">
                      <td class="px-5 py-3.5 text-slate-400 font-medium">${index + 1}</td>
                      <td class="px-5 py-3.5">
                        <span class="font-bold text-slate-800 text-sm block">${aluno.nome_completo}</span>
                        <span class="text-[11px] text-slate-400">PIN: <strong class="font-mono text-slate-600">${aluno.pin_4_digitos}</strong></span>
                      </td>
                      <td class="px-5 py-3.5 text-center">
                        <span class="font-bold ${hist.percentual >= 75 ? 'text-slate-700' : 'text-rose-600 font-black'}">
                          ${hist.percentual}%
                        </span>
                        <span class="text-[10px] text-slate-400 block">${hist.presencas} de ${hist.totalDias} aulas</span>
                      </td>
                      <td class="px-5 py-3.5 text-center">
                        <div class="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200 gap-1">
                          <button type="button" class="btn-toggle-freq px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                            currentVal === 'P' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
                          }" data-id="${aluno.id}" data-val="P">
                            P
                          </button>
                          <button type="button" class="btn-toggle-freq px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                            currentVal === 'F' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
                          }" data-id="${aluno.id}" data-val="F">
                            F
                          </button>
                          <button type="button" class="btn-toggle-freq px-3 py-1 rounded-lg font-bold text-xs transition-all ${
                            currentVal === 'J' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-200'
                          }" data-id="${aluno.id}" data-val="J">
                            J
                          </button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // --- TAB 3: ATIVIDADES & QUESTÕES ---
  renderTabAtividades(turma) {
    const atividades = window.schoolStorage.getAtividadesByTurma(turma.id);
    const activeAtiv = window.schoolStorage.getAtividadeById(this.activeAtividadeId) || (atividades[0] || null);
    const questoes = activeAtiv ? window.schoolStorage.getQuestoesByAtividade(activeAtiv.id) : [];

    return `
      <div class="space-y-6">
        <!-- Header & Action -->
        <div class="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2">
              <i class="fas fa-pencil-alt text-indigo-600"></i>
              <span>Gerenciar Atividades & Exercícios • ${turma.nome}</span>
            </h2>
            <p class="text-xs text-slate-500 mt-0.5">
              Questões 100% textuais: rápidas de carregar em qualquer celular e com correção automática instantânea.
            </p>
          </div>

          <div class="flex items-center gap-2">
            <button id="btn-modal-nova-atividade" class="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-sm">
              <i class="fas fa-plus"></i>
              <span>Criar Nova Atividade</span>
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <!-- Left Column: Activity List -->
          <div class="lg:col-span-1 space-y-3">
            <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
              Listas de Exercícios da Turma (${atividades.length})
            </h3>

            ${atividades.length === 0 ? `
              <div class="bg-white p-6 rounded-2xl border border-slate-200 text-center">
                <p class="text-xs text-slate-400">Nenhuma atividade criada nesta turma.</p>
              </div>
            ` : atividades.map(at => {
              const qCount = window.schoolStorage.getQuestoesByAtividade(at.id).length;
              const isSelected = activeAtiv && activeAtiv.id === at.id;

              return `
                <div 
                  class="activity-selector-card p-4 rounded-2xl border transition-all cursor-pointer ${
                    isSelected 
                      ? 'bg-indigo-50/70 border-indigo-500 shadow-sm' 
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }"
                  data-id="${at.id}"
                >
                  <div class="flex items-start justify-between gap-2">
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                      at.ativa ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                    }">
                      ${at.ativa ? 'Ativa para os Alunos' : 'Inativa (Rascunho)'}
                    </span>
                    <span class="text-[11px] font-bold text-indigo-700">${qCount} Questões</span>
                  </div>
                  <h4 class="font-bold text-sm text-slate-800 mt-2">${at.titulo}</h4>
                  ${at.prazo_entrega ? `
                    <p class="text-[11px] text-slate-400 mt-1">
                      <i class="far fa-calendar mr-1"></i> Prazo: ${at.prazo_entrega}
                    </p>
                  ` : ''}
                </div>
              `;
            }).join("")}
          </div>

          <!-- Right Column: Selected Activity Details & Questions -->
          <div class="lg:col-span-2">
            ${!activeAtiv ? `
              <div class="bg-white rounded-3xl p-8 border border-slate-200 text-center">
                <p class="text-sm font-semibold text-slate-600">Selecione ou crie uma atividade para ver as questões.</p>
              </div>
            ` : `
              <div class="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-6">
                <!-- Activity Header Details -->
                <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <span class="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">
                      ${turma.serie_ano} • ${turma.disciplina}
                    </span>
                    <h3 class="text-lg font-bold text-slate-800 mt-1">${activeAtiv.titulo}</h3>
                    ${activeAtiv.descricao ? `<p class="text-xs text-slate-500 mt-0.5">${activeAtiv.descricao}</p>` : ''}
                  </div>

                  <div class="flex flex-wrap items-center gap-2">
                    <button class="btn-toggle-active-ativ px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                      activeAtiv.ativa 
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100' 
                        : 'border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }" data-id="${activeAtiv.id}">
                      <i class="fas fa-power-off mr-1"></i> ${activeAtiv.ativa ? 'Ativa' : 'Oculta'}
                    </button>
                    <button class="btn-duplicate-this-ativ px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all" data-id="${activeAtiv.id}">
                      <i class="fas fa-copy mr-1"></i> Duplicar
                    </button>
                    <button class="btn-delete-this-ativ px-2.5 py-1.5 rounded-xl text-rose-600 hover:bg-rose-50 transition-all text-xs" data-id="${activeAtiv.id}">
                      <i class="fas fa-trash"></i>
                    </button>
                  </div>
                </div>

                <!-- Questions List Header & Add Button -->
                <div class="flex items-center justify-between">
                  <h4 class="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <i class="fas fa-list-ol text-indigo-600"></i>
                    <span>Questões da Atividade (${questoes.length})</span>
                  </h4>
                  <button id="btn-modal-add-questao" class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all flex items-center gap-1">
                    <i class="fas fa-plus"></i>
                    <span>Adicionar Questão</span>
                  </button>
                </div>

                <!-- Questions Cards -->
                <div class="space-y-4">
                  ${questoes.length === 0 ? `
                    <div class="bg-slate-50 rounded-2xl p-6 text-center border border-dashed border-slate-200">
                      <p class="text-xs text-slate-400">Nenhuma questão adicionada ainda.</p>
                      <button id="btn-quick-add-q-zero" class="mt-2 text-xs font-bold text-indigo-600 hover:underline">
                        Adicionar primeira questão
                      </button>
                    </div>
                  ` : questoes.map((q, idx) => {
                    const letters = ["A", "B", "C", "D"];

                    return `
                      <div class="p-4 sm:p-5 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-white transition-all space-y-3">
                        <div class="flex items-start justify-between gap-3">
                          <span class="w-6 h-6 rounded-lg bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                            ${idx + 1}
                          </span>
                          <div class="flex-1 font-semibold text-sm text-slate-800 leading-snug">
                            ${q.enunciado}
                          </div>
                          <button class="btn-delete-questao text-slate-400 hover:text-rose-600 p-1" data-id="${q.id}">
                            <i class="fas fa-trash-alt text-xs"></i>
                          </button>
                        </div>

                        <!-- Alternatives List -->
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pl-8">
                          ${q.alternativas.map((alt, optIdx) => {
                            const isCorrect = optIdx === q.resposta_correta_index;
                            return `
                              <div class="p-2.5 rounded-xl border flex items-start gap-2 ${
                                isCorrect 
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-semibold' 
                                  : 'bg-white border-slate-200 text-slate-600'
                              }">
                                <span class="font-bold ${isCorrect ? 'text-emerald-700' : 'text-slate-400'}">${letters[optIdx]}</span>
                                <span class="flex-1">${alt.replace(/^[A-D]\)\s*/, "")}</span>
                                ${isCorrect ? '<i class="fas fa-check text-emerald-600 text-xs"></i>' : ''}
                              </div>
                            `;
                          }).join("")}
                        </div>

                        <!-- Dica Amiga & Explicações Preview -->
                        <div class="pl-8 pt-1 flex flex-wrap gap-2 text-[11px]">
                          ${q.dica ? `
                            <span class="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                              💡 <strong>Dica:</strong> ${q.dica.substring(0, 50)}...
                            </span>
                          ` : ''}
                          ${q.explicacao ? `
                            <span class="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-100">
                              📖 <strong>Explicação:</strong> ${q.explicacao.substring(0, 50)}...
                            </span>
                          ` : ''}
                          ${q.por_que_errou && Object.keys(q.por_que_errou).length > 0 ? `
                            <span class="px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 border border-rose-200">
                              ⚠️ <strong>Pegadinhas cadastradas:</strong> ${Object.keys(q.por_que_errou).length}
                            </span>
                          ` : ''}
                        </div>
                      </div>
                    `;
                  }).join("")}
                </div>
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  }

  // --- TAB: MURAL DE RECADOS DA TURMA ---
  renderTabMuralTurma(turma) {
    const avisosTurma = window.schoolStorage.getAvisos(turma.id);

    return `
      <div class="space-y-6">
        <div class="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2">
              <i class="fas fa-comment-alt text-amber-500"></i>
              <span>Mural de Recados • ${turma.nome}</span>
            </h2>
            <p class="text-xs text-slate-500 mt-0.5">Mensagens diretas que os alunos desta turma verão ao entrar com o PIN.</p>
          </div>

          <button id="btn-novo-recado-turma" class="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-sm">
            <i class="fas fa-plus"></i>
            <span>Novo Recado para a Turma</span>
          </button>
        </div>

        <div class="space-y-3">
          ${avisosTurma.length === 0 ? `
            <div class="bg-white rounded-2xl p-8 border border-slate-200 text-center text-slate-400">
              <p class="text-xs">Nenhum recado publicado para esta turma.</p>
            </div>
          ` : avisosTurma.map(aviso => `
            <div class="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm flex items-start justify-between gap-4">
              <div>
                <div class="flex items-center gap-2 mb-1">
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    aviso.alcance === 'escola' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-800'
                  }">
                    ${aviso.alcance === 'escola' ? 'Aviso Geral da Escola' : 'Recado Exclusivo da Turma'}
                  </span>
                  <span class="text-xs text-slate-400">• ${aviso.data}</span>
                </div>
                <h3 class="text-sm font-bold text-slate-800">${aviso.titulo}</h3>
                <p class="text-xs text-slate-600 mt-1 leading-relaxed">${aviso.mensagem}</p>
                <span class="text-[11px] text-slate-400 mt-2 block">Assinado por: <strong>${aviso.autor}</strong></span>
              </div>
              <button class="btn-delete-recado text-slate-400 hover:text-rose-600 p-1.5" data-id="${aviso.id}" title="Excluir">
                <i class="fas fa-trash-alt text-xs"></i>
              </button>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  // --- TAB 4: MAPA DE CALOR & DIAGNÓSTICO (TEMPO REAL) ---
  renderTabDiagnostico(turma) {
    const atividades = window.schoolStorage.getAtividadesByTurma(turma.id);
    const activeAtiv = window.schoolStorage.getAtividadeById(this.activeAtividadeId) || (atividades[0] || null);

    if (!activeAtiv) {
      return `
        <div class="bg-white rounded-3xl p-10 border border-slate-200 text-center">
          <p class="text-sm font-semibold text-slate-600">Nenhuma atividade encontrada para gerar o mapa de calor.</p>
        </div>
      `;
    }

    const heatmap = window.schoolStorage.getAtividadeHeatmap(activeAtiv.id);
    const letters = ["A", "B", "C", "D"];

    return `
      <div class="space-y-6">
        <!-- Top Banner / Selector -->
        <div class="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span class="text-xs font-bold text-emerald-700 uppercase tracking-wider">Correção 100% Automática em Tempo Real</span>
            </div>
            <h2 class="text-xl font-bold text-slate-800 mt-1">Mapa de Calor & Diagnóstico de Aprendizagem</h2>
            <p class="text-xs text-slate-500 mt-0.5">
              Identifique instantaneamente onde a turma inteira teve dúvida sem precisar corrigir nenhuma folha em casa.
            </p>
          </div>

          <!-- Select Activity to diagnose -->
          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold text-slate-500 whitespace-nowrap">Atividade:</span>
            <select id="select-heatmap-ativ" class="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-600 cursor-pointer">
              ${atividades.map(at => `
                <option value="${at.id}" ${at.id === activeAtiv.id ? 'selected' : ''}>
                  ${at.titulo}
                </option>
              `).join("")}
            </select>
          </div>
        </div>

        <!-- Summary KPIs -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div class="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm">
            <span class="text-xs font-semibold text-slate-400 block">Total de Entregas</span>
            <div class="flex items-baseline gap-2 mt-1">
              <span class="text-2xl font-black text-slate-800">${heatmap.totalEntregas}</span>
              <span class="text-[11px] text-slate-500 font-medium">de ${heatmap.totalAlunos} alunos</span>
            </div>
          </div>

          <div class="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm">
            <span class="text-xs font-semibold text-slate-400 block">Taxa de Participação</span>
            <div class="flex items-baseline gap-2 mt-1">
              <span class="text-2xl font-black text-indigo-600">
                ${heatmap.totalAlunos > 0 ? Math.round((heatmap.totalEntregas / heatmap.totalAlunos) * 100) : 0}%
              </span>
            </div>
          </div>

          <div class="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm">
            <span class="text-xs font-semibold text-slate-400 block">Média de Acertos da Turma</span>
            <div class="flex items-baseline gap-2 mt-1">
              <span class="text-2xl font-black ${heatmap.mediaGeralAcertos >= 70 ? 'text-emerald-600' : 'text-amber-600'}">
                ${heatmap.mediaGeralAcertos}%
              </span>
            </div>
          </div>

          <div class="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm">
            <span class="text-xs font-semibold text-slate-400 block">Tempo de Correção</span>
            <div class="flex items-baseline gap-2 mt-1">
              <span class="text-2xl font-black text-emerald-600">0 min</span>
              <span class="text-[11px] text-emerald-700 font-semibold">100% Automático</span>
            </div>
          </div>
        </div>

        <!-- Section 1: Question Diagnostics & Pegadinhas Radar -->
        <div class="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-5">
          <div class="flex items-center justify-between">
            <h3 class="text-base font-bold text-slate-800 flex items-center gap-2">
              <i class="fas fa-radar text-indigo-600"></i>
              <span>Diagnóstico de Pegadinhas por Questão</span>
            </h3>
            <span class="text-xs text-slate-400">Foco pedagógico: o que revisar no início da próxima aula</span>
          </div>

          <div class="space-y-4">
            ${heatmap.questionDiagnostics.map(diag => {
              const q = diag.questao;
              const hasResponses = diag.totalRespostas > 0;
              const isAlert = hasResponses && diag.percentualAcerto < 60;
              const isWarning = hasResponses && diag.percentualAcerto >= 60 && diag.percentualAcerto < 80;

              return `
                <div class="p-5 rounded-2xl border ${
                  !hasResponses
                    ? 'border-slate-200 bg-white'
                    : (isAlert 
                        ? 'border-rose-300 bg-rose-50/30' 
                        : (isWarning ? 'border-amber-200 bg-amber-50/20' : 'border-slate-200 bg-white'))
                } transition-all space-y-3">
                  <!-- Question header & accuracy badge -->
                  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div class="flex items-start gap-2.5">
                      <span class="w-7 h-7 rounded-xl ${
                        !hasResponses
                          ? 'bg-slate-400 text-white'
                          : (isAlert ? 'bg-rose-600 text-white' : (isWarning ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white'))
                      } font-bold text-xs flex items-center justify-center shrink-0">
                        Q${diag.numero}
                      </span>
                      <p class="font-semibold text-sm text-slate-800 leading-snug">
                        ${q.enunciado}
                      </p>
                    </div>

                    <div class="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      <span class="px-3 py-1 rounded-full text-xs font-bold ${
                        !hasResponses
                          ? 'bg-slate-100 text-slate-500 border border-slate-200'
                          : (isAlert 
                              ? 'bg-rose-100 text-rose-800 border border-rose-200' 
                              : (isWarning ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-emerald-100 text-emerald-800 border border-emerald-200'))
                      }">
                        ${hasResponses ? `${diag.percentualAcerto}% de acerto (${diag.acertos}/${diag.totalRespostas})` : 'Aguardando respostas'}
                      </span>
                    </div>
                  </div>

                  <!-- Distribution bars for A, B, C, D -->
                  <div class="grid grid-cols-4 gap-2 pt-1 text-xs">
                    ${diag.distribuicao.map((count, optIdx) => {
                      const isCorrect = optIdx === q.resposta_correta_index;
                      const isTopTrap = optIdx === diag.piorDistratorIndex && count > 0;
                      const pct = diag.totalRespostas > 0 ? Math.round((count / diag.totalRespostas) * 100) : 0;

                      return `
                        <div class="p-2.5 rounded-xl border ${
                          isCorrect 
                            ? 'bg-emerald-50/80 border-emerald-300' 
                            : (isTopTrap ? 'bg-rose-50 border-rose-300' : 'bg-slate-50 border-slate-200')
                        }">
                          <div class="flex items-center justify-between mb-1">
                            <span class="font-bold ${isCorrect ? 'text-emerald-700' : (isTopTrap ? 'text-rose-700' : 'text-slate-600')}">
                              Alt ${letters[optIdx]} ${isCorrect ? '✓' : ''}
                            </span>
                            <span class="font-bold text-[11px] ${isCorrect ? 'text-emerald-800' : (isTopTrap ? 'text-rose-800' : 'text-slate-500')}">
                              ${pct}%
                            </span>
                          </div>
                          <div class="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                            <div class="${isCorrect ? 'bg-emerald-500' : (isTopTrap ? 'bg-rose-500' : 'bg-slate-400')} h-1.5 rounded-full" style="width: ${pct}%"></div>
                          </div>
                          <span class="text-[10px] text-slate-400 mt-1 block">${count} voto(s)</span>
                        </div>
                      `;
                    }).join("")}
                  </div>

                  <!-- Pedagogical Trap Alert Note -->
                  ${diag.piorDistratorIndex !== -1 && diag.maxDistratorCount > 0 ? `
                    <div class="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-start gap-2.5">
                      <i class="fas fa-exclamation-triangle text-amber-600 text-sm mt-0.5 shrink-0"></i>
                      <div>
                        <strong>Alerta da Pegadinha:</strong> Alternativa <strong>${letters[diag.piorDistratorIndex]}</strong> atraiu ${diag.maxDistratorCount} aluno(s).
                        ${diag.pegadinhaExplicacao ? `
                          <p class="mt-1 text-slate-700 font-medium">Motivo: "${diag.pegadinhaExplicacao}"</p>
                        ` : ''}
                        <p class="text-[11px] text-indigo-700 mt-1 font-semibold">
                          💡 Dica de aula: Inicie a aula de amanhã escrevendo no quadro essa pegadinha da alternativa ${letters[diag.piorDistratorIndex]}.
                        </p>
                      </div>
                    </div>
                  ` : ''}
                </div>
              `;
            }).join("")}
          </div>
        </div>

        <!-- Section 2: Student x Question Heatmap Matrix -->
        <div class="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-base font-bold text-slate-800 flex items-center gap-2">
              <i class="fas fa-th text-indigo-600"></i>
              <span>Grade de Correção Individual (Aluno x Questão)</span>
            </h3>
            <span class="text-xs text-slate-400">Verde = Acertou | Vermelho = Errou</span>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th class="px-4 py-3">Aluno</th>
                  <th class="px-4 py-3">Status</th>
                  ${heatmap.questionDiagnostics.map(d => `
                    <th class="px-3 py-3 text-center">Q${d.numero}</th>
                  `).join("")}
                  <th class="px-4 py-3 text-center">Nota Final</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${heatmap.alunosStatus.map(row => {
                  const aluno = row.aluno;

                  return `
                    <tr class="hover:bg-slate-50/60 transition-colors">
                      <td class="px-4 py-3 font-bold text-slate-800 whitespace-nowrap">
                        ${aluno.nome_completo}
                      </td>
                      <td class="px-4 py-3 whitespace-nowrap">
                        ${row.fez ? `
                          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            Entregue
                          </span>
                        ` : `
                          <span class="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
                            Pendente
                          </span>
                        `}
                      </td>
                      ${heatmap.questionDiagnostics.map(d => {
                        const cell = row.questoesMap[d.questao.id];
                        if (!cell || !cell.respondida) {
                          return `<td class="px-3 py-3 text-center text-slate-300">-</td>`;
                        }
                        if (cell.acertou) {
                          return `
                            <td class="px-3 py-3 text-center">
                              <span class="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 font-bold text-[11px]" title="Acertou!">
                                ✓
                              </span>
                            </td>
                          `;
                        } else {
                          return `
                            <td class="px-3 py-3 text-center">
                              <span class="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-rose-100 text-rose-700 font-bold text-[11px]" title="Marcou alternativa ${letters[cell.escolha]}">
                                ${letters[cell.escolha] || '✗'}
                              </span>
                            </td>
                          `;
                        }
                      }).join("")}
                      <td class="px-4 py-3 text-center whitespace-nowrap">
                        ${row.fez ? `
                          <span class="font-extrabold text-xs ${row.percentual >= 70 ? 'text-emerald-700' : 'text-amber-700'}">
                            ${row.percentual}% (${row.acertos}/${heatmap.questionDiagnostics.length})
                          </span>
                        ` : `<span class="text-slate-300">--</span>`}
                      </td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // --- PRINTABLE PIN TICKETS (FILIPETAS PARA OS ALUNOS) ---
  renderPrintableTickets(turma) {
    if (!turma) return "";
    const alunos = window.schoolStorage.getAlunosByTurma(turma.id);

    return `
      <div class="p-4">
        <div class="text-center mb-6 border-b pb-4">
          <h1 class="text-xl font-bold">🏫 Portal Escolar - Cartõezinhos de Acesso (PIN)</h1>
          <p class="text-sm text-gray-600">Turma: <strong>${turma.nome}</strong> • Disciplina: <strong>${turma.disciplina}</strong> • Prof(a): <strong>${turma.professor_nome}</strong></p>
          <p class="text-xs text-gray-500 mt-1">Oriente os alunos a acessarem o site e digitarem o Código da Turma e o PIN de 4 números.</p>
        </div>

        <div class="grid grid-cols-2 gap-4">
          ${alunos.map(aluno => `
            <div class="pin-ticket">
              <div class="flex items-center justify-between border-b pb-2 mb-2">
                <span class="font-bold text-sm text-indigo-700">🎒 Cartão de Acesso</span>
                <span class="text-[10px] text-gray-400">✂️ Recorte aqui</span>
              </div>
              <p class="text-xs text-gray-600 mb-0.5">Aluno(a):</p>
              <h3 class="text-base font-bold text-gray-900">${aluno.nome_completo}</h3>
              
              <div class="grid grid-cols-2 gap-2 mt-3 pt-2 bg-gray-50 p-2 rounded">
                <div>
                  <span class="text-[10px] text-gray-500 block uppercase">Código da Turma:</span>
                  <span class="font-mono font-bold text-sm text-indigo-900">${turma.codigo_acesso}</span>
                </div>
                <div>
                  <span class="text-[10px] text-gray-500 block uppercase">Seu PIN (4 Dígitos):</span>
                  <span class="font-mono font-bold text-base text-emerald-800">${aluno.pin_4_digitos}</span>
                </div>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  // --- BIND EVENTS ---
  bindTeacherEvents(turma) {
    // Select class dropdown
    const selectTurma = document.getElementById("select-active-turma");
    if (selectTurma) {
      selectTurma.addEventListener("change", (e) => {
        this.setActiveTurma(e.target.value);
      });
    }

    // Tabs
    document.querySelectorAll(".teacher-tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const tab = btn.getAttribute("data-tab");
        this.setTab(tab);
      });
    });

    // Select class from list cards
    document.querySelectorAll(".btn-select-turma").forEach(card => {
      card.addEventListener("click", () => {
        const id = card.getAttribute("data-id");
        this.setActiveTurma(id);
      });
    });

    // Print tickets
    const printBtns = [
      document.getElementById("btn-print-pin-tickets"),
      document.getElementById("btn-print-pin-tickets-2")
    ];
    printBtns.forEach(btn => {
      if (btn) {
        btn.addEventListener("click", () => {
          document.body.classList.add("printing-pin-tickets");
          window.print();
          setTimeout(() => document.body.classList.remove("printing-pin-tickets"), 1000);
        });
      }
    });

    // Modal Nova Turma
    const btnNovaTurma = document.getElementById("btn-open-modal-nova-turma");
    const btnQuickNewTurma = document.getElementById("btn-quick-new-turma");
    const btnCreateFirstTurma = document.getElementById("btn-create-first-turma");
    [btnNovaTurma, btnQuickNewTurma, btnCreateFirstTurma].forEach(btn => {
      if (btn) {
        btn.addEventListener("click", () => window.app.openModalNovaTurma());
      }
    });

    // Tab Alunos events
    const inputSearchRoster = document.getElementById("input-search-roster");
    if (inputSearchRoster) {
      inputSearchRoster.addEventListener("input", (e) => {
        this.searchTermAlunos = e.target.value;
        this.render();
      });
    }

    const btnAddAluno = document.getElementById("btn-modal-add-aluno");
    if (btnAddAluno && turma) {
      btnAddAluno.addEventListener("click", () => window.app.openModalNovoAluno(turma.id));
    }

    const btnBatchAlunos = document.getElementById("btn-modal-batch-alunos");
    if (btnBatchAlunos && turma) {
      btnBatchAlunos.addEventListener("click", () => window.app.openModalBatchAlunos(turma.id));
    }

    document.querySelectorAll(".btn-reset-pin").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        this.handleResetPin(id);
      });
    });

    document.querySelectorAll(".btn-delete-aluno").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        this.handleDeleteAluno(id);
      });
    });

    document.querySelectorAll(".btn-copy-pin").forEach(btn => {
      btn.addEventListener("click", () => {
        const pin = btn.getAttribute("data-pin");
        navigator.clipboard.writeText(pin).then(() => {
          window.app.showToast(`PIN ${pin} copiado para a área de transferência!`, "success");
        });
      });
    });

    // Tab Atividades events
    const btnNovaAtiv = document.getElementById("btn-modal-nova-atividade");
    if (btnNovaAtiv && turma) {
      btnNovaAtiv.addEventListener("click", () => window.app.openModalNovaAtividade(turma.id));
    }

    document.querySelectorAll(".activity-selector-card").forEach(card => {
      card.addEventListener("click", () => {
        this.activeAtividadeId = card.getAttribute("data-id");
        this.render();
      });
    });

    document.querySelectorAll(".btn-toggle-active-ativ").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        window.schoolStorage.toggleAtividadeStatus(id);
        this.render();
      });
    });

    document.querySelectorAll(".btn-duplicate-this-ativ").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        window.app.openModalDuplicateAtividade(id);
      });
    });

    const btnDuplicateCurrentAtiv = document.getElementById("btn-duplicate-current-ativ");
    if (btnDuplicateCurrentAtiv && this.activeAtividadeId) {
      btnDuplicateCurrentAtiv.addEventListener("click", () => {
        window.app.openModalDuplicateAtividade(this.activeAtividadeId);
      });
    }

    document.querySelectorAll(".btn-delete-this-ativ").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        this.handleDeleteAtividade(id);
      });
    });

    const btnAddQuestao = document.getElementById("btn-modal-add-questao");
    const btnQuickAddQZero = document.getElementById("btn-quick-add-q-zero");
    [btnAddQuestao, btnQuickAddQZero].forEach(btn => {
      if (btn && this.activeAtividadeId) {
        btn.addEventListener("click", () => window.app.openModalNovaQuestao(this.activeAtividadeId));
      }
    });

    document.querySelectorAll(".btn-delete-questao").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        this.handleDeleteQuestao(id);
      });
    });

    // Tab Diagnostico events
    const selectHeatmapAtiv = document.getElementById("select-heatmap-ativ");
    if (selectHeatmapAtiv) {
      selectHeatmapAtiv.addEventListener("change", (e) => {
        this.activeAtividadeId = e.target.value;
        this.render();
      });
    }

    // Tab Frequência events
    const inputFreqDate = document.getElementById("input-freq-date");
    if (inputFreqDate) {
      inputFreqDate.addEventListener("change", (e) => {
        this.selectedFreqData = e.target.value;
        this.render();
      });
    }

    document.querySelectorAll(".btn-toggle-freq").forEach(btn => {
      btn.addEventListener("click", () => {
        const alunoId = btn.getAttribute("data-id");
        const val = btn.getAttribute("data-val");
        if (!this.tempPresencas) this.tempPresencas = {};
        this.tempPresencas[alunoId] = val;
        this.render();
      });
    });

    const btnAllPresent = document.getElementById("btn-all-present");
    if (btnAllPresent && turma) {
      btnAllPresent.addEventListener("click", () => {
        const alunos = window.schoolStorage.getAlunosByTurma(turma.id);
        if (!this.tempPresencas) this.tempPresencas = {};
        alunos.forEach(a => {
          this.tempPresencas[a.id] = "P";
        });
        window.app.showToast("Todos marcados como Presentes!", "info");
        this.render();
      });
    }

    const btnSaveFreq = document.getElementById("btn-save-frequencia");
    if (btnSaveFreq && turma) {
      btnSaveFreq.addEventListener("click", () => {
        const dateStr = this.selectedFreqData || new Date().toISOString().split("T")[0];
        window.schoolStorage.saveFrequencia(turma.id, dateStr, this.tempPresencas);
        window.app.showToast(`Frequência do dia ${dateStr} salva com sucesso!`, "success");
        this.render();
      });
    }

    // Tab Mural da Turma events
    const btnNovoRecado = document.getElementById("btn-novo-recado-turma");
    if (btnNovoRecado && turma) {
      btnNovoRecado.addEventListener("click", () => {
        window.app.openModalNovoAviso(turma.id);
      });
    }

    document.querySelectorAll(".btn-delete-recado").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        if (confirm("Remover este recado da turma?")) {
          window.schoolStorage.deleteAviso(id);
          window.app.showToast("Recado removido.", "info");
          this.render();
        }
      });
    });
  }
}

window.teacherController = new TeacherController();
