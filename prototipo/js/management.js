// Management & Direction Controller for Sistema de Questões Escolar (SaberPontual)

class ManagementController {
  constructor() {
    this.currentTab = "visao-geral"; // "visao-geral", "professores", "mural", "conselho"
    this.activeConselhoTurmaId = null;
  }

  init() {
    const turmas = window.schoolStorage.getTurmas();
    if (!this.activeConselhoTurmaId && turmas.length > 0) {
      this.activeConselhoTurmaId = turmas[0].id;
    }
    this.render();
  }

  setTab(tab) {
    this.currentTab = tab;
    this.render();
  }

  setActiveConselhoTurma(turmaId) {
    this.activeConselhoTurmaId = turmaId;
    this.render();
  }

  // --- ACTIONS ---
  handleSaveEscola(config) {
    window.schoolStorage.saveEscola(config);
    window.app.showToast("Dados institucionais da escola atualizados com sucesso!", "success");
    this.render();
  }

  handleCreateProfessor(profData) {
    window.schoolStorage.saveProfessor(profData);
    window.app.showToast(`Professor(a) ${profData.nome} cadastrado(a) com sucesso!`, "success");
    this.render();
  }

  handleDeleteProfessor(profId) {
    if (confirm("Deseja realmente remover este professor do quadro docente?")) {
      window.schoolStorage.deleteProfessor(profId);
      window.app.showToast("Professor removido.", "info");
      this.render();
    }
  }

  handleCreateAviso(avisoData) {
    window.schoolStorage.saveAviso(avisoData);
    window.app.showToast("Comunicado escolar publicado no mural!", "success");
    this.render();
  }

  handleDeleteAviso(avisoId) {
    if (confirm("Deseja remover este comunicado do mural?")) {
      window.schoolStorage.deleteAviso(avisoId);
      window.app.showToast("Comunicado removido.", "info");
      this.render();
    }
  }

  // --- RENDER MAIN ---
  render() {
    const container = document.getElementById("management-view-container");
    if (!container) return;

    const escola = window.schoolStorage.getEscola();

    container.innerHTML = `
      <div class="max-w-6xl mx-auto pt-4 pb-20 px-4">
        <!-- Top Institutional Header -->
        <div class="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-5 sm:p-6 text-white shadow-lg mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-indigo-900/50">
          <div class="flex items-center gap-4">
            <div class="w-14 h-14 rounded-2xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-3xl font-black shadow-inner">
              🏛️
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="text-[11px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 px-2.5 py-0.5 rounded-full border border-indigo-400/20">
                  Direção & Coordenação Pedagógica
                </span>
                <span class="text-xs text-slate-400">• ${escola.ano_letivo} (${escola.bimestre_ativo})</span>
              </div>
              <h1 class="text-xl sm:text-2xl font-bold mt-1 tracking-tight text-white">${escola.nome}</h1>
              <p class="text-xs text-slate-300 mt-0.5">Diretor(a): ${escola.diretor_nome || 'Direção'} • Coordenação: ${escola.coordenador_nome || 'Pedagógica'}</p>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <button id="btn-modal-config-escola" class="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white font-semibold text-xs transition-all flex items-center gap-1.5 border border-white/10">
              <i class="fas fa-sliders-h text-indigo-300"></i>
              <span>Configurações da Escola</span>
            </button>
            <button id="btn-print-conselho" class="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-semibold text-xs transition-all flex items-center gap-1.5 shadow-md shadow-indigo-900/50">
              <i class="fas fa-print"></i>
              <span>Imprimir Relatório Geral</span>
            </button>
          </div>
        </div>

        <!-- Tab Navigation Buttons -->
        <div class="flex border-b border-slate-200 mb-6 gap-2 sm:gap-4 overflow-x-auto pb-1">
          <button class="mgmt-tab-btn py-3 px-4 font-bold text-xs sm:text-sm rounded-t-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            this.currentTab === "visao-geral" 
              ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' 
              : 'text-slate-500 hover:text-slate-800'
          }" data-tab="visao-geral">
            <i class="fas fa-chart-pie"></i>
            <span>Visão Geral & Indicadores</span>
          </button>

          <button class="mgmt-tab-btn py-3 px-4 font-bold text-xs sm:text-sm rounded-t-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            this.currentTab === "professores" 
              ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' 
              : 'text-slate-500 hover:text-slate-800'
          }" data-tab="professores">
            <i class="fas fa-chalkboard-teacher"></i>
            <span>Corpo Docente (Professores)</span>
          </button>

          <button class="mgmt-tab-btn py-3 px-4 font-bold text-xs sm:text-sm rounded-t-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            this.currentTab === "mural" 
              ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' 
              : 'text-slate-500 hover:text-slate-800'
          }" data-tab="mural">
            <i class="fas fa-bullhorn text-amber-500"></i>
            <span>Mural Institucional de Avisos</span>
          </button>

          <button class="mgmt-tab-btn py-3 px-4 font-bold text-xs sm:text-sm rounded-t-xl transition-all flex items-center gap-2 whitespace-nowrap ${
            this.currentTab === "conselho" 
              ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50' 
              : 'text-slate-500 hover:text-slate-800'
          }" data-tab="conselho">
            <i class="fas fa-users-cog text-emerald-600"></i>
            <span>Conselho de Classe & Ata</span>
          </button>
        </div>

        <!-- Tab Body Content -->
        <div id="mgmt-tab-content">
          ${this.renderTabContent()}
        </div>
      </div>
    `;

    this.bindEvents();
  }

