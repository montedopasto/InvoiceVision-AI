/**
 * InvoiceVision AI 2.6
 * Backend Google Apps Script.
 *
 * Publicar como Web App:
 * - Executar como: o proprietário
 * - Quem tem acesso: qualquer pessoa
 *
 * A aplicação NÃO usa contas Google para autenticação. O acesso é controlado
 * pelas folhas UTILIZADORES e SESSOES.
 */

var IV = {
  TZ: Session.getScriptTimeZone() || "Europe/Lisbon",
  SESSION_HOURS: 12,
  SHEETS: {
    CONFIG: "CONFIGURACAO",
    INITIAL_ADMIN: "ADMIN_INICIAL",
    USERS: "UTILIZADORES",
    SESSIONS: "SESSOES",
    ASSOCIATIONS: "CLIENTES_VENDEDORES",
    INVOICES: "PENDENTES",
    NOTES: "NOTAS_FATURAS",
    HISTORY: "HISTORICO_IMPORTACOES"
  },
  HEADERS: {
    CONFIG: ["CHAVE", "VALOR", "DESCRICAO"],
    INITIAL_ADMIN: ["NOME", "UTILIZADOR", "PASSWORD", "EMAIL"],
    USERS: ["UTILIZADOR", "NOME", "EMAIL", "PERFIL", "VENDEDOR_ID", "SALT", "PASSWORD_HASH", "ATIVO", "CRIADO_EM", "ATUALIZADO_EM"],
    SESSIONS: ["TOKEN_HASH", "UTILIZADOR", "CRIADO_EM", "EXPIRA_EM", "ATIVO"],
    ASSOCIATIONS: ["NUMERO_CLIENTE", "NOME_CLIENTE", "VENDEDOR_ID", "ATIVO"],
    INVOICES: ["ID_FATURA", "NUMERO_CLIENTE", "NOME", "FILIAL", "DOCUMENTO", "NUMERO_DOCUMENTO", "PRT", "MOEDA", "CAMBIO", "DATA_DOCUMENTO", "DATA_VENCIMENTO", "VALOR_TOTAL", "VALOR_PENDENTE", "OBSERVACOES", "ESTADO", "IMPORTADO_EM"],
    NOTES: ["ID_FATURA", "STATUS_COBRANCA", "NOTA", "ATUALIZADO_POR", "ATUALIZADO_EM"],
    HISTORY: ["ID_IMPORTACAO", "DATA_IMPORTACAO", "NOME_FICHEIRO", "TOTAL_CLIENTES", "TOTAL_FATURAS", "VALOR_PENDENTE", "DENTRO_PRAZO_FATURAS", "DENTRO_PRAZO_VALOR", "VENCIDAS_FATURAS", "VENCIDAS_VALOR", "CONTENCIOSO_FATURAS", "CONTENCIOSO_VALOR"]
  }
};


function doGet(e) {
  try {
    var acao = String((e && e.parameter && e.parameter.acao) || "estado");
    if (acao === "estado") {
      return ivJson_({sucesso: true, estado: "online", versao: "2.6.0"});
    }
    if (acao === "dados") {
      var sessao = ivExigirSessao_((e.parameter || {}).token);
      return ivJson_({sucesso: true, dados: ivObterDados_(sessao)});
    }
    return ivJson_({sucesso: false, erro: "Ação inválida."});
  } catch (erro) {
    return ivErro_(erro);
  }
}


function doPost(e) {
  try {
    var pedido = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    var acao = String(pedido.acao || "");

    if (acao === "login") {
      return ivJson_(ivLogin_(pedido.utilizador, pedido.palavraPasse));
    }
    if (acao === "logout") {
      ivLogout_(pedido.token);
      return ivJson_({sucesso: true});
    }

    var sessao = ivExigirSessao_(pedido.token);
    if (acao === "dados") {
      return ivJson_({sucesso: true, dados: ivObterDados_(sessao)});
    }
    if (acao === "guardarNota") {
      return ivJson_(ivGuardarNota_(sessao, pedido));
    }
    if (acao === "criarUtilizador") {
      ivExigirAdmin_(sessao);
      return ivJson_(ivCriarUtilizador_(pedido));
    }
    if (acao === "apagarUtilizador") {
      ivExigirAdmin_(sessao);
      return ivJson_(ivApagarUtilizador_(sessao, pedido.utilizador));
    }
    if (acao === "importar") {
      ivExigirAdmin_(sessao);
      return ivJson_({sucesso: true, resultado: ivImportar_(pedido)});
    }
    return ivJson_({sucesso: false, erro: "Ação inválida."});
  } catch (erro) {
    return ivErro_(erro);
  }
}


/**
 * Execute uma vez. Cria as folhas, valida a estrutura e instala os triggers.
 */
function configurarInvoiceVision() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ivGarantirFolha_(ss, IV.SHEETS.CONFIG, IV.HEADERS.CONFIG);
  ivGarantirFolha_(ss, IV.SHEETS.INITIAL_ADMIN, IV.HEADERS.INITIAL_ADMIN);
  ivGarantirFolha_(ss, IV.SHEETS.USERS, IV.HEADERS.USERS);
  ivGarantirFolha_(ss, IV.SHEETS.SESSIONS, IV.HEADERS.SESSIONS);
  ivGarantirFolha_(ss, IV.SHEETS.ASSOCIATIONS, IV.HEADERS.ASSOCIATIONS);
  ivGarantirFolha_(ss, IV.SHEETS.NOTES, IV.HEADERS.NOTES);
  ivGarantirFolha_(ss, IV.SHEETS.HISTORY, IV.HEADERS.HISTORY);
  ivPrepararFolhaPendentes_(ss);
  ivPreencherConfiguracaoInicial_();
  instalarTriggers();
  SpreadsheetApp.flush();
}


/**
 * Converte automaticamente a estrutura antiga de PENDENTES, preservando uma
 * cópia integral antes de alterar a folha utilizada pela aplicação.
 */
