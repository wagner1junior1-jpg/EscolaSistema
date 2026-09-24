// Storage Layer for Sistema de Questões Escolar

class SchoolStorage {
  constructor() {
    this.STORAGE_KEY = "sistema_escolar_db";
    this.SESSION_KEY = "sistema_escolar_student_session";
    this.TEACHER_KEY = "sistema_escolar_teacher_active_class";
    this.listeners = [];
    this.init();
  }

  init() {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (!raw) {
      this.resetToDemo();
    } else {
      try {
        const data = JSON.parse(raw);
        let modified = false;
        if (!data.escola && window.DEFAULT_DATA.escola) {
          data.escola = window.DEFAULT_DATA.escola;
          modified = true;
        }
        if (!data.professores && window.DEFAULT_DATA.professores) {
          data.professores = window.DEFAULT_DATA.professores;
          modified = true;
        }
        if (!data.avisos && window.DEFAULT_DATA.avisos) {
          data.avisos = window.DEFAULT_DATA.avisos;
          modified = true;
        }
        if (!data.frequencias && window.DEFAULT_DATA.frequencias) {
          data.frequencias = window.DEFAULT_DATA.frequencias;
          modified = true;
        }
        if (modified) {
          this.saveData(data);
        }
      } catch (e) {
        this.resetToDemo();
      }
    }
  }

