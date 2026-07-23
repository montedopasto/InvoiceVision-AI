const ELEMENTOS = {
    dropZone: document.getElementById("dropZone"),
    csvFile: document.getElementById("csvFile"),
    selectFileBtn: document.getElementById("selectFileBtn"),
    analysisSection: document.getElementById("analysisSection"),
    analysisContent: document.getElementById("analysisContent"),
    confirmImportBtn: document.getElementById("confirmImportBtn")
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


/*
|--------------------------------------------------------------------------
| Eventos
|--------------------------------------------------------------------------
*/

ELEMENTOS.selectFileBtn.addEventListener("click", function(evento) {
    evento.stopPropagation();
    ELEMENTOS.csvFile.click();
});

ELEMENTOS.dropZone.addEventListener("click", function() {
    ELEMENTOS.csvFile.click();
});

ELEMENTOS.csvFile.addEventListener("change", function(evento) {
    const ficheiro = evento.target.files[0];

    if (ficheiro) {
        processarFicheiro(ficheiro);
    }
});

ELEMENTOS.dropZone.addEventListener("dragover", function(evento) {
    evento.preventDefault();
    ELEMENTOS.dropZone.classList.add("dragover");
});

ELEMENTOS.dropZone.addEventListener("dragleave", function() {
    ELEMENTOS.dropZone.classList.remove("dragover");
});

ELEMENTOS.dropZone.addEventListener("drop", function(evento) {
    evento.preventDefault();
    ELEMENTOS.dropZone.classList.remove("dragover");

    const ficheiro = evento.dataTransfer.files[0];

    if (ficheiro) {
        processarFicheiro(ficheiro);
    }
});

ELEMENTOS.confirmImportBtn.addEventListener("click", function() {
    alert(
        "O ficheiro está pronto. No próximo passo vamos ligá-lo ao Google Apps Script."
    );
});


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

            const resumo = calcularResumo(
                linhasCsv
            );

            mostrarAnalise(
                ficheiro,
                resumo
            );

        } catch (erro) {
            ficheiroSelecionado = null;
            linhasCsv = [];

            mostrarErro(
                erro.message ||
                "Não foi possível ler o ficheiro."
            );
        }
    };

    leitor.onerror = function() {
        ficheiroSelecionado = null;
        linhasCsv = [];

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
    if (!Array.isArray(tabela) || tabela.length < 2) {
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
            (caractere === "\n" ||
            caractere === "\r") &&
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
        (Number(valor || 0) +
        Number.EPSILON) *
        100
    ) / 100;
}


/*
|--------------------------------------------------------------------------
| Interface
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

function formatarMoeda(valor) {
    return new Intl.NumberFormat(
        "pt-PT",
        {
            style: "currency",
            currency: "EUR"
        }
    ).format(valor);
}

function formatarNumero(valor) {
    return new Intl.NumberFormat(
        "pt-PT"
    ).format(valor);
}

function escaparHtml(valor) {
    return String(valor)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
