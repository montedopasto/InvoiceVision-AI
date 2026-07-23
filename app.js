const API_URL =
    "https://script.google.com/macros/s/AKfycbygW5s-rhhtbl8EyN56ri-jqvs_aL-PRrmORqh_lwT5E8mMFxbAX1oMHLe0eW8fdVZYqw/exec";


const ELEMENTOS = {
    dropZone: document.getElementById("dropZone"),
    csvFile: document.getElementById("csvFile"),
    selectFileBtn: document.getElementById("selectFileBtn"),
    analysisSection: document.getElementById("analysisSection"),
    analysisContent: document.getElementById("analysisContent"),
    confirmImportBtn: document.getElementById("confirmImportBtn"),
    lastImport: document.getElementById("lastImport"),
    status: document.querySelector(".status"),
    statusDot: document.querySelector(".status-dot")
};


const CABECALHOS_OBRIGATORIOS = [
    "N.",
    "Nome",
    "Filial",
    "Documento",
    "N.º Doc.",
    "Prt.",
    "M.",
    "Câmbio",
    "Dt. Doc.",
    "Dt. Venc.",
    "Valor Total",
    "Val. Pendente",
    "Obs."
];


let ficheiroSelecionado = null;
let linhasCsv = [];
let resumoCsv = null;
let importacaoEmCurso = false;


/*
|--------------------------------------------------------------------------
| Inicialização
|--------------------------------------------------------------------------
*/

document.addEventListener("DOMContentLoaded", function() {
    verificarLigacaoApi();
});


/*
|--------------------------------------------------------------------------
| Eventos
|--------------------------------------------------------------------------
*/

ELEMENTOS.selectFileBtn.addEventListener("click", function(evento) {
    evento.stopPropagation();

    if (!importacaoEmCurso) {
        ELEMENTOS.csvFile.click();
    }
});


ELEMENTOS.dropZone.addEventListener("click", function() {
    if (!importacaoEmCurso) {
        ELEMENTOS.csvFile.click();
    }
});


ELEMENTOS.csvFile.addEventListener("change", function(evento) {
    const ficheiro = evento.target.files[0];

    if (ficheiro) {
        processarFicheiro(ficheiro);
    }
});


ELEMENTOS.dropZone.addEventListener("dragover", function(evento) {
    evento.preventDefault();

    if (!importacaoEmCurso) {
        ELEMENTOS.dropZone.classList.add("dragover");
    }
});


ELEMENTOS.dropZone.addEventListener("dragleave", function() {
    ELEMENTOS.dropZone.classList.remove("dragover");
});


ELEMENTOS.dropZone.addEventListener("drop", function(evento) {
    evento.preventDefault();

    ELEMENTOS.dropZone.classList.remove("dragover");

    if (importacaoEmCurso) {
        return;
    }

    const ficheiro = evento.dataTransfer.files[0];

    if (ficheiro) {
        processarFicheiro(ficheiro);
    }
});


ELEMENTOS.confirmImportBtn.addEventListener("click", function() {
    confirmarImportacao();
});


/*
|--------------------------------------------------------------------------
| Ligação ao Apps Script
|--------------------------------------------------------------------------
*/

async function verificarLigacaoApi() {
    atualizarEstadoLigacao(
        "A ligar...",
        "loading"
    );

    try {
        const resposta = await fetch(
            API_URL + "?acao=estado&t=" + Date.now(),
            {
                method: "GET",
                cache: "no-store"
            }
        );

        if (!resposta.ok) {
            throw new Error(
                "A API respondeu com o estado " +
                resposta.status +
                "."
            );
        }

        const dados = await resposta.json();

        if (!dados.sucesso) {
            throw new Error(
                dados.erro ||
                "A API não confirmou a ligação."
            );
        }

        atualizarEstadoLigacao(
            "Online",
            "online"
        );

    } catch (erro) {
        console.error(
            "Erro de ligação:",
            erro
        );

        atualizarEstadoLigacao(
            "Sem ligação",
            "offline"
        );
    }
}