  renderTabContent() {
    switch (this.currentTab) {
      case "visao-geral":
        return this.renderTabVisaoGeral();
      case "professores":
        return this.renderTabProfessores();
      case "mural":
        return this.renderTabMural();
      case "conselho":
        return this.renderTabConselho();
      default:
        return this.renderTabVisaoGeral();
    }
  }

  // --- TAB 1: VISÃO GERAL & INDICADORES ---
  renderTabVisaoGeral() {
    const stats = window.schoolStorage.getEscolaOverviewStats();
    const escola = window.schoolStorage.getEscola();

    return `
      <div class="space-y-6">
        <!-- Top KPIs -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div class="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm">
            <span class="text-xs font-semibold text-slate-400 block">Alunos Matriculados</span>
            <div class="flex items-baseline gap-2 mt-1">
              <span class="text-2xl font-black text-slate-800">${stats.totalAlunos}</span>
              <span class="text-[11px] text-emerald-600 font-semibold">100% com PIN</span>
            </div>
          </div>

          <div class="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm">
            <span class="text-xs font-semibold text-slate-400 block">Corpo Docente</span>
            <div class="flex items-baseline gap-2 mt-1">
              <span class="text-2xl font-black text-slate-800">${stats.totalProfessores}</span>
              <span class="text-[11px] text-indigo-600 font-semibold">Professores</span>
            </div>
          </div>

          <div class="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm">
            <span class="text-xs font-semibold text-slate-400 block">Turmas em Funcionamento</span>
            <div class="flex items-baseline gap-2 mt-1">
              <span class="text-2xl font-black text-slate-800">${stats.totalTurmas}</span>
              <span class="text-[11px] text-indigo-600 font-semibold">Turmas</span>
            </div>
          </div>

          <div class="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm">
            <span class="text-xs font-semibold text-slate-400 block">Aproveitamento Global da Escola</span>
            <div class="flex items-baseline gap-2 mt-1">
              <span class="text-2xl font-black ${stats.mediaGeralEscola >= 70 ? 'text-emerald-600' : 'text-amber-600'}">
                ${stats.mediaGeralEscola}%
              </span>
              <span class="text-[11px] text-slate-400">${stats.totalRespostas} respostas</span>
            </div>
          </div>
        </div>

        <!-- Segments Distribution -->
        <div class="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-sm">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-base font-bold text-slate-800 flex items-center gap-2">
              <i class="fas fa-layer-group text-indigo-600"></i>
              <span>Distribuição da Escola por Segmento de Ensino</span>
            </h3>
            <span class="text-xs text-slate-400">${escola.bimestre_ativo} • Ano ${escola.ano_letivo}</span>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="p-5 rounded-2xl bg-slate-50 border border-slate-200/80">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-bold text-indigo-900 uppercase">Fundamental I (1º ao 5º)</span>
                <span class="text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">${stats.segmentos.fund1.turmas} Turmas</span>
              </div>
              <p class="text-2xl font-black text-slate-800 mt-2">${stats.segmentos.fund1.alunos} <span class="text-xs font-normal text-slate-500">alunos</span></p>
              <p class="text-[11px] text-slate-400 mt-1">Foco: alfabetização, leitura e operações básicas</p>
            </div>

            <div class="p-5 rounded-2xl bg-indigo-50/50 border border-indigo-200/80">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-bold text-indigo-950 uppercase">Fundamental II (6º ao 9º)</span>
                <span class="text-xs font-bold text-indigo-700 bg-indigo-200 px-2 py-0.5 rounded-full">${stats.segmentos.fund2.turmas} Turmas</span>
              </div>
              <p class="text-2xl font-black text-slate-800 mt-2">${stats.segmentos.fund2.alunos} <span class="text-xs font-normal text-slate-500">alunos</span></p>
              <p class="text-[11px] text-slate-500 mt-1">Foco: interpretação, raciocínio lógico e diagnóstico de pegadinhas</p>
            </div>

            <div class="p-5 rounded-2xl bg-slate-50 border border-slate-200/80">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-bold text-indigo-900 uppercase">Ensino Médio (1º ao 3º)</span>
                <span class="text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">${stats.segmentos.medio.turmas} Turmas</span>
              </div>
              <p class="text-2xl font-black text-slate-800 mt-2">${stats.segmentos.medio.alunos} <span class="text-xs font-normal text-slate-500">alunos</span></p>
              <p class="text-[11px] text-slate-400 mt-1">Foco: preparação para vestibulares e aprofundamento</p>
            </div>
          </div>
        </div>

        <!-- Strategy Box for Director Presentation -->
        <div class="bg-gradient-to-r from-slate-900 to-indigo-900 rounded-3xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white/20 text-indigo-200 mb-2">
              💡 Benefício Estratégico para a Gestão
            </span>
            <h3 class="text-lg font-bold">Diagnóstico em tempo real para tomada de decisões pedagógicas</h3>
            <p class="text-xs text-indigo-200 mt-1 max-w-xl">
              A direção não precisa esperar o final do bimestre para descobrir quais matérias ou turmas estão com dificuldades. O mapa de calor aponta o alerta pedagógico na mesma semana.
            </p>
          </div>
          <button id="btn-quick-to-conselho" class="px-5 py-2.5 rounded-xl bg-white text-slate-900 hover:bg-slate-100 font-bold text-xs transition-all shadow-sm shrink-0">
            Ver Conselho de Classe
          </button>
        </div>
      </div>
    `;
  }