function ivPrepararFolhaPendentes_(ss) {
  var folha = ss.getSheetByName(IV.SHEETS.INVOICES);
  if (!folha) {
    return ivGarantirFolha_(ss, IV.SHEETS.INVOICES, IV.HEADERS.INVOICES);
  }

  var ultimaColuna = folha.getLastColumn();
  if (!ultimaColuna) {
    return ivGarantirFolha_(ss, IV.SHEETS.INVOICES, IV.HEADERS.INVOICES);
  }
  var cabecalhos = folha.getRange(1, 1, 1, ultimaColuna).getValues()[0]
    .map(function(valor) { return String(valor || "").trim(); });
  if (cabecalhos[0] === "ID_FATURA") {
    return ivGarantirFolha_(ss, IV.SHEETS.INVOICES, IV.HEADERS.INVOICES);
  }

  var nomeBackup = "PENDENTES_BACKUP_" +
    Utilities.formatDate(new Date(), IV.TZ, "yyyyMMdd_HHmmss");
  folha.copyTo(ss).setName(nomeBackup);

  var dados = folha.getDataRange().getValues();
  var agora = new Date();
  var migrados = [];
  for (var i = 1; i < dados.length; i++) {
    var antiga = {};
    for (var c = 0; c < cabecalhos.length; c++) {
      antiga[cabecalhos[c]] = dados[i][c];
    }
    var numeroCliente = ivCampo_(antiga, ["N.", "N", "NUMERO_CLIENTE", "Numero Cliente", "Número Cliente"]);
    var nome = ivCampo_(antiga, ["Nome", "NOME"]);
    var documento = ivCampo_(antiga, ["Documento", "DOCUMENTO"]);
    var numeroDocumento = ivCampo_(antiga, ["N.º Doc.", "Nº Doc.", "NUMERO_DOCUMENTO", "Numero Documento"]);
    var vencimento = ivCampo_(antiga, ["Dt. Venc.", "DATA_VENCIMENTO", "Data Vencimento"]);
    var observacoes = ivCampo_(antiga, ["Obs.", "OBSERVACOES", "Observações", "Observacoes"]);
    var valorPendente = ivCampo_(antiga, ["Val. Pendente", "VALOR_PENDENTE", "Valor Pendente"]);

    if (!numeroCliente && !nome && !documento && !numeroDocumento && !valorPendente) {
      continue;
    }
    migrados.push([
      ivIdFatura_(numeroCliente, documento, numeroDocumento, vencimento),
      numeroCliente,
      nome,
      ivCampo_(antiga, ["Filial", "FILIAL"]),
      documento,
      numeroDocumento,
      ivCampo_(antiga, ["Prt.", "PRT"]),
      ivCampo_(antiga, ["M.", "MOEDA", "Moeda"]),
      ivNumero_(ivCampo_(antiga, ["Câmbio", "Cambio", "CAMBIO"])),
      ivCampo_(antiga, ["Dt. Doc.", "DATA_DOCUMENTO", "Data Documento"]),
      vencimento,
      ivNumero_(ivCampo_(antiga, ["Valor Total", "VALOR_TOTAL"])),
      ivNumero_(valorPendente),
      observacoes,
      ivEstado_(vencimento, observacoes),
      agora
    ]);
  }

  folha.clearContents();
  folha.getRange(1, 1, 1, IV.HEADERS.INVOICES.length)
    .setValues([IV.HEADERS.INVOICES]);
  if (migrados.length) {
    folha.getRange(2, 1, migrados.length, IV.HEADERS.INVOICES.length)
      .setValues(migrados);
  }
  folha.setFrozenRows(1);
  ivFormatarCabecalho_(folha, IV.HEADERS.INVOICES.length);
  return folha;
}


/**
 * Cria o único administrador inicial a partir da folha ADMIN_INICIAL.
 * Depois do primeiro acesso, todos os utilizadores são geridos na aplicação.
 */
function criarAdministradorInicial() {
  if (ivTotalUtilizadores_() !== 0) {
    throw new Error("Já existem utilizadores. Use o menu Utilizadores da aplicação.");
  }
  var folha = ivFolha_(IV.SHEETS.INITIAL_ADMIN);
  var linha = folha.getRange(2, 1, 1, 4).getValues()[0];
  var resultado = ivCriarUtilizador_({
    nome: linha[0],
    utilizador: linha[1],
    palavraPasse: linha[2],
    email: linha[3],
    perfil: "ADMIN",
    vendedorId: ""
  });
  folha.getRange(2, 3).clearContent();
  return resultado;
}


/**
 * Reexecutável: remove apenas triggers geridos pelo InvoiceVision e recria-os.
 */
function instalarTriggers() {
  var nomes = ["enviarResumoSemanalVendedores", "enviarAvisosDiariosSemNota", "importarPendentesDoDrive", "limparSessoesExpiradas"];
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (nomes.indexOf(trigger.getHandlerFunction()) !== -1) {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  var config = ivLerConfiguracao_();
  var dia = String(config.RESUMO_SEMANAL_DIA || "MONDAY").toUpperCase();
  var dias = {
    MONDAY: ScriptApp.WeekDay.MONDAY,
    TUESDAY: ScriptApp.WeekDay.TUESDAY,
    WEDNESDAY: ScriptApp.WeekDay.WEDNESDAY,
    THURSDAY: ScriptApp.WeekDay.THURSDAY,
    FRIDAY: ScriptApp.WeekDay.FRIDAY
  };
  var horaSemanal = ivLimitarHora_(config.RESUMO_SEMANAL_HORA, 8);
  var horaDiaria = ivLimitarHora_(config.AVISO_DIARIO_HORA, 9);
  var horaImportacao = ivLimitarHora_(config.IMPORTACAO_AUTOMATICA_HORA, 6);

  ScriptApp.newTrigger("enviarResumoSemanalVendedores")
    .timeBased().onWeekDay(dias[dia] || ScriptApp.WeekDay.MONDAY)
    .atHour(horaSemanal).create();
  ScriptApp.newTrigger("enviarAvisosDiariosSemNota")
    .timeBased().everyDays(1).atHour(horaDiaria).create();
  ScriptApp.newTrigger("importarPendentesDoDrive")
    .timeBased().everyDays(1).atHour(horaImportacao).create();
  ScriptApp.newTrigger("limparSessoesExpiradas")
    .timeBased().everyDays(1).atHour(3).create();
}


/**
 * Procura ficheiros Excel na pasta configurada, importa-os por ordem de data
 * e move cada ficheiro concluído para a subpasta Processados.
 * Requer o serviço avançado Google Drive API no projeto Apps Script.
 */
function importarPendentesDoDrive() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    var config = ivLerConfiguracao_();
    var pastaId = String(config.PASTA_DRIVE_PENDENTES_ID || "").trim();
    if (!pastaId) {
      throw new Error("Preencha PASTA_DRIVE_PENDENTES_ID na folha CONFIGURACAO.");
    }

    var pasta = DriveApp.getFolderById(pastaId);
    var processados = ivObterOuCriarSubpasta_(pasta, "Processados");
    var ficheiros = pasta.getFiles();
    var excel = [];
    while (ficheiros.hasNext()) {
      var ficheiro = ficheiros.next();
      var nome = String(ficheiro.getName() || "");
      if (/\.xlsx?$/i.test(nome)) excel.push(ficheiro);
    }
    excel.sort(function(a, b) {
      return a.getLastUpdated().getTime() - b.getLastUpdated().getTime();
    });
    if (!excel.length) return {sucesso: true, importados: 0};

    var resultados = [];
    excel.forEach(function(ficheiro) {
      var linhas = ivLerExcelPendentes_(ficheiro);
      var resultado = ivImportar_({
        nomeFicheiro: ficheiro.getName(),
        linhas: linhas
      });
      ficheiro.moveTo(processados);
      resultados.push(resultado);
    });
    return {sucesso: true, importados: resultados.length, resultados: resultados};
  } catch (erro) {
    ivNotificarAdminsErroImportacao_(erro);
    throw erro;
  } finally {
    lock.releaseLock();
  }
}