async function confirmarImportacao() {
    if (importacaoEmCurso) {
        return;
    }

    if (
        !ficheiroSelecionado ||
        linhasCsv.length === 0
    ) {
        mostrarErro(
            "Selecione primeiro um ficheiro CSV válido."
        );

        return;
    }

    importacaoEmCurso = true;

    bloquearInterfaceImportacao();

    mostrarEstadoImportacao(
        "A enviar o ficheiro...",
        "Estamos a guardar as faturas na Google Sheet."
    );

    try {
        const pedido = {
            acao: "importar",
            nomeFicheiro: ficheiroSelecionado.name,
            linhas: linhasCsv
        };

        const resposta = await fetch(
            API_URL,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "text/plain;charset=utf-8"
                },

                body: JSON.stringify(pedido)
            }
        );

        if (!resposta.ok) {
            throw new Error(
                "O servidor respondeu com o estado " +
                resposta.status +
                "."
            );
        }

        const dados = await resposta.json();

        if (!dados.sucesso) {
            throw new Error(
                dados.erro ||
                "A importação não foi concluída."
            );
        }

        mostrarImportacaoConcluida(
            dados.resultado
        );

        atualizarUltimaImportacao(
            dados.resultado
        );

        limparFicheiroSelecionado();

    } catch (erro) {
        console.error(
            "Erro na importação:",
            erro
        );

        mostrarErroImportacao(
            erro.message ||
            "Não foi possível concluir a importação."
        );

    } finally {
        importacaoEmCurso = false;
        desbloquearInterfaceImportacao();
    }
}


/*
|--------------------------------------------------------------------------
| Processamento do ficheiro
|--------------------------------------------------------------------------
*/

function processarFicheiro(ficheiro) {
    limparAnalise();

    if (!validarExtensao(ficheiro)) {
        mostrarErro(
            "O ficheiro selecionado não é um CSV."
        );

        return;
    }

    ficheiroSelecionado = ficheiro;

    const leitor = new FileReader();

    leitor.onload = function(evento) {
        try {
            const conteudo = removerBom(
                evento.target.result
            );

            const separador = detetarSeparador(
                conteudo
            );

            const tabela = converterCsvEmTabela(
                conteudo,
                separador
            );

            validarTabela(tabela);

            linhasCsv = converterTabelaEmObjetos(
                tabela
            );

            if (linhasCsv.length === 0) {
                throw new Error(
                    "O ficheiro não contém faturas válidas."
                );
            }

            resumoCsv = calcularResumo(
                linhasCsv
            );

            mostrarAnalise(
                ficheiro,
                resumoCsv
            );

        } catch (erro) {
            ficheiroSelecionado = null;
            linhasCsv = [];
            resumoCsv = null;

            mostrarErro(
                erro.message ||
                "Não foi possível ler o ficheiro."
            );
        }
    };

    leitor.onerror = function() {
        ficheiroSelecionado = null;
        linhasCsv = [];
        resumoCsv = null;

        mostrarErro(
            "O navegador não conseguiu abrir o ficheiro."
        );
    };

    leitor.readAsText(
        ficheiro,
        "UTF-8"
    );
}


/*
|--------------------------------------------------------------------------
| Validação
|--------------------------------------------------------------------------
*/

function validarExtensao(ficheiro) {
    return ficheiro.name
        .toLowerCase()
        .endsWith(".csv");
}


function validarTabela(tabela) {
    if (
        !Array.isArray(tabela) ||
        tabela.length < 2
    ) {
        throw new Error(
            "O CSV está vazio ou não tem linhas suficientes."
        );
    }

    const cabecalhos = tabela[0].map(
        normalizarCabecalho
    );

    const cabecalhosEmFalta =
        CABECALHOS_OBRIGATORIOS.filter(
            function(cabecalhoObrigatorio) {
                return !cabecalhos.includes(
                    normalizarCabecalho(
                        cabecalhoObrigatorio
                    )
                );
            }
        );

    if (cabecalhosEmFalta.length > 0) {
        throw new Error(
            "Faltam estas colunas no CSV: " +
            cabecalhosEmFalta.join(", ")
        );
    }
}


/*
|--------------------------------------------------------------------------
| Conversão do CSV
|--------------------------------------------------------------------------
*/

function removerBom(texto) {
    return texto.replace(
        /^\uFEFF/,
        ""
    );
}