  getData() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return JSON.parse(JSON.stringify(window.DEFAULT_DATA || {}));
      return JSON.parse(raw);
    } catch (e) {
      console.error("Erro ao ler localStorage:", e);
      return JSON.parse(JSON.stringify(window.DEFAULT_DATA || {}));
    }
  }

  saveData(data) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    this.notifyListeners(data);
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notifyListeners(data) {
    this.listeners.forEach(fn => {
      try { fn(data); } catch (e) { console.error("Listener error:", e); }
    });
  }

  resetToDemo() {
    const fresh = JSON.parse(JSON.stringify(window.DEFAULT_DATA));
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(fresh));
    this.clearStudentSession();
    this.notifyListeners(fresh);
    return fresh;
  }

  exportBackupJSON() {
    return localStorage.getItem(this.STORAGE_KEY) || JSON.stringify(window.DEFAULT_DATA);
  }

  importBackupJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed.turmas || !parsed.alunos) {
        throw new Error("Formato inválido de backup escolar.");
      }
      this.saveData(parsed);
      return true;
    } catch (e) {
      console.error("Falha ao importar backup:", e);
      return false;
    }
  }

  // --- HELPERS ---
  generateId(prefix = "id") {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  }

  generatePin() {
    // 4 digits avoiding easy sequences like 0000, 1111
    let pin;
    do {
      pin = Math.floor(1000 + Math.random() * 9000).toString();
    } while (pin[0] === pin[1] && pin[1] === pin[2] && pin[2] === pin[3]);
    return pin;
  }

  // --- TURMAS ---
  getTurmas() {
    const data = this.getData();
    return data.turmas || [];
  }

  getTurmaById(id) {
    return this.getTurmas().find(t => t.id === id) || null;
  }

  getTurmaByCodigo(codigo) {
    if (!codigo) return null;
    const clean = codigo.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    return this.getTurmas().find(t => {
      const cur = t.codigo_acesso.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
      return cur === clean;
    }) || null;
  }

  saveTurma(turmaData) {
    const data = this.getData();
    if (!data.turmas) data.turmas = [];

    let turmaId = turmaData.id;
    if (turmaId) {
      const idx = data.turmas.findIndex(t => t.id === turmaId);
      if (idx !== -1) {
        data.turmas[idx] = { ...data.turmas[idx], ...turmaData, updatedAt: new Date().toISOString() };
      }
    } else {
      turmaId = this.generateId("turma");
      // Generate clean code if not provided
      let code = (turmaData.codigo_acesso || "").toUpperCase().trim().replace(/[^A-Z0-9]/g, "");
      if (!code) {
        const discPrefix = (turmaData.disciplina || "DISC").substring(0, 3).toUpperCase();
        const serieNum = (turmaData.serie_ano || "7").replace(/\D/g, "") || "1";
        const letSeq = Math.random().toString(36).substring(2, 4).toUpperCase();
        code = `${discPrefix}${serieNum}${letSeq}`;
      }

      const newTurma = {
        id: turmaId,
        nome: turmaData.nome,
        serie_ano: turmaData.serie_ano,
        segmento: turmaData.segmento || this.deduceSegmento(turmaData.serie_ano),
        disciplina: turmaData.disciplina,
        codigo_acesso: code,
        professor_nome: turmaData.professor_nome || "Professora",
        ano_letivo: turmaData.ano_letivo || new Date().getFullYear().toString(),
        createdAt: new Date().toISOString()
      };
      data.turmas.push(newTurma);
    }

    this.saveData(data);
    return turmaId;
  }

  deduceSegmento(serie) {
    if (!serie) return "Fundamental II";
    if (serie.includes("EM") || serie.toLowerCase().includes("médio")) return "Ensino Médio";
    const num = parseInt(serie.replace(/\D/g, ""), 10);
    if (num >= 1 && num <= 5) return "Fundamental I";
    return "Fundamental II";
  }

  deleteTurma(turmaId) {
    const data = this.getData();
    data.turmas = (data.turmas || []).filter(t => t.id !== turmaId);
    data.alunos = (data.alunos || []).filter(a => a.turma_id !== turmaId);
    
    // delete related activities, questions and answers
    const ativIds = (data.atividades || []).filter(at => at.turma_id === turmaId).map(at => at.id);
    data.atividades = (data.atividades || []).filter(at => at.turma_id !== turmaId);
    data.questoes = (data.questoes || []).filter(q => !ativIds.includes(q.atividade_id));
    data.respostas = (data.respostas || []).filter(r => !ativIds.includes(r.atividade_id));

    this.saveData(data);
  }

  // --- ALUNOS ---
  getAlunosByTurma(turmaId) {
    const data = this.getData();
    return (data.alunos || []).filter(a => a.turma_id === turmaId).sort((a, b) => a.nome_completo.localeCompare(b.nome_completo));
  }

  getAlunoById(id) {
    const data = this.getData();
    return (data.alunos || []).find(a => a.id === id) || null;
  }

  saveAluno(turmaId, nomeCompleto, pin = null) {
    const data = this.getData();
    if (!data.alunos) data.alunos = [];

    const newAluno = {
      id: this.generateId("aluno"),
      turma_id: turmaId,
      nome_completo: nomeCompleto.trim(),
      pin_4_digitos: pin ? pin.toString().padStart(4, "0") : this.generatePin(),
      createdAt: new Date().toISOString()
    };
    data.alunos.push(newAluno);
    this.saveData(data);
    return newAluno;
  }

  batchAddAlunos(turmaId, namesText) {
    const lines = namesText
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 1);

    const added = [];
    lines.forEach(name => {
      // Remove leading numbers like "01. Lucas" or "1 - Lucas"
      const cleanName = name.replace(/^\d+[\.\-\s\)]+/, "").trim();
      if (cleanName.length > 1) {
        const aluno = this.saveAluno(turmaId, cleanName);
        added.push(aluno);
      }
    });
    return added;
  }

  resetPinAluno(alunoId, newPin = null) {
    const data = this.getData();
    const aluno = (data.alunos || []).find(a => a.id === alunoId);
    if (aluno) {
      aluno.pin_4_digitos = newPin ? newPin.toString().padStart(4, "0") : this.generatePin();
      this.saveData(data);
      return aluno.pin_4_digitos;
    }
    return null;
  }

  deleteAluno(alunoId) {
    const data = this.getData();
    data.alunos = (data.alunos || []).filter(a => a.id !== alunoId);
    data.respostas = (data.respostas || []).filter(r => r.aluno_id !== alunoId);
    this.saveData(data);
  }

  // --- ATIVIDADES ---
  getAtividadesByTurma(turmaId) {
    const data = this.getData();
    return (data.atividades || []).filter(at => at.turma_id === turmaId);
  }

  getAtividadeById(id) {
    const data = this.getData();
    return (data.atividades || []).find(at => at.id === id) || null;
  }

  saveAtividade(ativData) {
    const data = this.getData();
    if (!data.atividades) data.atividades = [];

    let ativId = ativData.id;
    if (ativId) {
      const idx = data.atividades.findIndex(at => at.id === ativId);
      if (idx !== -1) {
        data.atividades[idx] = { ...data.atividades[idx], ...ativData, updatedAt: new Date().toISOString() };
      }
    } else {
      ativId = this.generateId("ativ");
      const newAtiv = {
        id: ativId,
        turma_id: ativData.turma_id,
        titulo: ativData.titulo,
        descricao: ativData.descricao || "",
        prazo_entrega: ativData.prazo_entrega || "",
        ativa: ativData.ativa !== undefined ? ativData.ativa : true,
        createdAt: new Date().toISOString()
      };
      data.atividades.push(newAtiv);
    }

    this.saveData(data);
    return ativId;
  }

  duplicateAtividade(atividadeId, targetTurmaId) {
    const ativOrigem = this.getAtividadeById(atividadeId);
    if (!ativOrigem) return null;

    const data = this.getData();
    const newAtivId = this.generateId("ativ");
    const targetTurma = this.getTurmaById(targetTurmaId);
    const turmaNome = targetTurma ? targetTurma.nome : "";

    const clonedAtiv = {
      ...ativOrigem,
      id: newAtivId,
      turma_id: targetTurmaId,
      titulo: `${ativOrigem.titulo} (${turmaNome})`,
      createdAt: new Date().toISOString()
    };
    data.atividades.push(clonedAtiv);

    // Duplicate all questions
    const questoes = (data.questoes || []).filter(q => q.atividade_id === atividadeId);
    questoes.forEach(q => {
      data.questoes.push({
        ...q,
        id: this.generateId("quest"),
        atividade_id: newAtivId
      });
    });

    this.saveData(data);
    return newAtivId;
  }

  deleteAtividade(atividadeId) {
    const data = this.getData();
    data.atividades = (data.atividades || []).filter(at => at.id !== atividadeId);
    data.questoes = (data.questoes || []).filter(q => q.atividade_id !== atividadeId);
    data.respostas = (data.respostas || []).filter(r => r.atividade_id !== atividadeId);
    this.saveData(data);
  }

  toggleAtividadeStatus(atividadeId) {
    const data = this.getData();
    const ativ = (data.atividades || []).find(at => at.id === atividadeId);
    if (ativ) {
      ativ.ativa = !ativ.ativa;
      this.saveData(data);
      return ativ.ativa;
    }
    return null;
  }

  // --- QUESTÕES ---
  getQuestoesByAtividade(atividadeId) {
    const data = this.getData();
    return (data.questoes || [])
      .filter(q => q.atividade_id === atividadeId)
      .sort((a, b) => (a.numero || 0) - (b.numero || 0));
  }

  getQuestaoById(id) {
    const data = this.getData();
    return (data.questoes || []).find(q => q.id === id) || null;
  }

  saveQuestao(qData) {
    const data = this.getData();
    if (!data.questoes) data.questoes = [];

    let qId = qData.id;
    if (qId) {
      const idx = data.questoes.findIndex(q => q.id === qId);
      if (idx !== -1) {
        data.questoes[idx] = { ...data.questoes[idx], ...qData };
      }
    } else {
      qId = this.generateId("quest");
      const currentQuestoes = data.questoes.filter(q => q.atividade_id === qData.atividade_id);
      const newQuestao = {
        id: qId,
        atividade_id: qData.atividade_id,
        numero: currentQuestoes.length + 1,
        enunciado: qData.enunciado,
        alternativas: qData.alternativas || ["A) ", "B) ", "C) ", "D) "],
        resposta_correta_index: parseInt(qData.resposta_correta_index, 10) || 0,
        dica: qData.dica || "",
        por_que_errou: qData.por_que_errou || {},
        explicacao: qData.explicacao || ""
      };
      data.questoes.push(newQuestao);
    }

    this.saveData(data);
    return qId;
  }

  deleteQuestao(qId) {
    const data = this.getData();
    data.questoes = (data.questoes || []).filter(q => q.id !== qId);
    data.respostas = (data.respostas || []).filter(r => r.questao_id !== qId);
    this.saveData(data);
  }

  // --- RESPOSTAS & MAPA DE CALOR ---
  getRespostasByAtividade(atividadeId) {
    const data = this.getData();
    return (data.respostas || []).filter(r => r.atividade_id === atividadeId);
  }

  getRespostasByAluno(alunoId, atividadeId = null) {
    const data = this.getData();
    return (data.respostas || []).filter(r => {
      const matchAluno = r.aluno_id === alunoId;
      return atividadeId ? (matchAluno && r.atividade_id === atividadeId) : matchAluno;
    });
  }

  saveResposta(respData) {
    const data = this.getData();
    if (!data.respostas) data.respostas = [];

    // Check if aluno already answered this question
    const existingIdx = data.respostas.findIndex(
      r => r.aluno_id === respData.aluno_id && r.questao_id === respData.questao_id
    );

    const record = {
      id: respData.id || this.generateId("resp"),
      atividade_id: respData.atividade_id,
      questao_id: respData.questao_id,
      aluno_id: respData.aluno_id,
      alternativa_escolhida: respData.alternativa_escolhida,
      acertou: !!respData.acertou,
      data_resposta: new Date().toISOString()
    };

    if (existingIdx !== -1) {
      data.respostas[existingIdx] = record;
    } else {
      data.respostas.push(record);
    }

    this.saveData(data);
    return record;
  }

  getAlunoAtividadeStatus(alunoId, atividadeId) {
    const questoes = this.getQuestoesByAtividade(atividadeId);
    if (!questoes.length) return { concluida: false, total: 0, respondidas: 0, acertos: 0, notaPercent: 0 };

    const respostas = this.getRespostasByAluno(alunoId, atividadeId);
    const respondidas = respostas.length;
    const acertos = respostas.filter(r => r.acertou).length;
    const total = questoes.length;
    const concluida = respondidas >= total && total > 0;
    const notaPercent = total > 0 ? Math.round((acertos / total) * 100) : 0;

    return {
      concluida,
      total,
      respondidas,
      acertos,
      notaPercent,
      respostas
    };
  }

  getAtividadeHeatmap(atividadeId) {
    const ativ = this.getAtividadeById(atividadeId);
    if (!ativ) return null;

    const turma = this.getTurmaById(ativ.turma_id);
    const questoes = this.getQuestoesByAtividade(atividadeId);
    const alunos = turma ? this.getAlunosByTurma(turma.id) : [];
    const respostas = this.getRespostasByAtividade(atividadeId);

    // Compute student matrix
    const alunosStatus = alunos.map(aluno => {
      const respAluno = respostas.filter(r => r.aluno_id === aluno.id);
      const fez = respAluno.length > 0;
      const acertos = respAluno.filter(r => r.acertou).length;
      const percentual = questoes.length > 0 ? Math.round((acertos / questoes.length) * 100) : 0;
      
      const questoesMap = {};
      questoes.forEach(q => {
        const r = respAluno.find(item => item.questao_id === q.id);
        questoesMap[q.id] = r ? {
          respondida: true,
          acertou: r.acertou,
          escolha: r.alternativa_escolhida
        } : {
          respondida: false
        };
      });

      return {
        aluno,
        fez,
        concluida: respAluno.length >= questoes.length && questoes.length > 0,
        acertos,
        percentual,
        questoesMap
      };
    });

    // Compute question diagnostics
    const questionDiagnostics = questoes.map((q, idx) => {
      const respQuestao = respostas.filter(r => r.questao_id === q.id);
      const totalRespostas = respQuestao.length;
      const acertos = respQuestao.filter(r => r.acertou).length;
      const percentualAcerto = totalRespostas > 0 ? Math.round((acertos / totalRespostas) * 100) : 0;

      // Count distribution of choices [A, B, C, D]
      const distribuicao = [0, 0, 0, 0];
      respQuestao.forEach(r => {
        if (r.alternativa_escolhida >= 0 && r.alternativa_escolhida < 4) {
          distribuicao[r.alternativa_escolhida]++;
        }
      });

      // Find top wrong answer (pegadinha mais escolhida)
      let piorDistratorIndex = -1;
      let maxDistratorCount = 0;
      distribuicao.forEach((count, optIdx) => {
        if (optIdx !== q.resposta_correta_index && count > maxDistratorCount) {
          maxDistratorCount = count;
          piorDistratorIndex = optIdx;
        }
      });

      const pegadinhaExplicacao = piorDistratorIndex !== -1 && q.por_que_errou 
        ? q.por_que_errou[piorDistratorIndex.toString()] || null
        : null;

      return {
        questao: q,
        numero: idx + 1,
        totalRespostas,
        acertos,
        erros: totalRespostas - acertos,
        percentualAcerto,
        distribuicao,
        piorDistratorIndex,
        maxDistratorCount,
        pegadinhaExplicacao,
        nivelDificuldade: percentualAcerto >= 80 ? "Fácil" : (percentualAcerto >= 60 ? "Médio" : "Desafio / Alerta")
      };
    });

    // Overall summary
    const totalEntregas = alunosStatus.filter(a => a.fez).length;
    const mediaGeralAcertos = totalEntregas > 0
      ? Math.round(alunosStatus.filter(a => a.fez).reduce((acc, a) => acc + a.percentual, 0) / totalEntregas)
      : 0;

    return {
      atividade: ativ,
      turma,
      totalAlunos: alunos.length,
      totalEntregas,
      mediaGeralAcertos,
      questionDiagnostics,
      alunosStatus
    };
  }

  // --- ESCOLA & CONFIGURAÇÃO INSTITUCIONAL ---
  getEscola() {
    const data = this.getData();
    return data.escola || (window.DEFAULT_DATA && window.DEFAULT_DATA.escola) || {
      nome: "Colégio Modelo SaberPontual",
      cidade_uf: "São Paulo - SP",
      ano_letivo: "2026",
      bimestre_ativo: "3º Bimestre",
      periodos: ["1º Bimestre", "2º Bimestre", "3º Bimestre", "4º Bimestre"]
    };
  }

  saveEscola(escolaData) {
    const data = this.getData();
    data.escola = { ...(data.escola || {}), ...escolaData };
    this.saveData(data);
    return data.escola;
  }

  // --- PROFESSORES (CORPO DOCENTE) ---
  getProfessores() {
    const data = this.getData();
    return data.professores || [];
  }

  getProfessorById(id) {
    return this.getProfessores().find(p => p.id === id) || null;
  }

  saveProfessor(profData) {
    const data = this.getData();
    if (!data.professores) data.professores = [];

    let profId = profData.id;
    if (profId) {
      const idx = data.professores.findIndex(p => p.id === profId);
      if (idx !== -1) {
        data.professores[idx] = { ...data.professores[idx], ...profData, updatedAt: new Date().toISOString() };
      }
    } else {
      profId = this.generateId("prof");
      const newProf = {
        id: profId,
        nome: profData.nome.trim(),
        email: profData.email || `${profData.nome.toLowerCase().replace(/[^a-z]/g, "")}@saberpontual.edu.br`,
        especialidade: profData.especialidade || "Docência",
        turmas_ids: profData.turmas_ids || [],
        createdAt: new Date().toISOString()
      };
      data.professores.push(newProf);
    }

    this.saveData(data);
    return profId;
  }

  deleteProfessor(profId) {
    const data = this.getData();
    data.professores = (data.professores || []).filter(p => p.id !== profId);
    this.saveData(data);
  }

  // --- AVISOS & MURAL ESCOLAR ---
  getAvisos(turmaId = null) {
    const data = this.getData();
    const todos = data.avisos || [];
    if (!turmaId) return todos;
    return todos.filter(a => a.alcance === "escola" || a.alcance === turmaId);
  }

  saveAviso(avisoData) {
    const data = this.getData();
    if (!data.avisos) data.avisos = [];

    let avId = avisoData.id;
    if (avId) {
      const idx = data.avisos.findIndex(a => a.id === avId);
      if (idx !== -1) {
        data.avisos[idx] = { ...data.avisos[idx], ...avisoData };
      }
    } else {
      avId = this.generateId("aviso");
      const newAviso = {
        id: avId,
        titulo: avisoData.titulo.trim(),
        mensagem: avisoData.mensagem.trim(),
        autor: avisoData.autor || "Coordenação Pedagógica",
        alcance: avisoData.alcance || "escola",
        prioridade: avisoData.prioridade || "media",
        data: avisoData.data || new Date().toISOString().split("T")[0]
      };
      data.avisos.unshift(newAviso);
    }

    this.saveData(data);
    return avId;
  }

  deleteAviso(avisoId) {
    const data = this.getData();
    data.avisos = (data.avisos || []).filter(a => a.id !== avisoId);
    this.saveData(data);
  }

  // --- FREQUÊNCIA ESCOLAR (DIÁRIO DE CHAMADA) ---
  getFrequencias(turmaId) {
    const data = this.getData();
    return (data.frequencias || []).filter(f => f.turma_id === turmaId).sort((a, b) => b.data.localeCompare(a.data));
  }

  getFrequenciaByData(turmaId, dataStr) {
    const list = this.getFrequencias(turmaId);
    return list.find(f => f.data === dataStr) || null;
  }

  saveFrequencia(turmaId, dataStr, presencasMap) {
    const data = this.getData();
    if (!data.frequencias) data.frequencias = [];

    const existingIdx = data.frequencias.findIndex(f => f.turma_id === turmaId && f.data === dataStr);
    const record = {
      id: existingIdx !== -1 ? data.frequencias[existingIdx].id : this.generateId("freq"),
      turma_id: turmaId,
      data: dataStr,
      presencas: presencasMap,
      updatedAt: new Date().toISOString()
    };

    if (existingIdx !== -1) {
      data.frequencias[existingIdx] = record;
    } else {
      data.frequencias.push(record);
    }

    this.saveData(data);
    return record;
  }

  getAlunoFrequenciaStats(alunoId, turmaId) {
    const freqs = this.getFrequencias(turmaId);
    const totalDias = freqs.length;
    if (totalDias === 0) {
      return { totalDias: 0, presencas: 0, faltas: 0, justificadas: 0, percentual: 100 };
    }

    let presencas = 0;
    let faltas = 0;
    let justificadas = 0;

    freqs.forEach(f => {
      const status = f.presencas ? f.presencas[alunoId] : null;
      if (status === "P") presencas++;
      else if (status === "J") { justificadas++; presencas++; }
      else if (status === "F") faltas++;
      else presencas++; // Default present if untracked
    });

    const percentual = Math.round((presencas / totalDias) * 100);
    return {
      totalDias,
      presencas,
      faltas,
      justificadas,
      percentual
    };
  }

  // --- CONSELHO DE CLASSE & BOLETIM BIMESTRAL ---
  getConselhoClasseStats(turmaId) {
    const turma = this.getTurmaById(turmaId);
    if (!turma) return null;

    const alunos = this.getAlunosByTurma(turmaId);
    const atividades = this.getAtividadesByTurma(turmaId);

    const relatorioAlunos = alunos.map((aluno, index) => {
      const freq = this.getAlunoFrequenciaStats(aluno.id, turmaId);
      
      let totalAcertos = 0;
      let totalQuestoes = 0;
      let ativConcluidas = 0;

      atividades.forEach(at => {
        const st = this.getAlunoAtividadeStatus(aluno.id, at.id);
        if (st.concluida) {
          ativConcluidas++;
          totalAcertos += st.acertos;
          totalQuestoes += st.total;
        }
      });

      const mediaNota = totalQuestoes > 0 ? Math.round((totalAcertos / totalQuestoes) * 100) : 0;

      let situacao = "Regular";
      let badgeClass = "bg-slate-100 text-slate-700";

      if (ativConcluidas === 0) {
        situacao = "Pendente de Avaliação";
        badgeClass = "bg-amber-50 text-amber-800 border border-amber-200";
      } else if (mediaNota >= 80 && freq.percentual >= 85) {
        situacao = "Aprovado / Destaque";
        badgeClass = "bg-emerald-50 text-emerald-800 border border-emerald-200";
      } else if (mediaNota >= 60 && freq.percentual >= 75) {
        situacao = "Aprovado / Bom Desempenho";
        badgeClass = "bg-indigo-50 text-indigo-800 border border-indigo-200";
      } else if (mediaNota < 60) {
        situacao = "Atenção: Necessita Reforço";
        badgeClass = "bg-rose-50 text-rose-800 border border-rose-200";
      } else if (freq.percentual < 75) {
        situacao = "Alerta: Risco por Infrequência";
        badgeClass = "bg-rose-100 text-rose-900 border border-rose-300";
      }

      return {
        numero: index + 1,
        aluno,
        freq,
        ativConcluidas,
        totalAtividades: atividades.length,
        mediaNota,
        situacao,
        badgeClass
      };
    });

    const mediaGeralTurma = relatorioAlunos.length > 0
      ? Math.round(relatorioAlunos.reduce((acc, r) => acc + r.mediaNota, 0) / relatorioAlunos.length)
      : 0;

    const mediaFrequenciaTurma = relatorioAlunos.length > 0
      ? Math.round(relatorioAlunos.reduce((acc, r) => acc + r.freq.percentual, 0) / relatorioAlunos.length)
      : 100;

    return {
      turma,
      totalAlunos: alunos.length,
      totalAtividades: atividades.length,
      mediaGeralTurma,
      mediaFrequenciaTurma,
      relatorioAlunos
    };
  }

  getEscolaOverviewStats() {
    const data = this.getData();
    const turmas = data.turmas || [];
    const alunos = data.alunos || [];
    const professores = data.professores || [];
    const atividades = data.atividades || [];
    const respostas = data.respostas || [];

    const totalRespostas = respostas.length;
    const acertos = respostas.filter(r => r.acertou).length;
    const mediaGeralEscola = totalRespostas > 0 ? Math.round((acertos / totalRespostas) * 100) : 0;

    // Segment distribution
    const segmentos = {
      fund1: { label: "Fundamental I", turmas: turmas.filter(t => t.segmento === "Fundamental I").length, alunos: 0 },
      fund2: { label: "Fundamental II", turmas: turmas.filter(t => t.segmento === "Fundamental II").length, alunos: 0 },
      medio: { label: "Ensino Médio", turmas: turmas.filter(t => t.segmento === "Ensino Médio").length, alunos: 0 }
    };

    alunos.forEach(a => {
      const t = turmas.find(item => item.id === a.turma_id);
      if (t) {
        if (t.segmento === "Fundamental I") segmentos.fund1.alunos++;
        else if (t.segmento === "Fundamental II") segmentos.fund2.alunos++;
        else if (t.segmento === "Ensino Médio") segmentos.medio.alunos++;
      }
    });

    return {
      totalTurmas: turmas.length,
      totalAlunos: alunos.length,
      totalProfessores: professores.length,
      totalAtividades: atividades.length,
      totalRespostas,
      mediaGeralEscola,
      segmentos
    };
  }

  // --- SESSIONS ---
  setCurrentStudentSession(aluno, turma) {
    localStorage.setItem(this.SESSION_KEY, JSON.stringify({ aluno, turma }));
  }

  getCurrentStudentSession() {
    try {
      const raw = localStorage.getItem(this.SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  clearStudentSession() {
    localStorage.removeItem(this.SESSION_KEY);
  }

  setCurrentTeacherClass(turmaId) {
    localStorage.setItem(this.TEACHER_KEY, turmaId);
  }

  getCurrentTeacherClass() {
    return localStorage.getItem(this.TEACHER_KEY) || null;
  }
}

window.schoolStorage = new SchoolStorage();