function ivLerExcelPendentes_(ficheiro) {
  var temporario;
  try {
    temporario = Drive.Files.create({
      name: "InvoiceVision_TEMP_" + new Date().getTime(),
      mimeType: "application/vnd.google-apps.spreadsheet"
    }, ficheiro.getBlob(), {fields: "id"});
    var livro = SpreadsheetApp.openById(temporario.id);
    var folha = livro.getSheetByName("PENDENTES") || livro.getSheets()[0];
    var valores = folha.getDataRange().getValues();
    if (valores.length < 2) throw new Error("O Excel não contém faturas.");

    var cabecalhos = valores[0].map(function(valor) {
      return String(valor || "").trim();
    });
    var obrigatorios = ["Entidade", "Entidade (Nome)", "Documento", "N.º Doc.", "Data Venc.", "Valor Pendente"];
    obrigatorios.forEach(function(cabecalho) {
      if (cabecalhos.indexOf(cabecalho) === -1) {
        throw new Error("Falta a coluna '" + cabecalho + "' no ficheiro " + ficheiro.getName() + ".");
      }
    });

    return valores.slice(1).filter(function(linha) {
      return linha.some(function(valor) { return valor !== "" && valor != null; });
    }).map(function(linha) {
      var origem = {};
      cabecalhos.forEach(function(cabecalho, indice) {
        origem[cabecalho] = linha[indice];
      });
      return {
        "N.": origem["Entidade"],
        "Nome": origem["Entidade (Nome)"],
        "Filial": "",
        "Documento": origem["Documento"],
        "N.º Doc.": origem["N.º Doc."],
        "Prt.": origem["Prt."],
        "M.": origem["Moeda"],
        "Câmbio": 1,
        "Dt. Doc.": origem["Data Doc."],
        "Dt. Venc.": origem["Data Venc."],
        "Valor Total": origem["Valor Total"],
        "Val. Pendente": origem["Valor Pendente"],
        "Obs.": origem["Obs."]
      };
    });
  } finally {
    if (temporario && temporario.id) {
      DriveApp.getFileById(temporario.id).setTrashed(true);
    }
  }
}


function ivObterOuCriarSubpasta_(pasta, nome) {
  var existentes = pasta.getFoldersByName(nome);
  return existentes.hasNext() ? existentes.next() : pasta.createFolder(nome);
}


function ivNotificarAdminsErroImportacao_(erro) {
  ivListarUtilizadores_().filter(function(user) {
    return user.ativo && user.perfil === "ADMIN" && user.email;
  }).forEach(function(admin) {
    MailApp.sendEmail({
      to: admin.email,
      subject: "InvoiceVision — erro na importação automática",
      body: "A importação automática não foi concluída.\n\n" + String(erro && erro.message || erro),
      name: "InvoiceVision AI"
    });
  });
}


/**
 * Cria ou atualiza um utilizador a partir de uma linha da folha UTILIZADORES.
 * Para definir uma palavra-passe sem guardar texto simples:
 * 1. Preencha UTILIZADOR, NOME, EMAIL, PERFIL, VENDEDOR_ID e ATIVO.
 * 2. Na folha CONFIGURACAO use NOVO_UTILIZADOR e NOVA_PASSWORD.
 * 3. Execute definirPasswordDaConfiguracao().
 */
function definirPasswordDaConfiguracao() {
  var config = ivLerConfiguracao_();
  var username = ivNormalizarUsername_(config.NOVO_UTILIZADOR);
  var password = String(config.NOVA_PASSWORD || "");
  if (!username || password.length < 8) {
    throw new Error("Indique NOVO_UTILIZADOR e uma NOVA_PASSWORD com pelo menos 8 caracteres.");
  }
  ivDefinirPassword_(username, password);
  ivApagarValorConfiguracao_("NOVA_PASSWORD");
}


function enviarResumoSemanalVendedores() {
  var dados = ivCarregarModelo_();
  ivVendedoresAtivos_().forEach(function(vendedor) {
    if (!vendedor.email) return;
    var faturas = ivFaturasDoVendedor_(dados, vendedor)
      .filter(function(fatura) { return fatura.estado !== "CONTENCIOSO"; });
    if (!faturas.length) return;
    ivEnviarResumoSemanal_(vendedor, faturas);
  });
}


function enviarAvisosDiariosSemNota() {
  var dados = ivCarregarModelo_();
  ivVendedoresAtivos_().forEach(function(vendedor) {
    if (!vendedor.email) return;
    var faturas = ivFaturasDoVendedor_(dados, vendedor).filter(function(fatura) {
      return fatura.estado === "VENCIDA" &&
        !String(fatura.nota || "").trim() &&
        !String(fatura.statusCobranca || "").trim();
    });
    if (faturas.length) {
      ivEnviarAvisoDiario_(vendedor, faturas);
    }
  });
}