function detetarSeparador(conteudo) {
    const primeiraLinha =
        conteudo.split(/\r?\n/)[0] || "";

    const possibilidades = [
        ";",
        ",",
        "\t"
    ];

    let melhorSeparador = ";";
    let maiorQuantidade = -1;

    possibilidades.forEach(
        function(separador) {
            const quantidade =
                contarSeparadoresForaDeAspas(
                    primeiraLinha,
                    separador
                );

            if (quantidade > maiorQuantidade) {
                maiorQuantidade = quantidade;
                melhorSeparador = separador;
            }
        }
    );

    return melhorSeparador;
}


function contarSeparadoresForaDeAspas(
    linha,
    separador
) {
    let dentroDeAspas = false;
    let quantidade = 0;

    for (
        let indice = 0;
        indice < linha.length;
        indice++
    ) {
        const caractere = linha[indice];

        if (caractere === "\"") {
            if (
                dentroDeAspas &&
                linha[indice + 1] === "\""
            ) {
                indice++;

            } else {
                dentroDeAspas =
                    !dentroDeAspas;
            }

            continue;
        }

        if (
            caractere === separador &&
            !dentroDeAspas
        ) {
            quantidade++;
        }
    }

    return quantidade;
}


function converterCsvEmTabela(
    conteudo,
    separador
) {
    const linhas = [];

    let linhaAtual = [];
    let campoAtual = "";
    let dentroDeAspas = false;

    for (
        let indice = 0;
        indice < conteudo.length;
        indice++
    ) {
        const caractere = conteudo[indice];
        const seguinte = conteudo[indice + 1];

        if (caractere === "\"") {
            if (
                dentroDeAspas &&
                seguinte === "\""
            ) {
                campoAtual += "\"";
                indice++;

            } else {
                dentroDeAspas =
                    !dentroDeAspas;
            }

            continue;
        }

        if (
            caractere === separador &&
            !dentroDeAspas
        ) {
            linhaAtual.push(
                campoAtual.trim()
            );

            campoAtual = "";
            continue;
        }

        if (
            (
                caractere === "\n" ||
                caractere === "\r"
            ) &&
            !dentroDeAspas
        ) {
            if (
                caractere === "\r" &&
                seguinte === "\n"
            ) {
                indice++;
            }

            linhaAtual.push(
                campoAtual.trim()
            );

            const linhaTemConteudo =
                linhaAtual.some(
                    function(valor) {
                        return valor !== "";
                    }
                );

            if (linhaTemConteudo) {
                linhas.push(linhaAtual);
            }

            linhaAtual = [];
            campoAtual = "";

            continue;
        }

        campoAtual += caractere;
    }

    linhaAtual.push(
        campoAtual.trim()
    );

    const ultimaLinhaTemConteudo =
        linhaAtual.some(
            function(valor) {
                return valor !== "";
            }
        );

    if (ultimaLinhaTemConteudo) {
        linhas.push(linhaAtual);
    }

    return linhas;
}


function converterTabelaEmObjetos(tabela) {
    const cabecalhosOriginais =
        tabela[0].map(
            function(cabecalho) {
                return cabecalho.trim();
            }
        );

    const mapaCabecalhos = {};

    cabecalhosOriginais.forEach(
        function(cabecalho, indice) {
            mapaCabecalhos[
                normalizarCabecalho(cabecalho)
            ] = indice;
        }
    );

    return tabela
        .slice(1)
        .map(function(linha) {
            const objeto = {};

            CABECALHOS_OBRIGATORIOS.forEach(
                function(cabecalho) {
                    const indice =
                        mapaCabecalhos[
                            normalizarCabecalho(
                                cabecalho
                            )
                        ];

                    objeto[cabecalho] =
                        indice !== undefined
                            ? String(
                                linha[indice] || ""
                            ).trim()
                            : "";
                }
            );

            return objeto;
        })
        .filter(function(linha) {
            return (
                linha["N."] !== "" ||
                linha["Nome"] !== "" ||
                linha["Documento"] !== "" ||
                linha["N.º Doc."] !== ""
            );
        });
}


function normalizarCabecalho(valor) {
    return String(valor || "")
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
}


/*
|--------------------------------------------------------------------------
| Cálculos
|--------------------------------------------------------------------------
*/