  // --- TAB 2: CORPO DOCENTE (PROFESSORES) ---
  renderTabProfessores() {
    const professores = window.schoolStorage.getProfessores();
    const turmas = window.schoolStorage.getTurmas();

    return `
      <div class="space-y-6">
        <div class="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2">
              <i class="fas fa-chalkboard-teacher text-indigo-600"></i>
              <span>Corpo Docente da Escola</span>
            </h2>
            <p class="text-xs text-slate-500 mt-0.5">Gerencie os professores cadastrados e as turmas atribuídas a cada disciplina.</p>
          </div>

          <button id="btn-modal-novo-professor" class="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-sm">
            <i class="fas fa-user-plus"></i>
            <span>Cadastrar Professor</span>
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          ${professores.map(prof => {
            const turmasAtribuidas = (prof.turmas_ids || []).map(tId => turmas.find(t => t.id === tId)).filter(Boolean);

            return `
              <div class="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm hover:border-indigo-300 transition-all flex flex-col justify-between">
                <div>
                  <div class="flex items-start justify-between gap-3">
                    <div class="flex items-center gap-3">
                      <div class="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-700 font-bold text-base flex items-center justify-center">
                        ${prof.nome.substring(prof.nome.indexOf(" ") + 1, prof.nome.indexOf(" ") + 3).toUpperCase() || 'PR'}
                      </div>
                      <div>
                        <h3 class="text-sm font-bold text-slate-800">${prof.nome}</h3>
                        <span class="text-xs text-indigo-600 font-semibold">${prof.especialidade}</span>
                      </div>
                    </div>

                    <button class="btn-delete-prof text-slate-400 hover:text-rose-600 p-1.5 transition-colors" data-id="${prof.id}" title="Remover Professor">
                      <i class="fas fa-trash-alt text-xs"></i>
                    </button>
                  </div>

                  <p class="text-[11px] text-slate-400 mt-3 flex items-center gap-1.5">
                    <i class="far fa-envelope"></i>
                    <span>${prof.email}</span>
                  </p>
                </div>

                <div class="mt-4 pt-3 border-t border-slate-100">
                  <span class="text-[10px] uppercase font-bold text-slate-400 tracking-wider block mb-1.5">Turmas Atribuídas:</span>
                  <div class="flex flex-wrap gap-1.5">
                    ${turmasAtribuidas.length === 0 ? `
                      <span class="text-xs text-slate-400 italic">Nenhuma turma vinculada</span>
                    ` : turmasAtribuidas.map(t => `
                      <span class="px-2 py-0.5 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-800 text-[11px] font-semibold">
                        ${t.nome} (${t.disciplina})
                      </span>
                    `).join("")}
                  </div>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  // --- TAB 3: MURAL INSTITUCIONAL DE AVISOS ---
  renderTabMural() {
    const avisos = window.schoolStorage.getAvisos();
    const turmas = window.schoolStorage.getTurmas();

    return `
      <div class="space-y-6">
        <div class="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2">
              <i class="fas fa-bullhorn text-amber-500"></i>
              <span>Mural Institucional de Avisos</span>
            </h2>
            <p class="text-xs text-slate-500 mt-0.5">Os comunicados cadastrados aparecem imediatamente na entrada do portal dos alunos.</p>
          </div>

          <button id="btn-modal-novo-aviso" class="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-sm">
            <i class="fas fa-plus"></i>
            <span>Novo Comunicado</span>
          </button>
        </div>

        <div class="space-y-3">
          ${avisos.length === 0 ? `
            <div class="bg-white rounded-2xl p-8 border border-slate-200 text-center text-slate-400">
              <p class="text-xs">Nenhum comunicado publicado no momento.</p>
            </div>
          ` : avisos.map(aviso => {
            const isEscola = aviso.alcance === "escola";
            const targetTurma = !isEscola ? turmas.find(t => t.id === aviso.alcance) : null;
            const targetLabel = isEscola ? "Toda a Escola" : (targetTurma ? `Turma ${targetTurma.nome}` : "Turma");

            const priorityBadge = aviso.prioridade === "alta"
              ? '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">Alta Prioridade</span>'
              : '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">Informativo</span>';

            return `
              <div class="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm flex flex-col sm:flex-row sm:items-start justify-between gap-4 hover:border-slate-300 transition-all">
                <div class="space-y-1.5 flex-1">
                  <div class="flex items-center gap-2">
                    ${priorityBadge}
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                      Alcance: ${targetLabel}
                    </span>
                    <span class="text-xs text-slate-400">• ${aviso.data}</span>
                  </div>

                  <h3 class="text-sm sm:text-base font-bold text-slate-800">${aviso.titulo}</h3>
                  <p class="text-xs text-slate-600 leading-relaxed">${aviso.mensagem}</p>
                  <p class="text-[11px] text-slate-400 font-medium">Publicado por: <strong>${aviso.autor}</strong></p>
                </div>

                <button class="btn-delete-aviso text-slate-400 hover:text-rose-600 p-1.5 self-start transition-colors" data-id="${aviso.id}" title="Excluir Comunicado">
                  <i class="fas fa-trash-alt text-xs"></i>
                </button>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  // --- TAB 4: CONSELHO DE CLASSE & ATA ---
  renderTabConselho() {
    const turmas = window.schoolStorage.getTurmas();
    const activeTurma = turmas.find(t => t.id === this.activeConselhoTurmaId) || turmas[0];

    if (!activeTurma) {
      return `
        <div class="bg-white rounded-3xl p-8 border border-slate-200 text-center">
          <p class="text-xs text-slate-400">Nenhuma turma cadastrada para gerar o Conselho de Classe.</p>
        </div>
      `;
    }

    const conselho = window.schoolStorage.getConselhoClasseStats(activeTurma.id);

    return `
      <div class="space-y-6">
        <!-- Turma Selector & Header -->
        <div class="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2">
              <i class="fas fa-users-cog text-emerald-600"></i>
              <span>Conselho de Classe • Ata Pedagógica</span>
            </h2>
            <p class="text-xs text-slate-500 mt-0.5">Diagnóstico consolidado de notas formativas e frequência da turma.</p>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold text-slate-500 whitespace-nowrap">Turma:</span>
            <select id="select-conselho-turma" class="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-600 cursor-pointer">
              ${turmas.map(t => `
                <option value="${t.id}" ${t.id === activeTurma.id ? 'selected' : ''}>
                  ${t.nome} - ${t.disciplina} (${t.serie_ano})
                </option>
              `).join("")}
            </select>
          </div>
        </div>

        <!-- Class KPI Summary -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <span class="text-xs text-slate-400 font-semibold block">Total de Alunos</span>
            <span class="text-2xl font-black text-slate-800 mt-1 block">${conselho.totalAlunos}</span>
          </div>

          <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <span class="text-xs text-slate-400 font-semibold block">Listas Avaliativas</span>
            <span class="text-2xl font-black text-indigo-700 mt-1 block">${conselho.totalAtividades}</span>
          </div>

          <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <span class="text-xs text-slate-400 font-semibold block">Média de Aproveitamento</span>
            <span class="text-2xl font-black ${conselho.mediaGeralTurma >= 70 ? 'text-emerald-600' : 'text-amber-600'} mt-1 block">
              ${conselho.mediaGeralTurma}%
            </span>
          </div>

          <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <span class="text-xs text-slate-400 font-semibold block">Média de Frequência</span>
            <span class="text-2xl font-black text-slate-800 mt-1 block">${conselho.mediaFrequenciaTurma}%</span>
          </div>
        </div>

        <!-- Council Table -->
        <div class="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs">
              <thead class="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th class="px-4 py-3.5">Nº</th>
                  <th class="px-4 py-3.5">Nome do Aluno</th>
                  <th class="px-4 py-3.5 text-center">Frequência (%)</th>
                  <th class="px-4 py-3.5 text-center">Listas Entregues</th>
                  <th class="px-4 py-3.5 text-center">Média de Acertos</th>
                  <th class="px-4 py-3.5">Parecer Pedagógico do Conselho</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                ${conselho.relatorioAlunos.map(row => `
                  <tr class="hover:bg-slate-50/60 transition-colors">
                    <td class="px-4 py-3 text-slate-400 font-medium">${row.numero}</td>
                    <td class="px-4 py-3 font-bold text-slate-800">${row.aluno.nome_completo}</td>
                    <td class="px-4 py-3 text-center">
                      <span class="font-bold ${row.freq.percentual >= 75 ? 'text-slate-700' : 'text-rose-600 font-black'}">
                        ${row.freq.percentual}%
                      </span>
                      <span class="text-[10px] text-slate-400 block">${row.freq.presencas}/${row.freq.totalDias} dias</span>
                    </td>
                    <td class="px-4 py-3 text-center">
                      <span class="font-semibold text-slate-700">${row.ativConcluidas} de ${row.totalAtividades}</span>
                    </td>
                    <td class="px-4 py-3 text-center">
                      <span class="font-extrabold text-sm ${row.mediaNota >= 70 ? 'text-emerald-700' : (row.mediaNota >= 60 ? 'text-indigo-700' : 'text-rose-700')}">
                        ${row.mediaNota}%
                      </span>
                    </td>
                    <td class="px-4 py-3">
                      <span class="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${row.badgeClass}">
                        ${row.situacao}
                      </span>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // --- BIND EVENTS ---
  bindEvents() {
    // Tabs
    document.querySelectorAll(".mgmt-tab-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        this.setTab(btn.getAttribute("data-tab"));
      });
    });

    const btnConfig = document.getElementById("btn-modal-config-escola");
    if (btnConfig) {
      btnConfig.addEventListener("click", () => window.app.openModalConfigEscola());
    }

    const btnPrint = document.getElementById("btn-print-conselho");
    if (btnPrint) {
      btnPrint.addEventListener("click", () => window.print());
    }

    const btnNovoProf = document.getElementById("btn-modal-novo-professor");
    if (btnNovoProf) {
      btnNovoProf.addEventListener("click", () => window.app.openModalNovoProfessor());
    }

    const btnNovoAviso = document.getElementById("btn-modal-novo-aviso");
    if (btnNovoAviso) {
      btnNovoAviso.addEventListener("click", () => window.app.openModalNovoAviso());
    }

    const btnQuickConselho = document.getElementById("btn-quick-to-conselho");
    if (btnQuickConselho) {
      btnQuickConselho.addEventListener("click", () => this.setTab("conselho"));
    }

    document.querySelectorAll(".btn-delete-prof").forEach(btn => {
      btn.addEventListener("click", () => {
        this.handleDeleteProfessor(btn.getAttribute("data-id"));
      });
    });

    document.querySelectorAll(".btn-delete-aviso").forEach(btn => {
      btn.addEventListener("click", () => {
        this.handleDeleteAviso(btn.getAttribute("data-id"));
      });
    });

    const selectConselho = document.getElementById("select-conselho-turma");
    if (selectConselho) {
      selectConselho.addEventListener("change", (e) => {
        this.setActiveConselhoTurma(e.target.value);
      });
    }
  }
}

window.managementController = new ManagementController();