function limparSessoesExpiradas() {
  var folha = ivFolha_(IV.SHEETS.SESSIONS);
  var valores = folha.getDataRange().getValues();
  if (valores.length <= 1) return;
  var agora = new Date().getTime();
  var ativas = [IV.HEADERS.SESSIONS];
  for (var i = 1; i < valores.length; i++) {
    var expira = new Date(valores[i][3]).getTime();
    if (String(valores[i][4]).toUpperCase() === "SIM" && expira > agora) {
      ativas.push(valores[i]);
    }
  }
  folha.clearContents();
  folha.getRange(1, 1, ativas.length, ativas[0].length).setValues(ativas);
  ivFormatarCabecalho_(folha, IV.HEADERS.SESSIONS.length);
}


function ivLogin_(username, password) {
  username = ivNormalizarUsername_(username);
  password = String(password || "");
  var user = ivEncontrarUtilizador_(username);
  if (!user || !user.ativo || !ivComparacaoSegura_(user.passwordHash, ivHashPassword_(password, user.salt))) {
    Utilities.sleep(350);
    return {sucesso: false, erro: "Utilizador ou palavra-passe inválidos."};
  }

  var token = Utilities.getUuid() + Utilities.getUuid() + String(Math.random()).slice(2);
  var agora = new Date();
  var expira = new Date(agora.getTime() + IV.SESSION_HOURS * 3600000);
  ivFolha_(IV.SHEETS.SESSIONS).appendRow([
    ivSha256_(token), user.utilizador, agora, expira, "SIM"
  ]);
  return {
    sucesso: true,
    token: token,
    expiraEm: ivDataHora_(expira),
    utilizador: ivUtilizadorPublico_(user)
  };
}


function ivLogout_(token) {
  if (!token) return;
  var hash = ivSha256_(String(token));
  var folha = ivFolha_(IV.SHEETS.SESSIONS);
  var valores = folha.getDataRange().getValues();
  for (var i = 1; i < valores.length; i++) {
    if (String(valores[i][0]) === hash) {
      folha.getRange(i + 1, 5).setValue("NAO");
      return;
    }
  }
}


function ivExigirSessao_(token) {
  if (!token) {
    throw ivErroCodigo_("Sessão inválida ou terminada.", "NAO_AUTORIZADO");
  }
  var hash = ivSha256_(String(token));
  var valores = ivFolha_(IV.SHEETS.SESSIONS).getDataRange().getValues();
  var agora = new Date().getTime();
  for (var i = valores.length - 1; i >= 1; i--) {
    if (String(valores[i][0]) === hash &&
        String(valores[i][4]).toUpperCase() === "SIM" &&
        new Date(valores[i][3]).getTime() > agora) {
      var user = ivEncontrarUtilizador_(valores[i][1]);
      if (!user || !user.ativo) break;
      return user;
    }
  }
  throw ivErroCodigo_("Sessão inválida ou terminada.", "NAO_AUTORIZADO");
}


function ivExigirAdmin_(sessao) {
  if (sessao.perfil !== "ADMIN") {
    throw ivErroCodigo_("Apenas administradores podem executar esta operação.", "PROIBIDO");
  }
}


function ivObterDados_(sessao) {
  var modelo = ivCarregarModelo_();
  var admin = sessao.perfil === "ADMIN";
  var pessoais = admin
    ? modelo.faturas.filter(function(f) { return f.estado !== "CONTENCIOSO"; })
    : ivFaturasDoVendedor_(modelo, sessao).filter(function(f) { return f.estado !== "CONTENCIOSO"; });
  var globais = admin ? modelo.faturas : pessoais;

  return {
    utilizador: ivUtilizadorPublico_(sessao),
    utilizadores: admin ? ivListarUtilizadores_() : [],
    resumo: ivResumo_(globais),
    pendentes: globais,
    minhasFaturas: pessoais,
    rankingClientes: ivRankingClientes_(globais),
    historicoEvolucao: admin ? modelo.historico : [],
    historicoDetalhado: [],
    ultimaImportacao: modelo.historico.length
      ? modelo.historico[modelo.historico.length - 1]
      : null
  };
}


function ivCriarUtilizador_(pedido) {
  var username = ivNormalizarUsername_(pedido.utilizador);
  var nome = String(pedido.nome || "").trim();
  var email = String(pedido.email || "").trim();
  var password = String(pedido.palavraPasse || "");
  var perfil = String(pedido.perfil || "VENDEDOR").trim().toUpperCase();
  var vendedorId = String(pedido.vendedorId || "").trim();

  if (!username || !/^[a-z0-9._-]{3,40}$/.test(username)) {
    throw new Error("O utilizador deve ter entre 3 e 40 caracteres e usar apenas letras, números, ponto, hífen ou underscore.");
  }
  if (!nome) throw new Error("Indique o nome.");
  if (!email || email.indexOf("@") < 1) throw new Error("Indique um email válido.");
  if (password.length < 8) throw new Error("A password deve ter pelo menos 8 caracteres.");
  if (perfil !== "ADMIN" && perfil !== "VENDEDOR") throw new Error("Perfil inválido.");
  if (perfil === "VENDEDOR" && !vendedorId) throw new Error("Indique o código do vendedor.");
  if (ivEncontrarUtilizador_(username)) throw new Error("Já existe um utilizador com esse nome.");

  var agora = new Date();
  var salt = Utilities.getUuid();
  ivFolha_(IV.SHEETS.USERS).appendRow([
    username, nome, email, perfil, perfil === "VENDEDOR" ? vendedorId : "",
    salt, ivHashPassword_(password, salt), "SIM", agora, agora
  ]);
  return {
    sucesso: true,
    utilizador: {
      utilizador: username,
      nome: nome,
      email: email,
      perfil: perfil,
      vendedorId: perfil === "VENDEDOR" ? vendedorId : "",
      ativo: true
    }
  };
}


function ivTotalUtilizadores_() {
  var folha = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(IV.SHEETS.USERS);
  if (!folha || folha.getLastRow() <= 1) return 0;
  return folha.getRange(2, 1, folha.getLastRow() - 1, 1).getValues()
    .filter(function(linha) { return String(linha[0] || "").trim(); }).length;
}


function ivApagarUtilizador_(sessao, username) {
  username = ivNormalizarUsername_(username);
  if (!username) throw new Error("Utilizador inválido.");
  if (username === sessao.utilizador) {
    throw new Error("Não pode apagar a conta com que iniciou sessão.");
  }
  var folha = ivFolha_(IV.SHEETS.USERS);
  var valores = folha.getDataRange().getValues();
  for (var i = 1; i < valores.length; i++) {
    if (ivNormalizarUsername_(valores[i][0]) === username) {
      folha.deleteRow(i + 1);
      return {sucesso: true};
    }
  }
  throw new Error("O utilizador já não existe.");
}