function calcularResumo(linhas) {
    const clientes = new Set();

    let valorTotal = 0;
    let valorPendente = 0;

    linhas.forEach(function(linha) {
        const identificadorCliente =
            linha["N."] ||
            linha["Nome"];

        if (identificadorCliente) {
            clientes.add(
                identificadorCliente
                    .trim()
                    .toUpperCase()
            );
        }

        valorTotal += converterNumero(
            linha["Valor Total"]
        );

        valorPendente += converterNumero(
            linha["Val. Pendente"]
        );
    });

    return {
        totalClientes: clientes.size,
        totalFaturas: linhas.length,

        valorTotal: arredondarMoeda(
            valorTotal
        ),

        valorPendente: arredondarMoeda(
            valorPendente
        )
    };
}


function converterNumero(valor) {
    if (
        valor === null ||
        valor === undefined ||
        valor === ""
    ) {
        return 0;
    }

    let texto = String(valor)
        .trim()
        .replace(/\s/g, "")
        .replace(/€/g, "");

    if (
        texto.includes(",") &&
        texto.includes(".")
    ) {
        if (
            texto.lastIndexOf(",") >
            texto.lastIndexOf(".")
        ) {
            texto = texto
                .replace(/\./g, "")
                .replace(",", ".");

        } else {
            texto = texto.replace(
                /,/g,
                ""
            );
        }

    } else if (texto.includes(",")) {
        texto = texto.replace(
            ",",
            "."
        );
    }

    texto = texto.replace(
        /[^0-9.-]/g,
        ""
    );

    const numero = Number(texto);

    return Number.isFinite(numero)
        ? numero
        : 0;
}


function arredondarMoeda(valor) {
    return Math.round(
        (
            Number(valor || 0) +
            Number.EPSILON
        ) *
        100
    ) / 100;
}


/*
|--------------------------------------------------------------------------
| Interface da pré-análise
|--------------------------------------------------------------------------
*/

function mostrarAnalise(
    ficheiro,
    resumo
) {
    ELEMENTOS.analysisSection.classList.add(
        "visible"
    );

    ELEMENTOS.analysisContent.innerHTML = `
        <div style="
            display:grid;
            grid-template-columns:
                repeat(auto-fit, minmax(180px, 1fr));
            gap:14px;
        ">
            ${criarCartaoAnalise(
                "Ficheiro",
                escaparHtml(ficheiro.name)
            )}

            ${criarCartaoAnalise(
                "Clientes",
                formatarNumero(
                    resumo.totalClientes
                )
            )}

            ${criarCartaoAnalise(
                "Faturas pendentes",
                formatarNumero(
                    resumo.totalFaturas
                )
            )}

            ${criarCartaoAnalise(
                "Valor total",
                formatarMoeda(
                    resumo.valorTotal
                )
            )}

            ${criarCartaoAnalise(
                "Valor pendente",
                formatarMoeda(
                    resumo.valorPendente
                )
            )}
        </div>
    `;

    ELEMENTOS.confirmImportBtn.disabled =
        false;

    ELEMENTOS.confirmImportBtn.textContent =
        "Confirmar Importação";
}


function criarCartaoAnalise(
    titulo,
    valor
) {
    return `
        <div style="
            padding:18px;
            border:1px solid #e5e7eb;
            border-radius:14px;
            background:#ffffff;
        ">
            <div style="
                margin-bottom:8px;
                color:#6b7280;
                font-size:12px;
                font-weight:700;
                text-transform:uppercase;
                letter-spacing:0.05em;
            ">
                ${titulo}
            </div>

            <div style="
                color:#111827;
                font-size:18px;
                font-weight:800;
                overflow-wrap:anywhere;
            ">
                ${valor}
            </div>
        </div>
    `;
}


/*
|--------------------------------------------------------------------------
| Interface durante e depois da importação
|--------------------------------------------------------------------------
*/

function mostrarEstadoImportacao(
    titulo,
    descricao
) {
    ELEMENTOS.analysisSection.classList.add(
        "visible"
    );

    ELEMENTOS.analysisContent.innerHTML = `
        <div style="
            padding:28px;
            border:1px solid #bfdbfe;
            border-radius:16px;
            background:#eff6ff;
            text-align:center;
        ">
            <div style="
                width:42px;
                height:42px;
                margin:0 auto 16px;
                border:4px solid #bfdbfe;
                border-top-color:#2563eb;
                border-radius:50%;
                animation:invoiceSpin 0.8s linear infinite;
            "></div>

            <h3 style="
                margin-bottom:8px;
                color:#1e3a8a;
                font-size:18px;
            ">
                ${escaparHtml(titulo)}
            </h3>

            <p style="
                color:#475569;
                font-size:14px;
            ">
                ${escaparHtml(descricao)}
            </p>
        </div>

        <style>
            @keyframes invoiceSpin {
                to {
                    transform:rotate(360deg);
                }
            }
        </style>
    `;
}


