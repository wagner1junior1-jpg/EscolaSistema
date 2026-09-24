// Student Flow Controller for Sistema de Questões Escolar

class StudentController {
  constructor() {
    this.currentStep = 1; // 1: Code, 2: Select Student, 3: PIN, 4: Dashboard, 5: Quiz Player, 6: Quiz Finished
    this.selectedTurma = null;
    this.selectedAluno = null;
    this.activeAtividade = null;
    this.activeQuestoes = [];
    this.currentQuestaoIndex = 0;
    this.currentSelection = null; // option index selected
    this.feedbackState = null; // null or { acertou, explicacao, pegadinha }
    this.audioEnabled = true;
    this.isParentView = false;

    this.initAudio();
  }

  initAudio() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    } catch (e) {
      this.audioCtx = null;
    }
  }

  playSound(type) {
    if (!this.audioEnabled || !this.audioCtx) return;
    try {
      if (this.audioCtx.state === "suspended") {
        this.audioCtx.resume();
      }
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      const now = this.audioCtx.currentTime;
      if (type === "correct") {
        // Joyful major arpeggio
        osc.type = "sine";
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      } else if (type === "wrong") {
        // Soft encouraging lower tone
        osc.type = "triangle";
        osc.frequency.setValueAtTime(329.63, now); // E4
        osc.frequency.setValueAtTime(293.66, now + 0.12); // D4
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else if (type === "click") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(600, now);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
        osc.start(now);
        osc.stop(now + 0.06);
      } else if (type === "hint") {
        osc.type = "sine";
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(880, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
      }
    } catch (e) {
      // Audio not permitted or interrupted, ignore gracefully
    }
  }

  init() {
    this.checkExistingSession();
    this.render();
  }

  checkExistingSession() {
    const session = window.schoolStorage.getCurrentStudentSession();
    if (session && session.aluno && session.turma) {
      // Validate still exists in db
      const aluno = window.schoolStorage.getAlunoById(session.aluno.id);
      const turma = window.schoolStorage.getTurmaById(session.turma.id);
      if (aluno && turma) {
        this.selectedAluno = aluno;
        this.selectedTurma = turma;
        this.currentStep = 4; // Dashboard
        return;
      }
    }
    this.currentStep = 1; // Step 1: Class code
  }

  logout() {
    window.schoolStorage.clearStudentSession();
    this.selectedTurma = null;
    this.selectedAluno = null;
    this.activeAtividade = null;
    this.currentStep = 1;
    this.render();
  }

  // --- ACTIONS ---
  handleEnterClassCode(code) {
    const turma = window.schoolStorage.getTurmaByCodigo(code);
    if (!turma) {
      window.app.showToast("Turma não encontrada. Verifique o código e tente novamente.", "error");
      return;
    }
    this.selectedTurma = turma;
    this.currentStep = 2; // Select student
    this.render();
  }

  handleSelectStudent(alunoId) {
    const aluno = window.schoolStorage.getAlunoById(alunoId);
    if (!aluno) return;
    this.selectedAluno = aluno;
    this.currentStep = 3; // PIN
    this.render();
  }

  handleVerifyPin(pinInput) {
    if (!this.selectedAluno) return;
    const cleanPin = pinInput.trim();
    if (cleanPin === this.selectedAluno.pin_4_digitos) {
      this.playSound("correct");
      window.schoolStorage.setCurrentStudentSession(this.selectedAluno, this.selectedTurma);
      window.app.showToast(`Bem-vindo(a), ${this.selectedAluno.nome_completo}!`, "success");
      this.currentStep = 4; // Dashboard
      this.render();
    } else {
      this.playSound("wrong");
      window.app.showToast("PIN incorreto! Peça ajuda à sua professora se tiver esquecido.", "error");
    }
  }

  loadQuestionState(index) {
    this.currentQuestaoIndex = index;
    const q = this.activeQuestoes[index];
    const prevResp = window.schoolStorage.getRespostasByAluno(this.selectedAluno.id, this.activeAtividade.id)
      .find(r => r.questao_id === q.id);

    if (prevResp) {
      this.currentSelection = prevResp.alternativa_escolhida;
      this.feedbackState = {
        acertou: prevResp.acertou,
        escolha: prevResp.alternativa_escolhida,
        correta: q.resposta_correta_index,
        explicacao: q.explicacao,
        pegadinha: !prevResp.acertou && q.por_que_errou ? q.por_que_errou[prevResp.alternativa_escolhida.toString()] : null
      };
    } else {
      this.currentSelection = null;
      this.feedbackState = null;
    }
  }

  handleStartAtividade(atividadeId) {
    const ativ = window.schoolStorage.getAtividadeById(atividadeId);
    if (!ativ) return;

    const questoes = window.schoolStorage.getQuestoesByAtividade(atividadeId);
    if (!questoes.length) {
      window.app.showToast("Esta atividade ainda não possui questões cadastradas.", "info");
      return;
    }

    this.activeAtividade = ativ;
    this.activeQuestoes = questoes;

    // Find first unanswered question or resume from 0 if all answered
    const resps = window.schoolStorage.getRespostasByAluno(this.selectedAluno.id, ativ.id);
    let targetIdx = 0;
    const firstUnanswered = questoes.findIndex(q => !resps.some(r => r.questao_id === q.id));
    if (firstUnanswered !== -1) {
      targetIdx = firstUnanswered;
    }

    this.loadQuestionState(targetIdx);
    this.currentStep = 5; // Quiz player
    this.render();
  }

  handleSelectOption(optionIndex) {
    if (this.feedbackState) return; // Already submitted this question
    this.playSound("click");
    this.currentSelection = optionIndex;
    this.render();
  }

  handleSubmitAnswer() {
    if (this.currentSelection === null) {
      window.app.showToast("Selecione uma alternativa antes de confirmar!", "warning");
      return;
    }

    const questao = this.activeQuestoes[this.currentQuestaoIndex];
    const isCorrect = this.currentSelection === questao.resposta_correta_index;

    // Save response immediately in DB
    window.schoolStorage.saveResposta({
      atividade_id: this.activeAtividade.id,
      questao_id: questao.id,
      aluno_id: this.selectedAluno.id,
      alternativa_escolhida: this.currentSelection,
      acertou: isCorrect
    });

    if (isCorrect) {
      this.playSound("correct");
    } else {
      this.playSound("wrong");
    }

    // Set feedback state for immediate pedagogical explanation
    this.feedbackState = {
      acertou: isCorrect,
      escolha: this.currentSelection,
      correta: questao.resposta_correta_index,
      explicacao: questao.explicacao,
      pegadinha: !isCorrect && questao.por_que_errou ? questao.por_que_errou[this.currentSelection.toString()] : null
    };

    this.render();
  }

  handleNextQuestion() {
    if (this.currentQuestaoIndex < this.activeQuestoes.length - 1) {
      this.loadQuestionState(this.currentQuestaoIndex + 1);
      this.render();
    } else {
      // Activity completed!
      this.playSound("correct");
      this.currentStep = 6; // Results screen
      this.render();
    }
  }

  handlePrevQuestion() {
    if (this.currentQuestaoIndex > 0) {
      this.loadQuestionState(this.currentQuestaoIndex - 1);
      this.render();
    }
  }

  // --- RENDERING ---
  render() {
    const container = document.getElementById("student-view-container");
    if (!container) return;

    switch (this.currentStep) {
      case 1:
        container.innerHTML = this.renderStepCode();
        this.bindStepCodeEvents();
        break;
      case 2:
        container.innerHTML = this.renderStepStudentPicker();
        this.bindStepStudentPickerEvents();
        break;
      case 3:
        container.innerHTML = this.renderStepPin();
        this.bindStepPinEvents();
        break;
      case 4:
        container.innerHTML = this.renderStepDashboard();
        this.bindStepDashboardEvents();
        break;
      case 5:
        container.innerHTML = this.renderStepQuizPlayer();
        this.bindStepQuizEvents();
        break;
      case 6:
        container.innerHTML = this.renderStepQuizFinished();
        this.bindStepQuizFinishedEvents();
        break;
    }
  }

  // STEP 1: CÓDIGO DA TURMA
  renderStepCode() {
    const turmas = window.schoolStorage.getTurmas();

    return `
      <div class="max-w-md mx-auto pt-6 pb-12 px-4">
        <!-- Logo & Header -->
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200 mb-3">
            <i class="fas fa-graduation-cap text-3xl"></i>
          </div>
          <h1 class="text-2xl font-bold text-slate-800 tracking-tight">Portal do Aluno</h1>
          <p class="text-slate-500 text-sm mt-1">Acesso direto sem necessidade de e-mail ou cadastro</p>
        </div>

        <!-- Form Card -->
        <div class="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100">
          <label class="block text-sm font-semibold text-slate-700 mb-2">
            <i class="fas fa-key text-indigo-500 mr-1.5"></i> Digite o Código da sua Turma
          </label>
          <div class="relative mb-4">
            <input 
              type="text" 
              id="input-class-code" 
              placeholder="Ex: MAT7A" 
              maxlength="10" 
              class="w-full text-center text-2xl font-bold uppercase tracking-widest px-4 py-3.5 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:border-indigo-600 focus:bg-white focus:outline-none transition-all placeholder:text-slate-300"
              autocomplete="off"
            />
          </div>

          <button 
            id="btn-submit-code" 
            class="w-full py-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold rounded-2xl shadow-md shadow-indigo-100 transition-all flex items-center justify-center gap-2 text-base"
          >
            <span>Entrar na Turma</span>
            <i class="fas fa-arrow-right text-sm"></i>
          </button>

          <!-- Quick Test Badges for Demo -->
          <div class="mt-6 pt-5 border-t border-slate-100">
            <p class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5 text-center">
              💡 Turmas de Demonstração Rápida
            </p>
            <div class="flex flex-wrap gap-2 justify-center">
              ${turmas.map(t => `
                <button 
                  type="button" 
                  class="btn-quick-code px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 border border-slate-200 rounded-xl text-xs font-medium text-slate-600 transition-all"
                  data-code="${t.codigo_acesso}"
                >
                  <span class="font-bold">${t.codigo_acesso}</span> (${t.nome})
                </button>
              `).join("")}
            </div>
          </div>
        </div>

        <!-- Help Info Box -->
        <div class="mt-6 bg-indigo-50/70 border border-indigo-100 rounded-2xl p-4 flex items-start gap-3 text-xs text-indigo-900 leading-relaxed">
          <i class="fas fa-info-circle text-indigo-500 text-base mt-0.5 shrink-0"></i>
          <p>
            <strong>Como funciona?</strong> Peça o código de 5 ou 6 caracteres para o seu professor. Você não precisa lembrar de senhas longas nem de e-mail!
          </p>
        </div>
      </div>
    `;
  }

  bindStepCodeEvents() {
    const input = document.getElementById("input-class-code");
    const btn = document.getElementById("btn-submit-code");

    if (input) {
      input.focus();
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          this.handleEnterClassCode(input.value);
        }
      });
    }

    if (btn && input) {
      btn.addEventListener("click", () => {
        this.handleEnterClassCode(input.value);
      });
    }

    document.querySelectorAll(".btn-quick-code").forEach(btnQuick => {
      btnQuick.addEventListener("click", () => {
        const code = btnQuick.getAttribute("data-code");
        if (input) input.value = code;
        this.handleEnterClassCode(code);
      });
    });
  }

  // STEP 2: ESCOLHER NOME NA LISTA
  renderStepStudentPicker() {
    const turma = this.selectedTurma;
    const alunos = window.schoolStorage.getAlunosByTurma(turma.id);

    return `
      <div class="max-w-md mx-auto pt-6 pb-12 px-4">
        <!-- Back Navigation & Turma Info -->
        <div class="flex items-center justify-between mb-4">
          <button id="btn-back-to-code" class="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-indigo-600 gap-1.5 py-1 px-2.5 rounded-lg hover:bg-slate-100 transition-all">
            <i class="fas fa-chevron-left text-xs"></i>
            <span>Trocar Turma</span>
          </button>
          <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">
            ${turma.codigo_acesso}
          </span>
        </div>

        <div class="text-center mb-6">
          <h1 class="text-xl font-bold text-slate-800">${turma.nome}</h1>
          <p class="text-slate-500 text-xs mt-0.5">${turma.disciplina} • ${turma.professor_nome}</p>
          <p class="text-slate-700 text-sm font-medium mt-3">Quem é você na lista de chamada?</p>
        </div>

        <!-- Search Input -->
        <div class="relative mb-3">
          <i class="fas fa-search absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
          <input 
            type="text" 
            id="input-search-student" 
            placeholder="Buscar seu nome..." 
            class="w-full pl-9 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:border-indigo-600 focus:outline-none transition-all"
          />
        </div>

        <!-- Student List -->
        <div id="student-picker-list" class="space-y-2 max-h-[380px] overflow-y-auto pr-1">
          ${alunos.length === 0 ? `
            <div class="bg-white rounded-2xl p-6 text-center text-slate-400 border border-slate-100">
              <i class="fas fa-user-slash text-2xl mb-2 text-slate-300"></i>
              <p class="text-sm font-medium">Nenhum aluno cadastrado nesta turma ainda.</p>
            </div>
          ` : alunos.map(aluno => {
            const initials = aluno.nome_completo.split(" ").filter(Boolean).map(n => n[0]).slice(0, 2).join("").toUpperCase();
            return `
              <button 
                type="button" 
                class="student-picker-item w-full p-3.5 bg-white hover:bg-indigo-50/60 active:scale-[0.99] border border-slate-200 hover:border-indigo-300 rounded-2xl flex items-center justify-between text-left transition-all shadow-sm group"
                data-id="${aluno.id}"
                data-name="${aluno.nome_completo.toLowerCase()}"
              >
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center font-bold text-xs tracking-wider transition-colors">
                    ${initials}
                  </div>
                  <div>
                    <h3 class="text-sm font-semibold text-slate-800 group-hover:text-indigo-900">${aluno.nome_completo}</h3>
                    <span class="text-[11px] text-slate-400">Clique para entrar</span>
                  </div>
                </div>
                <div class="w-7 h-7 rounded-full bg-slate-100 group-hover:bg-indigo-100 flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-colors">
                  <i class="fas fa-chevron-right text-xs"></i>
                </div>
              </button>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  bindStepStudentPickerEvents() {
    const btnBack = document.getElementById("btn-back-to-code");
    if (btnBack) {
      btnBack.addEventListener("click", () => {
        this.currentStep = 1;
        this.render();
      });
    }

    const searchInput = document.getElementById("input-search-student");
    const items = document.querySelectorAll(".student-picker-item");

    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase().trim();
        items.forEach(el => {
          const name = el.getAttribute("data-name") || "";
          el.style.display = name.includes(query) ? "flex" : "none";
        });
      });
    }

    items.forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        this.handleSelectStudent(id);
      });
    });
  }

  // STEP 3: DIGITAR PIN DE 4 DÍGITOS
  renderStepPin() {
    const aluno = this.selectedAluno;
    const turma = this.selectedTurma;
    const firstName = aluno.nome_completo.split(" ")[0];

    return `
      <div class="max-w-md mx-auto pt-6 pb-12 px-4">
        <!-- Back Navigation -->
        <div class="flex items-center justify-between mb-4">
          <button id="btn-back-to-picker" class="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-indigo-600 gap-1.5 py-1 px-2.5 rounded-lg hover:bg-slate-100 transition-all">
            <i class="fas fa-chevron-left text-xs"></i>
            <span>Voltar para chamada</span>
          </button>
          <span class="text-xs text-slate-400">${turma.nome}</span>
        </div>

        <!-- Student Identification Header -->
        <div class="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 text-center">
          <div class="w-16 h-16 rounded-full bg-indigo-50 border-2 border-indigo-200 text-indigo-600 flex items-center justify-center font-bold text-xl mx-auto mb-3 shadow-inner">
            <i class="fas fa-lock text-indigo-600"></i>
          </div>
          <h2 class="text-xl font-bold text-slate-800">Olá, ${firstName}! 👋</h2>
          <p class="text-slate-500 text-xs mt-1">Digite seu PIN pessoal de 4 números para entrar</p>

          <!-- 4 Boxes PIN Display -->
          <div class="flex justify-center gap-2.5 sm:gap-3 my-6">
            <input type="password" maxlength="1" inputmode="numeric" class="pin-digit-box" id="pin-0" autofocus />
            <input type="password" maxlength="1" inputmode="numeric" class="pin-digit-box" id="pin-1" />
            <input type="password" maxlength="1" inputmode="numeric" class="pin-digit-box" id="pin-2" />
            <input type="password" maxlength="1" inputmode="numeric" class="pin-digit-box" id="pin-3" />
          </div>

          <!-- Onscreen Numeric Pad (Great for Mobile!) -->
          <div class="grid grid-cols-3 gap-2 max-w-[260px] mx-auto mb-4">
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `
              <button type="button" class="btn-numpad py-3 rounded-xl bg-slate-50 hover:bg-indigo-50 active:bg-indigo-100 text-slate-700 font-bold text-lg border border-slate-100 transition-all" data-val="${n}">
                ${n}
              </button>
            `).join("")}
            <button type="button" class="btn-numpad-clear py-3 rounded-xl bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-600 font-semibold text-xs border border-rose-100 transition-all flex items-center justify-center">
              <i class="fas fa-backspace"></i>
            </button>
            <button type="button" class="btn-numpad py-3 rounded-xl bg-slate-50 hover:bg-indigo-50 active:bg-indigo-100 text-slate-700 font-bold text-lg border border-slate-100 transition-all" data-val="0">
              0
            </button>
            <button type="button" id="btn-submit-pin" class="py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs border border-indigo-600 transition-all flex items-center justify-center">
              <i class="fas fa-check"></i>
            </button>
          </div>

          <!-- Demo Hint Helper -->
          <div class="mt-4 p-2.5 rounded-xl bg-amber-50 border border-amber-200/70 text-[11px] text-amber-800">
            <i class="fas fa-lightbulb text-amber-500 mr-1"></i>
            <strong>Dica de Demonstração:</strong> O PIN de ${aluno.nome_completo} é <span class="font-mono font-bold bg-white px-1.5 py-0.5 rounded border border-amber-200 text-amber-900">${aluno.pin_4_digitos}</span>
          </div>

          <!-- Forgotten PIN rescue note -->
          <p class="text-[11px] text-slate-400 mt-4 leading-normal">
            Esqueceu seu PIN? A professora tem uma lista com os números e pode resetar para você a qualquer momento!
          </p>
        </div>
      </div>
    `;
  }

  bindStepPinEvents() {
    const btnBack = document.getElementById("btn-back-to-picker");
    if (btnBack) {
      btnBack.addEventListener("click", () => {
        this.currentStep = 2;
        this.render();
      });
    }

    const boxes = [
      document.getElementById("pin-0"),
      document.getElementById("pin-1"),
      document.getElementById("pin-2"),
      document.getElementById("pin-3")
    ];

    const getFullPin = () => boxes.map(b => b.value).join("");

    const updateFilledStyles = () => {
      boxes.forEach(b => {
        if (b.value) b.classList.add("filled");
        else b.classList.remove("filled");
      });
    };

    boxes.forEach((box, index) => {
      box.addEventListener("input", (e) => {
        const val = e.target.value.replace(/\D/g, "");
        box.value = val ? val[0] : "";
        updateFilledStyles();

        if (box.value && index < 3) {
          boxes[index + 1].focus();
        }

        if (getFullPin().length === 4) {
          setTimeout(() => this.handleVerifyPin(getFullPin()), 150);
        }
      });

      box.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && !box.value && index > 0) {
          boxes[index - 1].focus();
        }
      });
    });

    // Mobile Numpad clicks
    document.querySelectorAll(".btn-numpad").forEach(btn => {
      btn.addEventListener("click", () => {
        const val = btn.getAttribute("data-val");
        this.playSound("click");
        const emptyBox = boxes.find(b => !b.value);
        if (emptyBox) {
          emptyBox.value = val;
          updateFilledStyles();
          const nextIdx = boxes.indexOf(emptyBox) + 1;
          if (nextIdx < 4) boxes[nextIdx].focus();
          if (getFullPin().length === 4) {
            setTimeout(() => this.handleVerifyPin(getFullPin()), 150);
          }
        }
      });
    });

    const btnClear = document.querySelector(".btn-numpad-clear");
    if (btnClear) {
      btnClear.addEventListener("click", () => {
        for (let i = boxes.length - 1; i >= 0; i--) {
          if (boxes[i].value) {
            boxes[i].value = "";
            boxes[i].focus();
            break;
          }
        }
        updateFilledStyles();
      });
    }

    const btnSubmit = document.getElementById("btn-submit-pin");
    if (btnSubmit) {
      btnSubmit.addEventListener("click", () => {
        this.handleVerifyPin(getFullPin());
      });
    }

    if (boxes[0]) boxes[0].focus();
  }

  // STEP 4: DASHBOARD DO ALUNO & FAMÍLIA
  renderStepDashboard() {
    const aluno = this.selectedAluno;
    const turma = this.selectedTurma;
    const escola = window.schoolStorage.getEscola();
    const atividades = window.schoolStorage.getAtividadesByTurma(turma.id);
    const avisos = window.schoolStorage.getAvisos(turma.id);
    const freqStats = window.schoolStorage.getAlunoFrequenciaStats(aluno.id, turma.id);

    // Calculate activities status
    const ativList = atividades.map(at => {
      const status = window.schoolStorage.getAlunoAtividadeStatus(aluno.id, at.id);
      return {
        ...at,
        status
      };
    });

    const pendentes = ativList.filter(at => !at.status.concluida && at.ativa);
    const concluidas = ativList.filter(at => at.status.concluida);

    // Overall student grade
    const totalQuestoesConcluidas = concluidas.reduce((acc, at) => acc + at.status.total, 0);
    const totalAcertosConcluidos = concluidas.reduce((acc, at) => acc + at.status.acertos, 0);
    const mediaGeral = totalQuestoesConcluidas > 0 ? Math.round((totalAcertosConcluidos / totalQuestoesConcluidas) * 100) : 0;

    // --- MODO: CONSULTA DA FAMÍLIA / PAIS ---
    if (this.isParentView) {
      return `
        <div class="max-w-2xl mx-auto pt-6 pb-16 px-4">
          <!-- Family Header -->
          <div class="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 text-white shadow-lg mb-6 border border-indigo-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 uppercase tracking-wider mb-2">
                👨‍👩‍👧 Espaço dos Pais & Responsáveis
              </span>
              <h1 class="text-xl font-bold text-white tracking-tight">Boletim Escolar de ${aluno.nome_completo}</h1>
              <p class="text-xs text-slate-300 mt-0.5">${escola.nome} • ${turma.nome} (${turma.disciplina})</p>
            </div>

            <div class="flex items-center gap-2">
              <button id="btn-toggle-student-mode" class="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-sm">
                <i class="fas fa-arrow-left"></i>
                <span>Portal do Aluno</span>
              </button>
              <button id="btn-student-logout" class="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs" title="Sair">
                <i class="fas fa-sign-out-alt"></i>
              </button>
            </div>
          </div>

          <!-- Family Summary KPIs -->
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span class="text-xs font-semibold text-slate-400 block">Frequência Escolar</span>
              <div class="flex items-baseline gap-1 mt-1">
                <span class="text-2xl font-black ${freqStats.percentual >= 75 ? 'text-emerald-600' : 'text-rose-600'}">${freqStats.percentual}%</span>
                <span class="text-[11px] text-slate-400 font-medium">de presença</span>
              </div>
              <span class="text-[10px] text-slate-400 block mt-0.5">${freqStats.presencas} de ${freqStats.totalDias} aulas presentes</span>
            </div>

            <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span class="text-xs font-semibold text-slate-400 block">Média de Rendimento</span>
              <div class="flex items-baseline gap-1 mt-1">
                <span class="text-2xl font-black ${mediaGeral >= 70 ? 'text-emerald-600' : 'text-amber-600'}">${mediaGeral}%</span>
                <span class="text-[11px] text-slate-400 font-medium">acertos</span>
              </div>
              <span class="text-[10px] text-slate-400 block mt-0.5">${concluidas.length} de ${atividades.length} listas feitas</span>
            </div>

            <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm col-span-2 sm:col-span-1">
              <span class="text-xs font-semibold text-slate-400 block">Situação Pedagógica</span>
              <div class="mt-1">
                <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                  mediaGeral >= 80 && freqStats.percentual >= 85 ? 'bg-emerald-100 text-emerald-800' : (mediaGeral >= 60 ? 'bg-indigo-100 text-indigo-800' : 'bg-rose-100 text-rose-800')
                }">
                  ${mediaGeral >= 80 && freqStats.percentual >= 85 ? '🌟 Aluno Destaque' : (mediaGeral >= 60 ? '✓ Regular / Aprovado' : '⚠️ Necessita Reforço')}
                </span>
              </div>
            </div>
          </div>

          <!-- School Messages to Parents -->
          <div class="bg-amber-50/70 border border-amber-200/80 rounded-3xl p-5 mb-6">
            <h3 class="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5 mb-2">
              <i class="fas fa-bullhorn text-amber-600"></i>
              <span>Recados da Escola & Professora para a Família</span>
            </h3>
            <div class="space-y-2">
              ${avisos.map(av => `
                <div class="bg-white/80 p-3 rounded-xl border border-amber-200/60 text-xs">
                  <div class="flex items-center justify-between gap-2 mb-1">
                    <strong class="text-slate-800 font-bold">${av.titulo}</strong>
                    <span class="text-[10px] text-slate-400">${av.data}</span>
                  </div>
                  <p class="text-slate-600 leading-relaxed">${av.mensagem}</p>
                  <span class="text-[10px] text-amber-800 font-semibold mt-1 block">Por: ${av.autor}</span>
                </div>
              `).join("")}
            </div>
          </div>

          <!-- Academic Tasks Table for Parents -->
          <div class="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm">
            <h3 class="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <i class="fas fa-tasks text-indigo-600"></i>
              <span>Relatório de Tarefas e Exercícios</span>
            </h3>
            <div class="space-y-2">
              ${ativList.map(at => `
                <div class="p-3 rounded-xl border border-slate-100 bg-slate-50/60 flex items-center justify-between text-xs">
                  <div>
                    <h4 class="font-bold text-slate-800">${at.titulo}</h4>
                    <span class="text-[11px] text-slate-400">${at.status.total} questões</span>
                  </div>
                  <div>
                    ${at.status.concluida ? `
                      <span class="px-2.5 py-1 rounded-lg text-xs font-bold ${
                        at.status.notaPercent >= 70 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }">
                        Nota: ${at.status.notaPercent}% (${at.status.acertos}/${at.status.total})
                      </span>
                    ` : `
                      <span class="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-200 text-slate-600">
                        Pendente
                      </span>
                    `}
                  </div>
                </div>
              `).join("")}
            </div>
          </div>
        </div>
      `;
    }

    // --- MODO NORMAL: PORTAL DO ALUNO ---
    return `
      <div class="max-w-2xl mx-auto pt-6 pb-16 px-4">
        <!-- Student Header Card -->
        <div class="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 rounded-3xl p-6 text-white shadow-lg shadow-indigo-100 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div class="flex items-center gap-4">
            <div class="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-2xl font-bold">
              🎒
            </div>
            <div>
              <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-xs font-semibold tracking-wide">
                <span>${turma.nome}</span> • <span>${turma.disciplina}</span>
              </div>
              <h1 class="text-xl sm:text-2xl font-bold mt-1 tracking-tight">Olá, ${aluno.nome_completo}!</h1>
              <p class="text-indigo-100 text-xs mt-0.5">${escola.nome} • Prof(a): ${turma.professor_nome}</p>
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-2 self-start sm:self-center">
            <button id="btn-toggle-parent-mode" class="px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 active:scale-95 text-white text-xs font-semibold transition-all flex items-center gap-1.5 border border-white/20" title="Ver resumo para pais e responsáveis">
              <i class="fas fa-users text-xs"></i>
              <span>Espaço dos Pais</span>
            </button>
            <button id="btn-student-logout" class="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white text-xs font-semibold transition-all flex items-center gap-1 border border-white/20">
              <i class="fas fa-sign-out-alt"></i>
              <span>Sair</span>
            </button>
          </div>
        </div>

        <!-- Student Quick Stats Bar -->
        <div class="grid grid-cols-3 gap-2.5 mb-5">
          <div class="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-sm text-center">
            <span class="text-[11px] font-semibold text-slate-400 block">Minha Frequência</span>
            <span class="text-lg font-black ${freqStats.percentual >= 75 ? 'text-emerald-600' : 'text-rose-600'} block mt-0.5">${freqStats.percentual}%</span>
            <span class="text-[10px] text-slate-400 block">${freqStats.presencas} presenças</span>
          </div>

          <div class="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-sm text-center">
            <span class="text-[11px] font-semibold text-slate-400 block">Aproveitamento</span>
            <span class="text-lg font-black ${mediaGeral >= 70 ? 'text-emerald-600' : 'text-amber-600'} block mt-0.5">${mediaGeral}%</span>
            <span class="text-[10px] text-slate-400 block">${concluidas.length} concluídas</span>
          </div>

          <div class="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-sm text-center">
            <span class="text-[11px] font-semibold text-slate-400 block">Exercícios</span>
            <span class="text-lg font-black text-indigo-600 block mt-0.5">${pendentes.length}</span>
            <span class="text-[10px] text-amber-600 font-semibold block">${pendentes.length > 0 ? 'Pendente(s)' : 'Tudo em dia!'}</span>
          </div>
        </div>

        <!-- School & Class Announcements (Mural) -->
        ${avisos.length > 0 ? `
          <div class="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-3xl p-4 sm:p-5 mb-6 shadow-xs">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                <i class="fas fa-bullhorn text-amber-600"></i>
                <span>Mural de Avisos da Escola & Turma (${avisos.length})</span>
              </span>
            </div>
            <div class="space-y-2">
              ${avisos.slice(0, 2).map(av => `
                <div class="bg-white/90 p-3 rounded-2xl border border-amber-200/70 text-xs">
                  <div class="flex items-center justify-between gap-2">
                    <h4 class="font-bold text-slate-800">${av.titulo}</h4>
                    <span class="text-[10px] text-slate-400">${av.data}</span>
                  </div>
                  <p class="text-slate-600 mt-0.5 leading-relaxed">${av.mensagem}</p>
                </div>
              `).join("")}
            </div>
          </div>
        ` : ''}

        <!-- Section: Atividades Pendentes -->
        <div class="mb-8">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-base font-bold text-slate-800 flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
              <span>Exercícios Pendentes</span>
              <span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">${pendentes.length}</span>
            </h2>
          </div>

          ${pendentes.length === 0 ? `
            <div class="bg-white rounded-2xl p-6 text-center border border-slate-100 shadow-sm">
              <div class="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl mx-auto mb-2">
                <i class="fas fa-check-circle"></i>
              </div>
              <h3 class="text-sm font-bold text-slate-800">Tudo em dia por aqui!</h3>
              <p class="text-xs text-slate-400 mt-1">Você não possui nenhuma atividade pendente nesta turma no momento.</p>
            </div>
          ` : `
            <div class="space-y-3">
              ${pendentes.map(at => {
                const totalQuestoes = at.status.total;
                const respondidas = at.status.respondidas;
                const progresso = totalQuestoes > 0 ? Math.round((respondidas / totalQuestoes) * 100) : 0;
                
                return `
                  <div class="bg-white rounded-2xl p-5 border border-slate-200/80 hover:border-indigo-300 shadow-sm transition-all">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                      <div>
                        <span class="inline-flex items-center px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[11px] font-bold">
                          ${totalQuestoes} Questões
                        </span>
                        ${at.prazo_entrega ? `
                          <span class="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-medium ml-1.5">
                            <i class="far fa-calendar-alt mr-1"></i> Entrega: ${at.prazo_entrega}
                          </span>
                        ` : ''}
                        <h3 class="text-base font-bold text-slate-800 mt-1.5">${at.titulo}</h3>
                        ${at.descricao ? `<p class="text-xs text-slate-500 mt-0.5">${at.descricao}</p>` : ''}
                      </div>

                      <button 
                        class="btn-start-atividade px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs shadow-md shadow-indigo-100 transition-all flex items-center justify-center gap-1.5 shrink-0"
                        data-id="${at.id}"
                      >
                        <span>${respondidas > 0 ? 'Continuar' : 'Começar'}</span>
                        <i class="fas fa-play text-[10px]"></i>
                      </button>
                    </div>

                    ${respondidas > 0 ? `
                      <div class="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div class="bg-indigo-600 h-1.5 rounded-full transition-all" style="width: ${progresso}%"></div>
                      </div>
                      <p class="text-[10px] text-slate-400 mt-1.5">${respondidas} de ${totalQuestoes} respondidas (${progresso}%)</p>
                    ` : ''}
                  </div>
                `;
              }).join("")}
            </div>
          `}
        </div>

        <!-- Section: Atividades Concluídas -->
        <div>
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-base font-bold text-slate-800 flex items-center gap-2">
              <i class="fas fa-history text-slate-400 text-sm"></i>
              <span>Atividades Concluídas</span>
              <span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">${concluidas.length}</span>
            </h2>
          </div>

          ${concluidas.length === 0 ? `
            <div class="bg-slate-50 rounded-2xl p-5 text-center border border-dashed border-slate-200">
              <p class="text-xs text-slate-400">Suas atividades concluídas aparecerão aqui com a pontuação.</p>
            </div>
          ` : `
            <div class="space-y-3">
              ${concluidas.map(at => {
                const scoreColor = at.status.notaPercent >= 70 ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-amber-700 bg-amber-50 border-amber-200';
                return `
                  <div class="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/70 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${scoreColor}">
                          Nota: ${at.status.notaPercent}% (${at.status.acertos}/${at.status.total})
                        </span>
                        <span class="text-xs text-slate-400">• Concluído</span>
                      </div>
                      <h3 class="text-sm font-bold text-slate-800 mt-1">${at.titulo}</h3>
                    </div>

                    <button 
                      class="btn-start-atividade px-4 py-2 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 font-semibold text-xs transition-all flex items-center justify-center gap-1.5 self-start sm:self-auto"
                      data-id="${at.id}"
                    >
                      <i class="fas fa-eye text-xs"></i>
                      <span>Rever Questões</span>
                    </button>
                  </div>
                `;
              }).join("")}
            </div>
          `}
        </div>
      </div>
    `;
  }

  bindStepDashboardEvents() {
    const btnLogout = document.getElementById("btn-student-logout");
    if (btnLogout) {
      btnLogout.addEventListener("click", () => this.logout());
    }

    const btnToggleParent = document.getElementById("btn-toggle-parent-mode");
    if (btnToggleParent) {
      btnToggleParent.addEventListener("click", () => {
        this.isParentView = true;
        this.render();
      });
    }

    const btnToggleStudent = document.getElementById("btn-toggle-student-mode");
    if (btnToggleStudent) {
      btnToggleStudent.addEventListener("click", () => {
        this.isParentView = false;
        this.render();
      });
    }

    document.querySelectorAll(".btn-start-atividade").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        this.handleStartAtividade(id);
      });
    });
  }

  // STEP 5: QUIZ PLAYER (RESOLUÇÃO DE QUESTÕES 100% TEXTUAIS)
  renderStepQuizPlayer() {
    const ativ = this.activeAtividade;
    const total = this.activeQuestoes.length;
    const index = this.currentQuestaoIndex;
    const questao = this.activeQuestoes[index];
    const letters = ["A", "B", "C", "D"];
    const progressPercent = Math.round(((index + 1) / total) * 100);

    return `
      <div class="max-w-xl mx-auto pt-4 pb-16 px-4">
        <!-- Top Navigation Bar -->
        <div class="flex items-center justify-between mb-3">
          <button id="btn-exit-quiz" class="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-800 gap-1 py-1.5 px-2.5 rounded-lg hover:bg-slate-100 transition-all">
            <i class="fas fa-times text-xs"></i>
            <span>Pausar e Voltar</span>
          </button>
          <div class="flex items-center gap-2">
            ${index > 0 ? `
              <button id="btn-prev-question" class="p-1 px-2.5 text-xs font-semibold text-slate-600 hover:text-indigo-600 bg-white border border-slate-200 rounded-xl transition-all flex items-center gap-1 shadow-xs">
                <i class="fas fa-chevron-left text-[10px]"></i>
                <span>Anterior</span>
              </button>
            ` : ''}
            <span class="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full">
              Questão ${index + 1} de ${total}
            </span>
          </div>
        </div>

        <!-- Progress Bar -->
        <div class="w-full bg-slate-200/80 rounded-full h-2 mb-5 overflow-hidden">
          <div class="bg-indigo-600 h-2 rounded-full transition-all duration-300 ease-out" style="width: ${progressPercent}%"></div>
        </div>

        <!-- Question Card -->
        <div class="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200/90 shadow-sm mb-4">
          <!-- Grade Tag & Activity title -->
          <div class="flex items-center justify-between text-xs text-slate-400 mb-3 pb-2 border-b border-slate-100">
            <span class="font-medium text-slate-500 truncate max-w-[280px]">${ativ.titulo}</span>
            <span class="font-semibold text-indigo-600">Série: ${this.selectedTurma.serie_ano}</span>
          </div>

          <!-- Question Statement (Enunciado) -->
          <div class="text-slate-800 text-base sm:text-lg font-medium leading-relaxed mb-6">
            ${questao.enunciado}
          </div>

          <!-- Dica Amiga (💡) Collapsible -->
          ${questao.dica ? `
            <div class="mb-5">
              <button 
                id="btn-toggle-dica" 
                type="button" 
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold transition-all border border-amber-200"
              >
                <span>💡</span>
                <span>Precisa de uma Dica Amiga?</span>
                <i class="fas fa-chevron-down text-[10px] ml-1"></i>
              </button>
              <div id="dica-box" class="hidden mt-2 p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 leading-relaxed animate-fadeIn">
                <strong>💡 Dica do Professor:</strong> ${questao.dica}
              </div>
            </div>
          ` : ''}

          <!-- Alternatives (A, B, C, D) -->
          <div class="space-y-3">
            ${questao.alternativas.map((alt, optIdx) => {
              const cleanText = alt.replace(/^[A-D]\)\s*/, "");
              const isSelected = this.currentSelection === optIdx;
              let extraClasses = "";

              if (this.feedbackState) {
                if (optIdx === questao.resposta_correta_index) {
                  extraClasses = "correct-feedback border-emerald-500 bg-emerald-50 text-emerald-950 font-semibold";
                } else if (isSelected && !this.feedbackState.acertou) {
                  extraClasses = "wrong-feedback border-rose-500 bg-rose-50 text-rose-950 line-through opacity-80";
                } else {
                  extraClasses = "opacity-50 pointer-events-none";
                }
              } else if (isSelected) {
                extraClasses = "selected border-indigo-600 bg-indigo-50/80 text-indigo-950 shadow-sm";
              }

              return `
                <div 
                  class="option-card p-4 rounded-2xl flex items-start gap-3 select-none ${extraClasses}"
                  data-index="${optIdx}"
                >
                  <div class="w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                    isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                  }">
                    ${letters[optIdx]}
                  </div>
                  <div class="text-sm sm:text-base leading-snug flex-1">
                    ${cleanText}
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </div>

        <!-- Feedback Card (When submitted) -->
        ${this.feedbackState ? `
          <div class="rounded-3xl p-5 mb-4 border transition-all ${
            this.feedbackState.acertou 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
              : 'bg-rose-50/90 border-rose-200 text-rose-950'
          }">
            <div class="flex items-center gap-2 mb-2 font-bold text-sm">
              ${this.feedbackState.acertou ? `
                <span class="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">
                  <i class="fas fa-check"></i>
                </span>
                <span>Sensacional! Você acertou! 🎉</span>
              ` : `
                <span class="w-6 h-6 rounded-full bg-rose-600 text-white flex items-center justify-center text-xs">
                  <i class="fas fa-times"></i>
                </span>
                <span>Não foi dessa vez, mas veja a explicação:</span>
              `}
            </div>

            <!-- Por Que Errou (Pegadinha) -->
            ${!this.feedbackState.acertou && this.feedbackState.pegadinha ? `
              <div class="mb-3 p-3 rounded-xl bg-white/80 border border-rose-200 text-xs text-rose-900 leading-relaxed">
                <span class="font-bold block text-rose-700 mb-0.5">⚠️ Por Que Você Marcou Essa Alternativa?</span>
                ${this.feedbackState.pegadinha}
              </div>
            ` : ''}

            <!-- Explicação Correta -->
            ${this.feedbackState.explicacao ? `
              <div class="p-3 rounded-xl bg-white/80 border ${this.feedbackState.acertou ? 'border-emerald-200 text-emerald-950' : 'border-slate-200 text-slate-800'} text-xs leading-relaxed">
                <span class="font-bold block text-slate-700 mb-0.5">📖 Explicação Passo a Passo:</span>
                ${this.feedbackState.explicacao}
              </div>
            ` : ''}
          </div>
        ` : ''}

        <!-- Bottom Action Button -->
        <div>
          ${!this.feedbackState ? `
            <button 
              id="btn-confirm-answer" 
              class="w-full py-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold rounded-2xl shadow-md shadow-indigo-100 transition-all flex items-center justify-center gap-2 text-base ${
                this.currentSelection === null ? 'opacity-50 cursor-not-allowed' : ''
              }"
            >
              <span>Confirmar Resposta</span>
              <i class="fas fa-check-circle"></i>
            </button>
          ` : `
            <button 
              id="btn-next-question" 
              class="w-full py-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold rounded-2xl shadow-md shadow-indigo-100 transition-all flex items-center justify-center gap-2 text-base"
            >
              <span>${index < total - 1 ? 'Próxima Questão' : 'Ver Resultado Final'}</span>
              <i class="fas fa-arrow-right"></i>
            </button>
          `}
        </div>
      </div>
    `;
  }

  bindStepQuizEvents() {
    const btnExit = document.getElementById("btn-exit-quiz");
    if (btnExit) {
      btnExit.addEventListener("click", () => {
        this.currentStep = 4; // Dashboard
        this.render();
      });
    }

    const btnToggleDica = document.getElementById("btn-toggle-dica");
    const dicaBox = document.getElementById("dica-box");
    if (btnToggleDica && dicaBox) {
      btnToggleDica.addEventListener("click", () => {
        this.playSound("hint");
        dicaBox.classList.toggle("hidden");
      });
    }

    document.querySelectorAll(".option-card").forEach(card => {
      card.addEventListener("click", () => {
        const idx = parseInt(card.getAttribute("data-index"), 10);
        this.handleSelectOption(idx);
      });
    });

    const btnConfirm = document.getElementById("btn-confirm-answer");
    if (btnConfirm) {
      btnConfirm.addEventListener("click", () => {
        this.handleSubmitAnswer();
      });
    }

    const btnNext = document.getElementById("btn-next-question");
    if (btnNext) {
      btnNext.addEventListener("click", () => {
        this.handleNextQuestion();
      });
    }

    const btnPrev = document.getElementById("btn-prev-question");
    if (btnPrev) {
      btnPrev.addEventListener("click", () => {
        this.handlePrevQuestion();
      });
    }
  }

  // STEP 6: RESULTADO FINAL
  renderStepQuizFinished() {
    const ativ = this.activeAtividade;
    const aluno = this.selectedAluno;
    const status = window.schoolStorage.getAlunoAtividadeStatus(aluno.id, ativ.id);
    const percent = status.notaPercent;

    let bannerMsg = "Parabéns pelo esforço!";
    let bannerEmoji = "🌟";
    if (percent === 100) {
      bannerMsg = "Perfeito! Domínio total do assunto!";
      bannerEmoji = "🏆";
    } else if (percent >= 70) {
      bannerMsg = "Muito bom trabalho! Quase tudo certo!";
      bannerEmoji = "🎉";
    } else {
      bannerMsg = "Bom treino! Vale a pena revisar as explicações das questões que você errou!";
      bannerEmoji = "💪";
    }

    return `
      <div class="max-w-md mx-auto pt-8 pb-16 px-4 text-center">
        <div class="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100">
          <div class="text-5xl mb-3 animate-bounce">
            ${bannerEmoji}
          </div>
          <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 mb-2">
            ${ativ.titulo}
          </span>
          <h2 class="text-2xl font-bold text-slate-800">${bannerMsg}</h2>
          <p class="text-slate-500 text-xs mt-1">Sua professora já recebeu seu resultado em tempo real!</p>

          <!-- Score Card -->
          <div class="grid grid-cols-2 gap-3 my-6">
            <div class="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100">
              <span class="text-xs font-semibold text-indigo-700 block">Acertos</span>
              <span class="text-3xl font-extrabold text-indigo-950 mt-1 block">
                ${status.acertos} / ${status.total}
              </span>
            </div>
            <div class="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-100">
              <span class="text-xs font-semibold text-emerald-700 block">Aproveitamento</span>
              <span class="text-3xl font-extrabold text-emerald-950 mt-1 block">
                ${percent}%
              </span>
            </div>
          </div>

          <button 
            id="btn-back-dashboard" 
            class="w-full py-4 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white font-bold rounded-2xl shadow-md shadow-indigo-100 transition-all flex items-center justify-center gap-2 text-base"
          >
            <i class="fas fa-home"></i>
            <span>Voltar para Minhas Atividades</span>
          </button>
        </div>
      </div>
    `;
  }

  bindStepQuizFinishedEvents() {
    const btnBack = document.getElementById("btn-back-dashboard");
    if (btnBack) {
      btnBack.addEventListener("click", () => {
        this.currentStep = 4; // Dashboard
        this.render();
      });
    }
  }
}

window.studentController = new StudentController();