function ivListarUtilizadores_() {
  var valores = ivFolha_(IV.SHEETS.USERS).getDataRange().getValues();
  var lista = [];
  for (var i = 1; i < valores.length; i++) {
    if (!valores[i][0]) continue;
    var user = ivUserDaLinha_(valores[i]);
    lista.push({
      utilizador: user.utilizador,
      nome: user.nome,
      email: user.email,
      perfil: user.perfil,
      vendedorId: user.vendedorId,
      ativo: user.ativo
    });
  }
  return lista.sort(function(a, b) {
    return String(a.nome).localeCompare(String(b.nome));
  });
}


function ivGuardarNota_(sessao, pedido) {
  var id = String(pedido.idFatura || "").trim();
  var status = String(pedido.status || "").trim().toUpperCase();
  var nota = String(pedido.nota || "").trim();
  if (!id) throw new Error("Fatura inválida.");
  if (nota.length > 2000) throw new Error("A nota não pode exceder 2000 caracteres.");

  var permitidos = ["", "CONTACTAR", "CONTACTADO", "PROMESSA_PAGAMENTO", "EM_ANALISE", "CONTESTADA", "PAGO_AGUARDA_BAIXA"];
  if (permitidos.indexOf(status) === -1) throw new Error("Status inválido.");

  var modelo = ivCarregarModelo_();
  var fatura = modelo.faturas.filter(function(item) { return item.idFatura === id; })[0];
  if (!fatura || fatura.estado === "CONTENCIOSO") {
    throw ivErroCodigo_("Fatura indisponível.", "PROIBIDO");
  }
  if (sessao.perfil !== "ADMIN") {
    var autorizadas = ivFaturasDoVendedor_(modelo, sessao);
    if (!autorizadas.some(function(item) { return item.idFatura === id; })) {
      throw ivErroCodigo_("Não tem acesso a esta fatura.", "PROIBIDO");
    }
  }

  var folha = ivFolha_(IV.SHEETS.NOTES);
  var valores = folha.getDataRange().getValues();
  var agora = new Date();
  var linha = [id, status, nota, sessao.utilizador, agora];
  var atualizada = false;
  for (var i = 1; i < valores.length; i++) {
    if (String(valores[i][0]) === id) {
      folha.getRange(i + 1, 1, 1, linha.length).setValues([linha]);
      atualizada = true;
      break;
    }
  }
  if (!atualizada) folha.appendRow(linha);
  return {sucesso: true, atualizadaEm: ivDataHora_(agora)};
}


function ivImportar_(pedido) {
  var linhas = Array.isArray(pedido.linhas) ? pedido.linhas : [];
  if (!linhas.length) throw new Error("O ficheiro não contém linhas.");
  var agora = new Date();
  var valores = linhas.map(function(linha) {
    var numeroCliente = ivCampo_(linha, ["N.", "N", "Numero Cliente", "Número Cliente"]);
    var documento = ivCampo_(linha, ["Documento"]);
    var numeroDocumento = ivCampo_(linha, ["N.º Doc.", "Nº Doc.", "Numero Documento"]);
    var vencimento = ivCampo_(linha, ["Dt. Venc.", "Data Vencimento"]);
    var observacoes = ivCampo_(linha, ["Obs.", "Observações", "Observacoes"]);
    var estado = ivEstado_(vencimento, observacoes);
    var id = ivIdFatura_(numeroCliente, documento, numeroDocumento, vencimento);
    return [
      id,
      numeroCliente,
      ivCampo_(linha, ["Nome"]),
      ivCampo_(linha, ["Filial"]),
      documento,
      numeroDocumento,
      ivCampo_(linha, ["Prt."]),
      ivCampo_(linha, ["M.", "Moeda"]),
      ivNumero_(ivCampo_(linha, ["Câmbio", "Cambio"])),
      ivCampo_(linha, ["Dt. Doc.", "Data Documento"]),
      vencimento,
      ivNumero_(ivCampo_(linha, ["Valor Total"])),
      ivNumero_(ivCampo_(linha, ["Val. Pendente", "Valor Pendente"])),
      observacoes,
      estado,
      agora
    ];
  });

  var folha = ivFolha_(IV.SHEETS.INVOICES);
  folha.clearContents();
  folha.getRange(1, 1, 1, IV.HEADERS.INVOICES.length).setValues([IV.HEADERS.INVOICES]);
  if (valores.length) {
    folha.getRange(2, 1, valores.length, IV.HEADERS.INVOICES.length).setValues(valores);
  }
  ivFormatarCabecalho_(folha, IV.HEADERS.INVOICES.length);

  var faturas = valores.map(ivLinhaFatura_);
  ivSincronizarClientesVendedores_(faturas);
  var resumo = ivResumo_(faturas);
  var idImportacao = Utilities.formatDate(agora, IV.TZ, "yyyyMMdd-HHmmss");
  ivFolha_(IV.SHEETS.HISTORY).appendRow([
    idImportacao, agora, String(pedido.nomeFicheiro || ""),
    resumo.totalClientes, resumo.totalFaturas, resumo.valorPendente,
    resumo.dentroPrazo.totalFaturas, resumo.dentroPrazo.valorPendente,
    resumo.vencidas.totalFaturas, resumo.vencidas.valorPendente,
    resumo.contencioso.totalFaturas, resumo.contencioso.valorPendente
  ]);
  return {
    idImportacao: idImportacao,
    dataImportacao: ivDataHora_(agora),
    nomeFicheiro: String(pedido.nomeFicheiro || ""),
    totalLinhas: faturas.length,
    totalClientes: resumo.totalClientes,
    totalFaturas: resumo.totalFaturas,
    valorPendente: resumo.valorPendente
  };
}


/**
 * Mantém automaticamente a lista de clientes encontrada nas importações.
 * Associações já atribuídas são preservadas; clientes novos ficam sem vendedor.
 */