function mostrarImportacaoConcluida(resultado) {
    const diferenca =
        Number(resultado.diferencaValorPendente || 0);

    const textoDiferenca =
        diferenca > 0
            ? "+" + formatarMoeda(diferenca)
            : formatarMoeda(diferenca);

    ELEMENTOS.analysisSection.classList.add(
        "visible"
    );

    ELEMENTOS.analysisContent.innerHTML = `
        <div style="
            padding:22px;
            border:1px solid #bbf7d0;
            border-radius:16px;
            background:#f0fdf4;
        ">
            <div style="
                display:flex;
                align-items:center;
                gap:12px;
                margin-bottom:20px;
            ">
                <div style="
                    width:46px;
                    height:46px;
                    display:grid;
                    place-items:center;
                    border-radius:50%;
                    background:#16a34a;
                    color:white;
                    font-size:24px;
                    font-weight:800;
                ">
                    ✓
                </div>

                <div>
                    <h3 style="
                        color:#166534;
                        font-size:19px;
                    ">
                        Importação concluída
                    </h3>

                    <p style="
                        margin-top:3px;
                        color:#15803d;
                        font-size:13px;
                    ">
                        ${escaparHtml(
                            resultado.idImportacao
                        )}
                    </p>
                </div>
            </div>

            <div style="
                display:grid;
                grid-template-columns:
                    repeat(auto-fit, minmax(160px, 1fr));
                gap:12px;
            ">
                ${criarCartaoResultado(
                    "Clientes",
                    formatarNumero(
                        resultado.totalClientes
                    )
                )}

                ${criarCartaoResultado(
                    "Faturas",
                    formatarNumero(
                        resultado.totalFaturas
                    )
                )}

                ${criarCartaoResultado(
                    "Novas",
                    formatarNumero(
                        resultado.novasFaturas
                    )
                )}

                ${criarCartaoResultado(
                    "Liquidadas",
                    formatarNumero(
                        resultado.liquidadas
                    )
                )}

                ${criarCartaoResultado(
                    "Pagamentos parciais",
                    formatarNumero(
                        resultado.pagamentosParciais
                    )
                )}

                ${criarCartaoResultado(
                    "Valor pendente",
                    formatarMoeda(
                        resultado.valorPendente
                    )
                )}

                ${criarCartaoResultado(
                    "Diferença",
                    textoDiferenca
                )}
            </div>
        </div>
    `;

    ELEMENTOS.confirmImportBtn.textContent =
        "Importação concluída";

    ELEMENTOS.confirmImportBtn.disabled =
        true;
}


function criarCartaoResultado(
    titulo,
    valor
) {
    return `
        <div style="
            padding:15px;
            border:1px solid #dcfce7;
            border-radius:13px;
            background:#ffffff;
        ">
            <div style="
                margin-bottom:6px;
                color:#64748b;
                font-size:11px;
                font-weight:800;
                text-transform:uppercase;
                letter-spacing:0.05em;
            ">
                ${titulo}
            </div>

            <div style="
                color:#14532d;
                font-size:17px;
                font-weight:800;
                overflow-wrap:anywhere;
            ">
                ${valor}
            </div>
        </div>
    `;
}


function mostrarErroImportacao(mensagem) {
    ELEMENTOS.analysisSection.classList.add(
        "visible"
    );

    ELEMENTOS.analysisContent.innerHTML = `
        <div style="
            padding:22px;
            border:1px solid #fecaca;
            border-radius:16px;
            background:#fef2f2;
            color:#991b1b;
        ">
            <h3 style="
                margin-bottom:8px;
                font-size:18px;
            ">
                Erro na importação
            </h3>

            <p style="
                font-size:14px;
                line-height:1.6;
            ">
                ${escaparHtml(mensagem)}
            </p>
        </div>
    `;

    ELEMENTOS.confirmImportBtn.disabled =
        false;

    ELEMENTOS.confirmImportBtn.textContent =
        "Tentar novamente";
}