function ivSincronizarClientesVendedores_(faturas) {
  var folha = ivFolha_(IV.SHEETS.ASSOCIATIONS);
  var valores = folha.getDataRange().getValues();
  var existentes = {};
  for (var i = 1; i < valores.length; i++) {
    var numeroExistente = String(valores[i][0] || "").trim();
    if (numeroExistente) existentes[numeroExistente] = i + 1;
  }

  var clientes = {};
  faturas.forEach(function(fatura) {
    var numero = String(fatura.numeroCliente || "").trim();
    if (!numero) return;
    clientes[numero] = String(fatura.nome || "").trim();
  });

  var novos = [];
  Object.keys(clientes).sort().forEach(function(numero) {
    var linha = existentes[numero];
    if (linha) {
      if (String(folha.getRange(linha, 2).getValue() || "").trim() !== clientes[numero]) {
        folha.getRange(linha, 2).setValue(clientes[numero]);
      }
    } else {
      novos.push([numero, clientes[numero], "", "SIM"]);
    }
  });

  if (novos.length) {
    folha.getRange(folha.getLastRow() + 1, 1, novos.length, 4).setValues(novos);
  }
}


function ivCarregarModelo_() {
  var notas = {};
  var valoresNotas = ivFolha_(IV.SHEETS.NOTES).getDataRange().getValues();
  for (var n = 1; n < valoresNotas.length; n++) {
    notas[String(valoresNotas[n][0])] = {
      statusCobranca: String(valoresNotas[n][1] || ""),
      nota: String(valoresNotas[n][2] || ""),
      notaAtualizadaPor: String(valoresNotas[n][3] || ""),
      notaAtualizadaEm: ivDataHoraOpcional_(valoresNotas[n][4])
    };
  }

  var valores = ivFolha_(IV.SHEETS.INVOICES).getDataRange().getValues();
  var faturas = [];
  for (var i = 1; i < valores.length; i++) {
    if (!valores[i][0]) continue;
    var fatura = ivLinhaFatura_(valores[i]);
    var nota = notas[fatura.idFatura] || {};
    Object.keys(nota).forEach(function(chave) { fatura[chave] = nota[chave]; });
    faturas.push(fatura);
  }

  var associacoes = {};
  var valoresAssoc = ivFolha_(IV.SHEETS.ASSOCIATIONS).getDataRange().getValues();
  for (var a = 1; a < valoresAssoc.length; a++) {
    if (String(valoresAssoc[a][3]).toUpperCase() === "NAO") continue;
    associacoes[String(valoresAssoc[a][0]).trim()] = String(valoresAssoc[a][2]).trim();
  }

  var historico = [];
  var valoresHist = ivFolha_(IV.SHEETS.HISTORY).getDataRange().getValues();
  for (var h = 1; h < valoresHist.length; h++) {
    historico.push({
      idImportacao: String(valoresHist[h][0]),
      dataImportacao: ivDataHoraOpcional_(valoresHist[h][1]),
      data: ivDataHoraOpcional_(valoresHist[h][1]),
      nomeFicheiro: String(valoresHist[h][2] || ""),
      totalClientes: Number(valoresHist[h][3] || 0),
      totalFaturas: Number(valoresHist[h][4] || 0),
      valorPendente: Number(valoresHist[h][5] || 0),
      dentroPrazo: {totalFaturas: Number(valoresHist[h][6] || 0), valorPendente: Number(valoresHist[h][7] || 0)},
      vencidas: {totalFaturas: Number(valoresHist[h][8] || 0), valorPendente: Number(valoresHist[h][9] || 0)},
      contencioso: {totalFaturas: Number(valoresHist[h][10] || 0), valorPendente: Number(valoresHist[h][11] || 0)}
    });
  }
  return {faturas: faturas, associacoes: associacoes, historico: historico};
}


function ivLinhaFatura_(linha) {
  return {
    idFatura: String(linha[0] || ""),
    numeroCliente: String(linha[1] || ""),
    nome: String(linha[2] || ""),
    filial: String(linha[3] || ""),
    documento: String(linha[4] || ""),
    numeroDocumento: String(linha[5] || ""),
    prt: String(linha[6] || ""),
    moeda: String(linha[7] || ""),
    cambio: Number(linha[8] || 0),
    dataDocumento: ivTextoData_(linha[9]),
    dataVencimento: ivTextoData_(linha[10]),
    valorTotal: Number(linha[11] || 0),
    valorPendente: Number(linha[12] || 0),
    observacoes: String(linha[13] || ""),
    estado: String(linha[14] || "")
  };
}


function ivFaturasDoVendedor_(modelo, vendedor) {
  var vendedorId = String(vendedor.vendedorId || vendedor.utilizador).trim();
  return modelo.faturas.filter(function(fatura) {
    return String(modelo.associacoes[fatura.numeroCliente] || "") === vendedorId;
  });
}


function ivResumo_(faturas) {
  var clientes = {};
  var resumo = {
    totalClientes: 0, totalFaturas: faturas.length, valorTotal: 0,
    valorPendente: 0, totalVencidas: 0, totalDentroPrazo: 0,
    totalContencioso: 0,
    dentroPrazo: {totalFaturas: 0, valorPendente: 0},
    vencidas: {totalFaturas: 0, valorPendente: 0},
    contencioso: {totalFaturas: 0, valorPendente: 0}
  };
  faturas.forEach(function(f) {
    clientes[f.numeroCliente || f.nome] = true;
    resumo.valorTotal += Number(f.valorTotal || 0);
    resumo.valorPendente += Number(f.valorPendente || 0);
    if (f.estado === "CONTENCIOSO") {
      resumo.contencioso.totalFaturas++;
      resumo.contencioso.valorPendente += Number(f.valorPendente || 0);
    } else if (f.estado === "VENCIDA") {
      resumo.vencidas.totalFaturas++;
      resumo.vencidas.valorPendente += Number(f.valorPendente || 0);
    } else {
      resumo.dentroPrazo.totalFaturas++;
      resumo.dentroPrazo.valorPendente += Number(f.valorPendente || 0);
    }
  });
  resumo.totalClientes = Object.keys(clientes).length;
  resumo.totalVencidas = resumo.vencidas.totalFaturas;
  resumo.totalDentroPrazo = resumo.dentroPrazo.totalFaturas;
  resumo.totalContencioso = resumo.contencioso.totalFaturas;
  return resumo;
}


function ivRankingClientes_(faturas) {
  var mapa = {};
  faturas.forEach(function(f) {
    var chave = f.numeroCliente || f.nome;
    if (!mapa[chave]) {
      mapa[chave] = {numeroCliente: f.numeroCliente, nome: f.nome, totalFaturas: 0, valorPendente: 0};
    }
    mapa[chave].totalFaturas++;
    mapa[chave].valorPendente += Number(f.valorPendente || 0);
  });
  return Object.keys(mapa).map(function(chave) { return mapa[chave]; })
    .sort(function(a, b) { return b.valorPendente - a.valorPendente; }).slice(0, 10);
}


function ivVendedoresAtivos_() {
  var valores = ivFolha_(IV.SHEETS.USERS).getDataRange().getValues();
  var lista = [];
  for (var i = 1; i < valores.length; i++) {
    var user = ivUserDaLinha_(valores[i]);
    if (user.ativo && user.perfil === "VENDEDOR") lista.push(user);
  }
  return lista;
}


function ivEncontrarUtilizador_(username) {
  username = ivNormalizarUsername_(username);
  var valores = ivFolha_(IV.SHEETS.USERS).getDataRange().getValues();
  for (var i = 1; i < valores.length; i++) {
    if (ivNormalizarUsername_(valores[i][0]) === username) {
      return ivUserDaLinha_(valores[i]);
    }
  }
  return null;
}


function ivUserDaLinha_(linha) {
  return {
    utilizador: ivNormalizarUsername_(linha[0]),
    nome: String(linha[1] || ""),
    email: String(linha[2] || ""),
    perfil: String(linha[3] || "VENDEDOR").toUpperCase(),
    vendedorId: String(linha[4] || linha[0] || ""),
    salt: String(linha[5] || ""),
    passwordHash: String(linha[6] || ""),
    ativo: String(linha[7] || "SIM").toUpperCase() === "SIM"
  };
}


function ivUtilizadorPublico_(user) {
  return {
    utilizador: user.utilizador,
    nome: user.nome,
    email: user.email,
    perfil: user.perfil,
    vendedorId: user.vendedorId
  };
}


function ivDefinirPassword_(username, password) {
  var folha = ivFolha_(IV.SHEETS.USERS);
  var valores = folha.getDataRange().getValues();
  for (var i = 1; i < valores.length; i++) {
    if (ivNormalizarUsername_(valores[i][0]) === username) {
      var salt = Utilities.getUuid();
      folha.getRange(i + 1, 6).setValue(salt);
      folha.getRange(i + 1, 7).setValue(ivHashPassword_(password, salt));
      folha.getRange(i + 1, 10).setValue(new Date());
      return;
    }
  }
  throw new Error("O utilizador '" + username + "' não existe na folha UTILIZADORES.");
}


function ivHashPassword_(password, salt) {
  var valor = String(salt) + "|" + String(password);
  for (var i = 0; i < 12000; i++) {
    valor = ivSha256_(valor + "|" + salt);
  }
  return valor;
}


function ivSha256_(valor) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(valor), Utilities.Charset.UTF_8);
  return bytes.map(function(b) {
    var v = (b + 256) % 256;
    return ("0" + v.toString(16)).slice(-2);
  }).join("");
}


function ivComparacaoSegura_(a, b) {
  a = String(a || ""); b = String(b || "");
  if (a.length !== b.length) return false;
  var diferenca = 0;
  for (var i = 0; i < a.length; i++) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferenca === 0;
}


function ivEnviarResumoSemanal_(vendedor, faturas) {
  var resumo = ivResumo_(faturas);
  var vencidas = faturas.filter(function(f) { return f.estado === "VENCIDA"; })
    .sort(function(a, b) { return b.valorPendente - a.valorPendente; });
  var assunto = "InvoiceVision — resumo semanal das contas a receber";
  var html = ivCabecalhoEmail_("Resumo semanal", vendedor.nome) +
    "<p><strong>" + resumo.totalClientes + "</strong> clientes · <strong>" +
    resumo.totalFaturas + "</strong> faturas · <strong>" +
    ivMoeda_(resumo.valorPendente) + "</strong> pendente.</p>" +
    "<h3 style='color:#b42318'>Dívidas vencidas: " + vencidas.length + " · " +
    ivMoeda_(resumo.vencidas.valorPendente) + "</h3>" +
    ivTabelaEmail_(vencidas.length ? vencidas : faturas, 30) +
    "<p style='color:#667085'>Clientes e faturas em contencioso foram excluídos deste email.</p>";
  MailApp.sendEmail({to: vendedor.email, subject: assunto, htmlBody: html, body: ivTextoEmail_(html), name: "InvoiceVision AI"});
}


function ivEnviarAvisoDiario_(vendedor, faturas) {
  var assunto = "InvoiceVision — " + faturas.length + " documento(s) vencido(s) sem status";
  var html = ivCabecalhoEmail_("Ação necessária", vendedor.nome) +
    "<p>Existem <strong>" + faturas.length + "</strong> documentos vencidos sem nota ou status. " +
    "O aviso será repetido diariamente até a informação ser preenchida.</p>" +
    ivTabelaEmail_(faturas, 50) +
    "<p>Entre em <strong>Os Meus Clientes</strong> para atualizar cada documento.</p>" +
    "<p style='color:#667085'>Clientes e faturas em contencioso foram excluídos.</p>";
  MailApp.sendEmail({to: vendedor.email, subject: assunto, htmlBody: html, body: ivTextoEmail_(html), name: "InvoiceVision AI"});
}


function ivCabecalhoEmail_(titulo, nome) {
  return "<div style='font-family:Arial,sans-serif;color:#172033;max-width:760px'>" +
    "<div style='padding:20px;background:#172554;color:white;border-radius:12px'>" +
    "<div style='font-size:12px;opacity:.75'>INVOICEVISION AI</div>" +
    "<h2 style='margin:6px 0 0'>" + ivHtml_(titulo) + "</h2></div>" +
    "<p>Olá " + ivHtml_(nome || "") + ",</p>";
}


function ivTabelaEmail_(faturas, limite) {
  var linhas = faturas.slice(0, limite).map(function(f) {
    return "<tr><td>" + ivHtml_(f.nome) + "<br><small>" + ivHtml_(f.numeroCliente) +
      "</small></td><td>" + ivHtml_([f.documento, f.numeroDocumento].join(" ")) +
      "</td><td>" + ivHtml_(f.dataVencimento) + "</td><td style='text-align:right'><strong>" +
      ivMoeda_(f.valorPendente) + "</strong></td></tr>";
  }).join("");
  return "<table style='border-collapse:collapse;width:100%;font-size:13px'>" +
    "<thead><tr style='background:#f2f4f7'><th style='padding:8px;text-align:left'>Cliente</th>" +
    "<th style='padding:8px;text-align:left'>Documento</th><th style='padding:8px;text-align:left'>Vencimento</th>" +
    "<th style='padding:8px;text-align:right'>Pendente</th></tr></thead><tbody>" + linhas + "</tbody></table></div>";
}