function atualizarUltimaImportacao(resultado) {
    ELEMENTOS.lastImport.innerHTML = `
        <strong>Última importação</strong>

        <p>
            ${escaparHtml(
                resultado.dataImportacao
            )}
            ·
            ${formatarNumero(
                resultado.totalFaturas
            )}
            faturas
        </p>
    `;
}


function bloquearInterfaceImportacao() {
    ELEMENTOS.confirmImportBtn.disabled =
        true;

    ELEMENTOS.confirmImportBtn.textContent =
        "A importar...";

    ELEMENTOS.selectFileBtn.disabled =
        true;

    ELEMENTOS.csvFile.disabled =
        true;

    ELEMENTOS.dropZone.style.opacity =
        "0.65";

    ELEMENTOS.dropZone.style.pointerEvents =
        "none";
}


function desbloquearInterfaceImportacao() {
    ELEMENTOS.selectFileBtn.disabled =
        false;

    ELEMENTOS.csvFile.disabled =
        false;

    ELEMENTOS.dropZone.style.opacity =
        "1";

    ELEMENTOS.dropZone.style.pointerEvents =
        "auto";
}


function limparFicheiroSelecionado() {
    ficheiroSelecionado = null;
    linhasCsv = [];
    resumoCsv = null;

    ELEMENTOS.csvFile.value = "";
}


/*
|--------------------------------------------------------------------------
| Estado da ligação
|--------------------------------------------------------------------------
*/

function atualizarEstadoLigacao(
    textoEstado,
    tipo
) {
    if (!ELEMENTOS.status) {
        return;
    }

    ELEMENTOS.status.innerHTML = `
        <span
            class="status-dot"
            style="
                background:${obterCorEstado(tipo)};
                box-shadow:
                    0 0 0 4px
                    ${obterSombraEstado(tipo)};
            "
        ></span>

        <span>${escaparHtml(textoEstado)}</span>
    `;

    if (tipo === "offline") {
        ELEMENTOS.status.style.background =
            "#fef2f2";

        ELEMENTOS.status.style.color =
            "#991b1b";

    } else if (tipo === "loading") {
        ELEMENTOS.status.style.background =
            "#fffbeb";

        ELEMENTOS.status.style.color =
            "#92400e";

    } else {
        ELEMENTOS.status.style.background =
            "#f0fdf4";

        ELEMENTOS.status.style.color =
            "#166534";
    }
}


function obterCorEstado(tipo) {
    if (tipo === "offline") {
        return "#dc2626";
    }

    if (tipo === "loading") {
        return "#f59e0b";
    }

    return "#16a34a";
}


function obterSombraEstado(tipo) {
    if (tipo === "offline") {
        return "rgba(220,38,38,0.12)";
    }

    if (tipo === "loading") {
        return "rgba(245,158,11,0.14)";
    }

    return "rgba(22,163,74,0.12)";
}


/*
|--------------------------------------------------------------------------
| Erros e limpeza
|--------------------------------------------------------------------------
*/

function mostrarErro(mensagem) {
    ELEMENTOS.analysisSection.classList.add(
        "visible"
    );

    ELEMENTOS.analysisContent.innerHTML = `
        <div style="
            padding:18px;
            border:1px solid #fecaca;
            border-radius:14px;
            background:#fef2f2;
            color:#991b1b;
            font-weight:600;
        ">
            ${escaparHtml(mensagem)}
        </div>
    `;

    ELEMENTOS.confirmImportBtn.disabled =
        true;
}


function limparAnalise() {
    ELEMENTOS.analysisSection.classList.remove(
        "visible"
    );

    ELEMENTOS.analysisContent.innerHTML =
        "À espera de um ficheiro CSV...";

    ELEMENTOS.confirmImportBtn.disabled =
        true;

    ELEMENTOS.confirmImportBtn.textContent =
        "Confirmar Importação";
}


/*
|--------------------------------------------------------------------------
| Formatação
|--------------------------------------------------------------------------
*/

function formatarMoeda(valor) {
    return new Intl.NumberFormat(
        "pt-PT",
        {
            style: "currency",
            currency: "EUR"
        }
    ).format(
        Number(valor || 0)
    );
}


function formatarNumero(valor) {
    return new Intl.NumberFormat(
        "pt-PT"
    ).format(
        Number(valor || 0)
    );
}


function escaparHtml(valor) {
    return String(valor)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