function ivPreencherConfiguracaoInicial_() {
  var folha = ivFolha_(IV.SHEETS.CONFIG);
  var definicoes = [
    ["NOVO_UTILIZADOR", "", "Utilizador cuja password será definida"],
    ["NOVA_PASSWORD", "", "Password temporária; será apagada após gerar o hash"],
    ["RESUMO_SEMANAL_DIA", "MONDAY", "MONDAY a FRIDAY"],
    ["RESUMO_SEMANAL_HORA", "8", "Hora local, 0 a 23"],
    ["AVISO_DIARIO_HORA", "9", "Hora local, 0 a 23"],
    ["PASTA_DRIVE_PENDENTES_ID", "", "ID da pasta do Google Drive onde são colocados os ficheiros Pendentes.xlsx"],
    ["IMPORTACAO_AUTOMATICA_HORA", "6", "Hora diária da importação automática, 0 a 23"],
    ["URL_APP", "", "URL pública da aplicação"]
  ];
  var existentes = {};
  var valores = folha.getDataRange().getValues();
  for (var i = 1; i < valores.length; i++) existentes[String(valores[i][0])] = true;
  definicoes.forEach(function(linha) {
    if (!existentes[linha[0]]) folha.appendRow(linha);
  });
}


function ivLerConfiguracao_() {
  var valores = ivFolha_(IV.SHEETS.CONFIG).getDataRange().getValues();
  var config = {};
  for (var i = 1; i < valores.length; i++) config[String(valores[i][0])] = valores[i][1];
  return config;
}


function ivApagarValorConfiguracao_(chave) {
  var folha = ivFolha_(IV.SHEETS.CONFIG);
  var valores = folha.getDataRange().getValues();
  for (var i = 1; i < valores.length; i++) {
    if (String(valores[i][0]) === chave) {
      folha.getRange(i + 1, 2).clearContent();
      return;
    }
  }
}


function ivGarantirFolha_(ss, nome, cabecalhos) {
  var folha = ss.getSheetByName(nome) || ss.insertSheet(nome);
  var atuais = folha.getLastColumn() ? folha.getRange(1, 1, 1, Math.max(folha.getLastColumn(), cabecalhos.length)).getValues()[0] : [];
  for (var i = 0; i < cabecalhos.length; i++) {
    if (!atuais[i]) folha.getRange(1, i + 1).setValue(cabecalhos[i]);
    else if (String(atuais[i]) !== cabecalhos[i]) {
      throw new Error("Estrutura inesperada na folha " + nome + ", coluna " + (i + 1) + ". Esperado: " + cabecalhos[i]);
    }
  }
  folha.setFrozenRows(1);
  ivFormatarCabecalho_(folha, cabecalhos.length);
  return folha;
}


function ivFolha_(nome) {
  var folha = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nome);
  if (!folha) throw new Error("A folha " + nome + " não existe. Execute configurarInvoiceVision().");
  return folha;
}


function ivFormatarCabecalho_(folha, colunas) {
  folha.getRange(1, 1, 1, colunas).setFontWeight("bold").setBackground("#172554").setFontColor("#ffffff");
}


function ivCampo_(linha, nomes) {
  for (var i = 0; i < nomes.length; i++) {
    if (Object.prototype.hasOwnProperty.call(linha, nomes[i])) return linha[nomes[i]];
  }
  return "";
}


function ivNumero_(valor) {
  if (typeof valor === "number") return valor;
  var texto = String(valor || "").replace(/\s/g, "").replace(/[€$£]/g, "");
  if (texto.indexOf(",") !== -1) texto = texto.replace(/\./g, "").replace(",", ".");
  var numero = Number(texto);
  return isNaN(numero) ? 0 : numero;
}


function ivEstado_(vencimento, observacoes) {
  if (String(observacoes || "").trim().toUpperCase() === "CONTENCIOSO") return "CONTENCIOSO";
  var data = ivConverterData_(vencimento);
  if (!data) return "DENTRO_PRAZO";
  var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  return data.getTime() < hoje.getTime() ? "VENCIDA" : "DENTRO_PRAZO";
}


function ivConverterData_(valor) {
  if (Object.prototype.toString.call(valor) === "[object Date]" && !isNaN(valor)) return valor;
  if (typeof valor === "number" && valor > 0) {
    return new Date(new Date(1899, 11, 30).getTime() + valor * 86400000);
  }
  var texto = String(valor || "").trim();
  var pt = texto.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (pt) return new Date(Number(pt[3]), Number(pt[2]) - 1, Number(pt[1]));
  var iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  return null;
}


function ivIdFatura_(cliente, documento, numero, vencimento) {
  return ivSha256_([cliente, documento, numero, vencimento].join("|")).slice(0, 24);
}


function ivTextoData_(valor) {
  var data = ivConverterData_(valor);
  return data ? Utilities.formatDate(data, IV.TZ, "dd/MM/yyyy") : String(valor || "");
}


function ivDataHora_(data) {
  return Utilities.formatDate(new Date(data), IV.TZ, "dd/MM/yyyy HH:mm");
}


function ivDataHoraOpcional_(data) {
  return data ? ivDataHora_(data) : "";
}


function ivNormalizarUsername_(valor) {
  return String(valor || "").trim().toLowerCase();
}


function ivLimitarHora_(valor, padrao) {
  var hora = Number(valor);
  return isNaN(hora) ? padrao : Math.max(0, Math.min(23, Math.floor(hora)));
}


function ivMoeda_(valor) {
  return Number(valor || 0).toFixed(2).replace(".", ",") + " €";
}


function ivHtml_(valor) {
  return String(valor == null ? "" : valor)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}


function ivTextoEmail_(html) {
  return String(html).replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}


function ivErroCodigo_(mensagem, codigo) {
  var erro = new Error(mensagem);
  erro.codigo = codigo;
  return erro;
}


function ivErro_(erro) {
  console.error(erro && erro.stack ? erro.stack : erro);
  return ivJson_({
    sucesso: false,
    erro: erro && erro.message ? erro.message : "Erro interno.",
    codigo: erro && erro.codigo ? erro.codigo : "ERRO"
  });
}


function ivJson_(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}
