const API_URL =
    "https://script.google.com/macros/s/AKfycbygW5s-rhhtbl8EyN56ri-jqvs_aL-PRrmORqh_lwT5E8mMFxbAX1oMHLe0eW8fdVZYqw/exec";


const App = {};
const Dashboard = {};
const Clientes = {};
const Faturas = {};
const Historico = {};
const AI = {};


const DATA = {
    clientes: [],
    faturas: [],

    dashboard: {
        totalClientes: 0,
        totalFaturas: 0,
        valorTotal: 0,
        valorPendente: 0,
        totalVencidas: 0
    },

    alertas: [],
    insights: [],
    rankings: {},
    historicoEvolucao: []
};


const ELEMENTOS = {
    dropZone: document.getElementById("dropZone"),
    csvFile: document.getElementById("csvFile"),
    selectFileBtn: document.getElementById("selectFileBtn"),
    analysisSection: document.getElementById("analysisSection"),
    analysisContent: document.getElementById("analysisContent"),
    confirmImportBtn: document.getElementById("confirmImportBtn"),
    lastImport: document.getElementById("lastImport"),
    status: document.querySelector(".status"),

    sidebar: document.getElementById("sidebar"),
    mobileOverlay: document.getElementById("mobileOverlay"),
    openSidebarBtn: document.getElementById("openSidebarBtn"),
    closeSidebarBtn: document.getElementById("closeSidebarBtn"),

    pageTitle: document.getElementById("pageTitle"),
    navItems: document.querySelectorAll(".nav-item"),
    appPages: document.querySelectorAll(".app-page"),

    sidebarImportBtn: document.getElementById("sidebarImportBtn"),
    headerImportBtn: document.getElementById("headerImportBtn"),
    importModal: document.getElementById("importModal"),
    closeImportModalBtn: document.getElementById("closeImportModalBtn"),

    globalSearchBtn: document.getElementById("globalSearchBtn"),
    commandPalette: document.getElementById("commandPalette"),
    commandInput: document.getElementById("commandInput"),
    commandItems: document.querySelectorAll(".command-item"),
    commandEmpty: document.getElementById("commandEmpty"),

    themeToggleBtn: document.getElementById("themeToggleBtn"),

    dashboardLastImport: document.getElementById("dashboardLastImport"),
    kpiClientes: document.getElementById("kpiClientes"),
    kpiFaturas: document.getElementById("kpiFaturas"),
    kpiValorPendente: document.getElementById("kpiValorPendente"),
    kpiVencidas: document.getElementById("kpiVencidas")
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
let graficoEvolucao = null;
let graficoAging = null;
let graficoTopClientes = null;
let promessaChartJs = null;


/*
|--------------------------------------------------------------------------
| Inicialização
|--------------------------------------------------------------------------
*/

document.addEventListener("DOMContentLoaded", function() {
    inicializarInterface();
    verificarLigacaoApi();
    carregarDadosAplicacao();
});


function inicializarInterface() {
    aplicarTemaGuardado();
    registarEventosInterface();

    if (window.lucide) {
        window.lucide.createIcons();
    }
}


/*
|--------------------------------------------------------------------------
| Navegação e interface
|--------------------------------------------------------------------------
*/

function registarEventosInterface() {
    ELEMENTOS.navItems.forEach(function(item) {
        item.addEventListener("click", function() {
            navegarParaPagina(item.dataset.page);
        });
    });

    document.querySelectorAll("[data-page-link]").forEach(function(botao) {
        botao.addEventListener("click", function() {
            navegarParaPagina(botao.dataset.pageLink);
        });
    });

    ELEMENTOS.openSidebarBtn.addEventListener(
        "click",
        abrirSidebar
    );

    ELEMENTOS.closeSidebarBtn.addEventListener(
        "click",
        fecharSidebar
    );

    ELEMENTOS.mobileOverlay.addEventListener(
        "click",
        fecharSidebar
    );

    ELEMENTOS.sidebarImportBtn.addEventListener(
        "click",
        abrirModalImportacao
    );

    ELEMENTOS.headerImportBtn.addEventListener(
        "click",
        abrirModalImportacao
    );

    ELEMENTOS.closeImportModalBtn.addEventListener(
        "click",
        fecharModalImportacao
    );

    document.querySelectorAll("[data-close-modal='true']")
        .forEach(function(elemento) {
            elemento.addEventListener(
                "click",
                fecharModalImportacao
            );
        });

    ELEMENTOS.globalSearchBtn.addEventListener(
        "click",
        abrirCommandPalette
    );

    document.querySelectorAll("[data-close-command='true']")
        .forEach(function(elemento) {
            elemento.addEventListener(
                "click",
                fecharCommandPalette
            );
        });

    ELEMENTOS.commandInput.addEventListener(
        "input",
        filtrarCommandPalette
    );

    ELEMENTOS.commandItems.forEach(function(item) {
        item.addEventListener("click", function() {
            const pagina = item.dataset.commandPage;
            const acao = item.dataset.commandAction;

            if (pagina) {
                navegarParaPagina(pagina);
                fecharCommandPalette();
                return;
            }

            if (acao === "importar") {
                fecharCommandPalette();
                abrirModalImportacao();
            }
        });
    });

    ELEMENTOS.themeToggleBtn.addEventListener(
        "click",
        alternarTema
    );

    document.addEventListener("keydown", function(evento) {
        const teclaK =
            evento.key.toLowerCase() === "k";

        if (
            (evento.ctrlKey || evento.metaKey) &&
            teclaK
        ) {
            evento.preventDefault();
            abrirCommandPalette();
            return;
        }

        if (evento.key === "Escape") {
            fecharCommandPalette();
            fecharModalImportacao();
            fecharSidebar();
        }
    });
}


function navegarParaPagina(pagina) {
    const paginaDestino =
        document.getElementById(
            "page-" + pagina
        );

    if (!paginaDestino) {
        return;
    }

    ELEMENTOS.appPages.forEach(function(secao) {
        secao.classList.remove("active");
    });

    ELEMENTOS.navItems.forEach(function(item) {
        item.classList.toggle(
            "active",
            item.dataset.page === pagina
        );
    });

    paginaDestino.classList.add("active");

    ELEMENTOS.pageTitle.textContent =
        paginaDestino.dataset.title ||
        "InvoiceVision AI";

    fecharSidebar();

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


function abrirSidebar() {
    ELEMENTOS.sidebar.classList.add("open");
    ELEMENTOS.mobileOverlay.classList.add("visible");
}


function fecharSidebar() {
    ELEMENTOS.sidebar.classList.remove("open");
    ELEMENTOS.mobileOverlay.classList.remove("visible");
}


function abrirModalImportacao() {
    ELEMENTOS.importModal.classList.add("open");

    ELEMENTOS.importModal.setAttribute(
        "aria-hidden",
        "false"
    );

    document.body.classList.add("modal-open");

    fecharSidebar();
}


function fecharModalImportacao() {
    if (importacaoEmCurso) {
        return;
    }

    ELEMENTOS.importModal.classList.remove("open");

    ELEMENTOS.importModal.setAttribute(
        "aria-hidden",
        "true"
    );

    atualizarBloqueioBody();
}


function abrirCommandPalette() {
    ELEMENTOS.commandPalette.classList.add("open");

    ELEMENTOS.commandPalette.setAttribute(
        "aria-hidden",
        "false"
    );

    document.body.classList.add("modal-open");

    ELEMENTOS.commandInput.value = "";

    filtrarCommandPalette();

    setTimeout(function() {
        ELEMENTOS.commandInput.focus();
    }, 50);
}


function fecharCommandPalette() {
    ELEMENTOS.commandPalette.classList.remove("open");

    ELEMENTOS.commandPalette.setAttribute(
        "aria-hidden",
        "true"
    );

    atualizarBloqueioBody();
}


function atualizarBloqueioBody() {
    const existeModalAberto =
        ELEMENTOS.importModal.classList.contains("open") ||
        ELEMENTOS.commandPalette.classList.contains("open");

    document.body.classList.toggle(
        "modal-open",
        existeModalAberto
    );
}


function filtrarCommandPalette() {
    const pesquisa =
        ELEMENTOS.commandInput.value
            .trim()
            .toLowerCase();

    let totalVisiveis = 0;

    ELEMENTOS.commandItems.forEach(function(item) {
        const corresponde =
            item.textContent
                .toLowerCase()
                .includes(pesquisa);

        item.style.display =
            corresponde
                ? "flex"
                : "none";

        if (corresponde) {
            totalVisiveis++;
        }
    });

    ELEMENTOS.commandEmpty.classList.toggle(
        "visible",
        totalVisiveis === 0
    );
}


/*
|--------------------------------------------------------------------------
| Tema
|--------------------------------------------------------------------------
*/

function aplicarTemaGuardado() {
    const temaGuardado =
        localStorage.getItem(
            "invoicevision-theme"
        );

    const prefereEscuro =
        window.matchMedia &&
        window.matchMedia(
            "(prefers-color-scheme: dark)"
        ).matches;

    const tema =
        temaGuardado ||
        (
            prefereEscuro
                ? "dark"
                : "light"
        );

    aplicarTema(tema);
}


function alternarTema() {
    const temaAtual =
        document.documentElement.dataset.theme ||
        "light";

    aplicarTema(
        temaAtual === "dark"
            ? "light"
            : "dark"
    );


    if (
        Array.isArray(
            DATA.historicoEvolucao
        ) &&
        DATA.historicoEvolucao.length > 0
    ) {
        window.setTimeout(
            function() {
                renderizarGraficoEvolucao(
                    DATA.historicoEvolucao
                );

                renderizarGraficoAntiguidade(
                    DATA.faturas
                );

                renderizarGraficoTopClientes(
                    DATA.rankings.clientes || []
                );
            },
            50
        );
    }
}


function aplicarTema(tema) {
    document.documentElement.dataset.theme =
        tema;

    localStorage.setItem(
        "invoicevision-theme",
        tema
    );

    ELEMENTOS.themeToggleBtn.innerHTML =
        tema === "dark"
            ? '<i data-lucide="sun"></i>'
            : '<i data-lucide="moon"></i>';

    if (window.lucide) {
        window.lucide.createIcons();
    }
}


/*
|--------------------------------------------------------------------------
| Eventos da importação
|--------------------------------------------------------------------------
*/

ELEMENTOS.selectFileBtn.addEventListener(
    "click",
    function(evento) {
        evento.stopPropagation();

        if (!importacaoEmCurso) {
            ELEMENTOS.csvFile.click();
        }
    }
);


ELEMENTOS.dropZone.addEventListener(
    "click",
    function() {
        if (!importacaoEmCurso) {
            ELEMENTOS.csvFile.click();
        }
    }
);


ELEMENTOS.csvFile.addEventListener(
    "change",
    function(evento) {
        const ficheiro =
            evento.target.files[0];

        if (ficheiro) {
            processarFicheiro(ficheiro);
        }
    }
);


ELEMENTOS.dropZone.addEventListener(
    "dragover",
    function(evento) {
        evento.preventDefault();

        if (!importacaoEmCurso) {
            ELEMENTOS.dropZone
                .classList.add(
                    "dragover"
                );
        }
    }
);


ELEMENTOS.dropZone.addEventListener(
    "dragleave",
    function() {
        ELEMENTOS.dropZone
            .classList.remove(
                "dragover"
            );
    }
);


ELEMENTOS.dropZone.addEventListener(
    "drop",
    function(evento) {
        evento.preventDefault();

        ELEMENTOS.dropZone
            .classList.remove(
                "dragover"
            );

        if (importacaoEmCurso) {
            return;
        }

        const ficheiro =
            evento.dataTransfer.files[0];

        if (ficheiro) {
            processarFicheiro(ficheiro);
        }
    }
);


ELEMENTOS.confirmImportBtn.addEventListener(
    "click",
    confirmarImportacao
);


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
            API_URL +
            "?acao=estado&t=" +
            Date.now(),
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

        const dados =
            await resposta.json();

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
            nomeFicheiro:
                ficheiroSelecionado.name,
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

                body: JSON.stringify(
                    pedido
                )
            }
        );

        if (!resposta.ok) {
            throw new Error(
                "O servidor respondeu com o estado " +
                resposta.status +
                "."
            );
        }

        const dados =
            await resposta.json();

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

        atualizarDashboardAposImportacao(
            dados.resultado
        );

        limparFicheiroSelecionado();

        await carregarDadosAplicacao();

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
| Carregamento dos dados da Google Sheet
|--------------------------------------------------------------------------
*/

async function carregarDadosAplicacao() {
    definirDashboardEmCarregamento();

    try {
        const resposta = await fetch(
            API_URL +
            "?acao=dados&t=" +
            Date.now(),
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

        const resultado =
            await resposta.json();

        if (!resultado.sucesso) {
            throw new Error(
                resultado.erro ||
                "Não foi possível obter os dados."
            );
        }

        aplicarDadosAplicacao(
            resultado.dados || {}
        );

    } catch (erro) {
        console.error(
            "Erro ao carregar dados:",
            erro
        );

        mostrarErroCarregamentoDashboard(
            erro.message ||
            "Não foi possível carregar os dados da Google Sheet."
        );
    }
}


function aplicarDadosAplicacao(dados) {
    const resumo =
        dados.resumo || {};

    DATA.dashboard = {
        totalClientes:
            Number(
                resumo.totalClientes || 0
            ),

        totalFaturas:
            Number(
                resumo.totalFaturas || 0
            ),

        valorTotal:
            Number(
                resumo.valorTotal || 0
            ),

        valorPendente:
            Number(
                resumo.valorPendente || 0
            ),

        totalVencidas:
            Number(
                resumo.totalVencidas || 0
            )
    };

    DATA.faturas =
        Array.isArray(dados.pendentes)
            ? dados.pendentes
            : [];

    DATA.rankings = {
        clientes:
            Array.isArray(
                dados.rankingClientes
            )
                ? dados.rankingClientes
                : []
    };

    DATA.historicoEvolucao =
        Array.isArray(
            dados.historicoEvolucao
        )
            ? dados.historicoEvolucao
            : [];

    renderizarDashboard(
        dados.ultimaImportacao || null
    );

    renderizarAlertasDashboard();

    renderizarGraficoEvolucao(
        DATA.historicoEvolucao
    );

    renderizarGraficoAntiguidade(
        DATA.faturas
    );

    renderizarGraficoTopClientes(
        DATA.rankings.clientes
    );

    renderizarInsightsAutomaticos(
        DATA.faturas,
        DATA.rankings.clientes,
        DATA.historicoEvolucao
    );
}


function renderizarDashboard(
    ultimaImportacao
) {
    ELEMENTOS.kpiClientes.textContent =
        formatarNumero(
            DATA.dashboard.totalClientes
        );

    ELEMENTOS.kpiFaturas.textContent =
        formatarNumero(
            DATA.dashboard.totalFaturas
        );

    ELEMENTOS.kpiValorPendente.textContent =
        formatarMoeda(
            DATA.dashboard.valorPendente
        );

    ELEMENTOS.kpiVencidas.textContent =
        formatarNumero(
            DATA.dashboard.totalVencidas
        );

    if (ultimaImportacao) {
        ELEMENTOS.dashboardLastImport
            .innerHTML = `
                <i data-lucide="clock-3"></i>

                <span>
                    Atualizado em
                    ${escaparHtml(
                        ultimaImportacao
                            .dataImportacao ||
                        "—"
                    )}
                </span>
            `;

        ELEMENTOS.lastImport.innerHTML = `
            <div class="last-import-icon">
                <i data-lucide="history"></i>
            </div>

            <div>

                <strong>
                    Última importação
                </strong>

                <p>
                    ${escaparHtml(
                        ultimaImportacao
                            .dataImportacao ||
                        "—"
                    )}
                    ·
                    ${formatarNumero(
                        ultimaImportacao
                            .totalFaturas || 0
                    )}
                    faturas
                </p>

            </div>
        `;

    } else {
        ELEMENTOS.dashboardLastImport
            .innerHTML = `
                <i data-lucide="clock-3"></i>

                <span>
                    Ainda não existem importações
                </span>
            `;
    }

    if (window.lucide) {
        window.lucide.createIcons();
    }
}


async function renderizarGraficoEvolucao(
    historico
) {
    const painel =
        document.querySelector(
            ".dashboard-grid .panel-large"
        );

    if (!painel) {
        return;
    }

    const zonaAtual =
        painel.querySelector(
            ".empty-visual, .chart-container"
        );

    if (
        !Array.isArray(historico) ||
        historico.length === 0
    ) {
        if (graficoEvolucao) {
            graficoEvolucao.destroy();
            graficoEvolucao = null;
        }

        if (zonaAtual) {
            zonaAtual.outerHTML = `
                <div class="empty-visual">

                    <div class="empty-visual-icon">
                        <i data-lucide="chart-no-axes-combined"></i>
                    </div>

                    <strong>
                        Ainda não existe histórico
                    </strong>

                    <p>
                        O gráfico ficará disponível após existirem importações registadas na folha IMPORTACOES.
                    </p>

                </div>
            `;
        }

        if (window.lucide) {
            window.lucide.createIcons();
        }

        return;
    }

    if (
        !zonaAtual ||
        !zonaAtual.classList.contains(
            "chart-container"
        )
    ) {
        zonaAtual.outerHTML = `
            <div
                class="chart-container"
                style="
                    position:relative;
                    width:100%;
                    height:285px;
                    min-height:285px;
                    margin-top:18px;
                ">

                <canvas
                    id="evolucaoPendenteChart"
                    aria-label="Evolução do valor pendente"
                    role="img">
                </canvas>

            </div>
        `;
    }

    try {
        await carregarChartJs();
    } catch (erro) {
        console.error(
            "Erro ao carregar Chart.js:",
            erro
        );

        const container =
            painel.querySelector(
                ".chart-container"
            );

        if (container) {
            container.outerHTML = `
                <div class="empty-visual">

                    <div class="empty-visual-icon">
                        <i data-lucide="triangle-alert"></i>
                    </div>

                    <strong>
                        Não foi possível carregar o gráfico
                    </strong>

                    <p>
                        Atualiza a página para voltar a tentar.
                    </p>

                </div>
            `;
        }

        if (window.lucide) {
            window.lucide.createIcons();
        }

        return;
    }

    const canvas =
        document.getElementById(
            "evolucaoPendenteChart"
        );

    if (!canvas) {
        return;
    }

    if (graficoEvolucao) {
        graficoEvolucao.destroy();
    }

    const estilos =
        getComputedStyle(
            document.documentElement
        );

    const corTexto =
        estilos.getPropertyValue(
            "--muted"
        ).trim() || "#94a3b8";

    const corLinha =
        estilos.getPropertyValue(
            "--primary"
        ).trim() || "#10b981";

    const corGrelha =
        estilos.getPropertyValue(
            "--border"
        ).trim() || "rgba(148,163,184,.15)";

    const labels = historico.map(
        function(item) {
            return formatarDataGrafico(
                item.dataImportacao
            );
        }
    );

    const valores = historico.map(
        function(item) {
            return Number(
                item.valorPendente || 0
            );
        }
    );

    graficoEvolucao =
        new window.Chart(
            canvas.getContext("2d"),
            {
                type: "line",

                data: {
                    labels: labels,

                    datasets: [
                        {
                            label:
                                "Valor pendente",

                            data: valores,

                            borderColor:
                                corLinha,

                            backgroundColor:
                                criarGradienteGrafico(
                                    canvas,
                                    corLinha
                                ),

                            borderWidth: 3,
                            fill: true,
                            tension: 0.35,
                            pointRadius:
                                historico.length > 16
                                    ? 2
                                    : 4,

                            pointHoverRadius: 6,
                            pointBackgroundColor:
                                corLinha,

                            pointBorderWidth: 0
                        }
                    ]
                },

                options: {
                    responsive: true,
                    maintainAspectRatio: false,

                    interaction: {
                        mode: "index",
                        intersect: false
                    },

                    plugins: {
                        legend: {
                            display: false
                        },

                        tooltip: {
                            displayColors: false,

                            callbacks: {
                                title:
                                    function(contexto) {
                                        const indice =
                                            contexto[0]
                                                .dataIndex;

                                        return (
                                            historico[
                                                indice
                                            ]
                                                .dataImportacao ||
                                            ""
                                        );
                                    },

                                label:
                                    function(contexto) {
                                        return (
                                            " Valor pendente: " +
                                            formatarMoeda(
                                                contexto.parsed.y
                                            )
                                        );
                                    },

                                afterLabel:
                                    function(contexto) {
                                        const item =
                                            historico[
                                                contexto
                                                    .dataIndex
                                            ];

                                        return [
                                            " Faturas: " +
                                                formatarNumero(
                                                    item.totalFaturas ||
                                                    0
                                                ),

                                            " Clientes: " +
                                                formatarNumero(
                                                    item.totalClientes ||
                                                    0
                                                )
                                        ];
                                    }
                            }
                        }
                    },

                    scales: {
                        x: {
                            grid: {
                                display: false
                            },

                            ticks: {
                                color: corTexto,
                                maxRotation: 0,
                                autoSkip: true,
                                maxTicksLimit: 7,
                                font: {
                                    size: 10,
                                    family: "Inter"
                                }
                            },

                            border: {
                                display: false
                            }
                        },

                        y: {
                            beginAtZero: false,

                            grid: {
                                color: corGrelha,
                                drawTicks: false
                            },

                            ticks: {
                                color: corTexto,
                                padding: 10,

                                callback:
                                    function(valor) {
                                        return formatarMoedaCompacta(
                                            valor
                                        );
                                    },

                                font: {
                                    size: 10,
                                    family: "Inter"
                                }
                            },

                            border: {
                                display: false
                            }
                        }
                    }
                }
            }
        );
}


function carregarChartJs() {
    if (window.Chart) {
        return Promise.resolve(
            window.Chart
        );
    }

    if (promessaChartJs) {
        return promessaChartJs;
    }

    promessaChartJs =
        new Promise(
            function(resolve, reject) {
                const script =
                    document.createElement(
                        "script"
                    );

                script.src =
                    "https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js";

                script.onload =
                    function() {
                        resolve(
                            window.Chart
                        );
                    };

                script.onerror =
                    function() {
                        promessaChartJs = null;

                        reject(
                            new Error(
                                "Falha ao carregar Chart.js."
                            )
                        );
                    };

                document.head.appendChild(
                    script
                );
            }
        );

    return promessaChartJs;
}


function criarGradienteGrafico(
    canvas,
    cor
) {
    const contexto =
        canvas.getContext("2d");

    const gradiente =
        contexto.createLinearGradient(
            0,
            0,
            0,
            canvas.clientHeight || 285
        );

    gradiente.addColorStop(
        0,
        converterCorParaRgba(
            cor,
            0.30
        )
    );

    gradiente.addColorStop(
        1,
        converterCorParaRgba(
            cor,
            0.01
        )
    );

    return gradiente;
}


function converterCorParaRgba(
    cor,
    opacidade
) {
    if (
        typeof cor === "string" &&
        cor.trim().startsWith("#")
    ) {
        let hexadecimal =
            cor.trim().slice(1);

        if (hexadecimal.length === 3) {
            hexadecimal =
                hexadecimal
                    .split("")
                    .map(
                        function(caractere) {
                            return (
                                caractere +
                                caractere
                            );
                        }
                    )
                    .join("");
        }

        if (hexadecimal.length === 6) {
            const vermelho =
                parseInt(
                    hexadecimal.slice(0, 2),
                    16
                );

            const verde =
                parseInt(
                    hexadecimal.slice(2, 4),
                    16
                );

            const azul =
                parseInt(
                    hexadecimal.slice(4, 6),
                    16
                );

            return (
                "rgba(" +
                vermelho +
                "," +
                verde +
                "," +
                azul +
                "," +
                opacidade +
                ")"
            );
        }
    }

    return (
        "rgba(16,185,129," +
        opacidade +
        ")"
    );
}


function formatarDataGrafico(
    valor
) {
    const textoData =
        String(valor || "").trim();

    if (!textoData) {
        return "—";
    }

    const correspondencia =
        textoData.match(
            /^(\d{2})\/(\d{2})\/(\d{4})/
        );

    if (correspondencia) {
        return (
            correspondencia[1] +
            "/" +
            correspondencia[2]
        );
    }

    return textoData;
}


function formatarMoedaCompacta(
    valor
) {
    const numero =
        Number(valor || 0);

    if (
        Math.abs(numero) >= 1000000
    ) {
        return (
            new Intl.NumberFormat(
                "pt-PT",
                {
                    maximumFractionDigits: 1
                }
            ).format(
                numero / 1000000
            ) +
            " M€"
        );
    }

    if (
        Math.abs(numero) >= 1000
    ) {
        return (
            new Intl.NumberFormat(
                "pt-PT",
                {
                    maximumFractionDigits: 0
                }
            ).format(
                numero / 1000
            ) +
            " mil €"
        );
    }

    return formatarMoeda(numero);
}


function definirDashboardEmCarregamento() {
    ELEMENTOS.kpiClientes.textContent = "…";
    ELEMENTOS.kpiFaturas.textContent = "…";
    ELEMENTOS.kpiValorPendente.textContent = "…";
    ELEMENTOS.kpiVencidas.textContent = "…";

    ELEMENTOS.dashboardLastImport
        .innerHTML = `
            <i data-lucide="loader-circle"></i>

            <span>
                A carregar dados...
            </span>
        `;

    if (window.lucide) {
        window.lucide.createIcons();
    }
}


function mostrarErroCarregamentoDashboard(
    mensagem
) {
    ELEMENTOS.kpiClientes.textContent = "—";
    ELEMENTOS.kpiFaturas.textContent = "—";
    ELEMENTOS.kpiValorPendente.textContent = "—";
    ELEMENTOS.kpiVencidas.textContent = "—";

    ELEMENTOS.dashboardLastImport
        .innerHTML = `
            <i data-lucide="triangle-alert"></i>

            <span>
                ${escaparHtml(mensagem)}
            </span>
        `;

    if (window.lucide) {
        window.lucide.createIcons();
    }
}


async function renderizarGraficoAntiguidade(
    faturas
) {
    const area =
        document.getElementById(
            "agingChartArea"
        );

    const legenda =
        document.getElementById(
            "agingLegend"
        );

    if (!area || !legenda) {
        return;
    }

    const aging =
        calcularAntiguidadeDivida(
            faturas
        );

    const totalVencido =
        aging.reduce(
            function(total, item) {
                return total + item.valor;
            },
            0
        );

    if (totalVencido <= 0) {
        if (graficoAging) {
            graficoAging.destroy();
            graficoAging = null;
        }

        area.innerHTML = `
            <div class="chart-empty-state">
                <i data-lucide="circle-check-big"></i>
                <strong>Sem dívida vencida</strong>
                <p>Não existem valores pendentes com data de vencimento ultrapassada.</p>
            </div>
        `;

        legenda.innerHTML = "";

        if (window.lucide) {
            window.lucide.createIcons();
        }

        return;
    }

    if (
        !document.getElementById(
            "agingDebtChart"
        )
    ) {
        area.innerHTML = `
            <canvas
                id="agingDebtChart"
                aria-label="Antiguidade da dívida vencida"
                role="img">
            </canvas>
        `;
    }

    await carregarChartJs();

    const canvas =
        document.getElementById(
            "agingDebtChart"
        );

    if (!canvas) {
        return;
    }

    if (graficoAging) {
        graficoAging.destroy();
    }

    const cores = [
        "#22c55e",
        "#f59e0b",
        "#f97316",
        "#ef4444"
    ];

    graficoAging =
        new window.Chart(
            canvas.getContext("2d"),
            {
                type: "doughnut",

                data: {
                    labels:
                        aging.map(
                            function(item) {
                                return item.label;
                            }
                        ),

                    datasets: [
                        {
                            data:
                                aging.map(
                                    function(item) {
                                        return item.valor;
                                    }
                                ),

                            backgroundColor:
                                cores,

                            borderWidth: 0,
                            hoverOffset: 6
                        }
                    ]
                },

                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: "70%",

                    plugins: {
                        legend: {
                            display: false
                        },

                        tooltip: {
                            displayColors: true,

                            callbacks: {
                                label:
                                    function(contexto) {
                                        const valor =
                                            Number(
                                                contexto.raw || 0
                                            );

                                        const percentagem =
                                            totalVencido > 0
                                                ? (
                                                    valor /
                                                    totalVencido
                                                ) * 100
                                                : 0;

                                        return (
                                            " " +
                                            contexto.label +
                                            ": " +
                                            formatarMoeda(
                                                valor
                                            ) +
                                            " (" +
                                            percentagem.toFixed(
                                                1
                                            ) +
                                            "%)"
                                        );
                                    }
                            }
                        }
                    }
                },

                plugins: [
                    {
                        id:
                            "textoCentroAging",

                        afterDraw:
                            function(grafico) {
                                const contexto =
                                    grafico.ctx;

                                const areaGrafico =
                                    grafico.chartArea;

                                if (!areaGrafico) {
                                    return;
                                }

                                const centroX =
                                    (
                                        areaGrafico.left +
                                        areaGrafico.right
                                    ) / 2;

                                const centroY =
                                    (
                                        areaGrafico.top +
                                        areaGrafico.bottom
                                    ) / 2;

                                contexto.save();
                                contexto.textAlign =
                                    "center";

                                contexto.fillStyle =
                                    getComputedStyle(
                                        document.documentElement
                                    )
                                        .getPropertyValue(
                                            "--muted"
                                        )
                                        .trim();

                                contexto.font =
                                    "600 10px Inter";

                                contexto.fillText(
                                    "Total vencido",
                                    centroX,
                                    centroY - 9
                                );

                                contexto.fillStyle =
                                    getComputedStyle(
                                        document.documentElement
                                    )
                                        .getPropertyValue(
                                            "--text"
                                        )
                                        .trim();

                                contexto.font =
                                    "800 15px Inter";

                                contexto.fillText(
                                    formatarMoedaCompacta(
                                        totalVencido
                                    ),
                                    centroX,
                                    centroY + 14
                                );

                                contexto.restore();
                            }
                    }
                ]
            }
        );

    legenda.innerHTML =
        aging.map(
            function(item, indice) {
                return `
                    <div class="aging-legend-item">

                        <div class="aging-legend-label">

                            <span
                                class="aging-legend-dot"
                                style="background:${cores[indice]};">
                            </span>

                            <span>
                                ${escaparHtml(item.label)}
                            </span>

                        </div>

                        <span class="aging-legend-value">
                            ${formatarMoedaCompacta(
                                item.valor
                            )}
                        </span>

                    </div>
                `;
            }
        ).join("");
}


function calcularAntiguidadeDivida(
    faturas
) {
    const grupos = [
        {
            label: "0–30 dias",
            minimo: 0,
            maximo: 30,
            valor: 0,
            quantidade: 0
        },
        {
            label: "31–60 dias",
            minimo: 31,
            maximo: 60,
            valor: 0,
            quantidade: 0
        },
        {
            label: "61–90 dias",
            minimo: 61,
            maximo: 90,
            valor: 0,
            quantidade: 0
        },
        {
            label: "+90 dias",
            minimo: 91,
            maximo: Infinity,
            valor: 0,
            quantidade: 0
        }
    ];

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    (Array.isArray(faturas)
        ? faturas
        : []
    ).forEach(
        function(fatura) {
            const vencimento =
                converterDataFrontend(
                    fatura.dataVencimento
                );

            const valor =
                Number(
                    fatura.valorPendente || 0
                );

            if (
                !vencimento ||
                valor <= 0 ||
                vencimento >= hoje
            ) {
                return;
            }

            const dias =
                Math.floor(
                    (
                        hoje.getTime() -
                        vencimento.getTime()
                    ) /
                    86400000
                );

            const grupo =
                grupos.find(
                    function(item) {
                        return (
                            dias >= item.minimo &&
                            dias <= item.maximo
                        );
                    }
                );

            if (grupo) {
                grupo.valor += valor;
                grupo.quantidade++;
            }
        }
    );

    return grupos;
}


async function renderizarGraficoTopClientes(
    clientes
) {
    const area =
        document.getElementById(
            "topClientsChartArea"
        );

    if (!area) {
        return;
    }

    const ranking =
        (
            Array.isArray(clientes)
                ? clientes
                : []
        )
            .slice(0, 10)
            .reverse();

    if (ranking.length === 0) {
        if (graficoTopClientes) {
            graficoTopClientes.destroy();
            graficoTopClientes = null;
        }

        area.innerHTML = `
            <div class="chart-empty-state">
                <i data-lucide="users"></i>
                <strong>Sem clientes para apresentar</strong>
                <p>O ranking ficará disponível quando a folha PENDENTES tiver dados.</p>
            </div>
        `;

        if (window.lucide) {
            window.lucide.createIcons();
        }

        return;
    }

    if (
        !document.getElementById(
            "topClientsChart"
        )
    ) {
        area.innerHTML = `
            <canvas
                id="topClientsChart"
                aria-label="Top 10 clientes por valor pendente"
                role="img">
            </canvas>
        `;
    }

    await carregarChartJs();

    const canvas =
        document.getElementById(
            "topClientsChart"
        );

    if (!canvas) {
        return;
    }

    if (graficoTopClientes) {
        graficoTopClientes.destroy();
    }

    const estilos =
        getComputedStyle(
            document.documentElement
        );

    const corTexto =
        estilos.getPropertyValue(
            "--muted"
        ).trim() || "#94a3b8";

    const corLinha =
        estilos.getPropertyValue(
            "--primary"
        ).trim() || "#10b981";

    const corGrelha =
        estilos.getPropertyValue(
            "--border"
        ).trim() ||
        "rgba(148,163,184,.15)";

    graficoTopClientes =
        new window.Chart(
            canvas.getContext("2d"),
            {
                type: "bar",

                data: {
                    labels:
                        ranking.map(
                            function(cliente) {
                                return abreviarNomeCliente(
                                    cliente.nome ||
                                    cliente.numeroCliente ||
                                    "Cliente"
                                );
                            }
                        ),

                    datasets: [
                        {
                            label:
                                "Valor pendente",

                            data:
                                ranking.map(
                                    function(cliente) {
                                        return Number(
                                            cliente.valorPendente ||
                                            0
                                        );
                                    }
                                ),

                            backgroundColor:
                                converterCorParaRgba(
                                    corLinha,
                                    0.72
                                ),

                            borderColor:
                                corLinha,

                            borderWidth: 1,
                            borderRadius: 7,
                            borderSkipped: false,
                            maxBarThickness: 21
                        }
                    ]
                },

                options: {
                    indexAxis: "y",
                    responsive: true,
                    maintainAspectRatio: false,

                    plugins: {
                        legend: {
                            display: false
                        },

                        tooltip: {
                            displayColors: false,

                            callbacks: {
                                title:
                                    function(contexto) {
                                        const indice =
                                            contexto[0]
                                                .dataIndex;

                                        const cliente =
                                            ranking[indice];

                                        return (
                                            cliente.nome ||
                                            cliente.numeroCliente ||
                                            "Cliente"
                                        );
                                    },

                                label:
                                    function(contexto) {
                                        return (
                                            " Valor pendente: " +
                                            formatarMoeda(
                                                contexto.parsed.x
                                            )
                                        );
                                    },

                                afterLabel:
                                    function(contexto) {
                                        const cliente =
                                            ranking[
                                                contexto.dataIndex
                                            ];

                                        return (
                                            " Faturas: " +
                                            formatarNumero(
                                                cliente.totalFaturas ||
                                                0
                                            )
                                        );
                                    }
                            }
                        }
                    },

                    scales: {
                        x: {
                            beginAtZero: true,

                            grid: {
                                color: corGrelha,
                                drawTicks: false
                            },

                            ticks: {
                                color: corTexto,
                                padding: 8,

                                callback:
                                    function(valor) {
                                        return formatarMoedaCompacta(
                                            valor
                                        );
                                    },

                                font: {
                                    size: 9,
                                    family: "Inter"
                                }
                            },

                            border: {
                                display: false
                            }
                        },

                        y: {
                            grid: {
                                display: false
                            },

                            ticks: {
                                color: corTexto,
                                font: {
                                    size: 9,
                                    family: "Inter",
                                    weight: "600"
                                }
                            },

                            border: {
                                display: false
                            }
                        }
                    }
                }
            }
        );
}


function renderizarInsightsAutomaticos(
    faturas,
    clientes,
    historico
) {
    const grelha =
        document.getElementById(
            "aiInsightsGrid"
        );

    if (!grelha) {
        return;
    }

    const listaFaturas =
        Array.isArray(faturas)
            ? faturas
            : [];

    const ranking =
        Array.isArray(clientes)
            ? clientes
            : [];

    const evolucao =
        Array.isArray(historico)
            ? historico
            : [];

    if (listaFaturas.length === 0) {
        grelha.innerHTML = `
            <div class="ai-insight-card information">

                <div class="ai-insight-icon">
                    <i data-lucide="database"></i>
                </div>

                <div>
                    <strong>Sem dados para analisar</strong>
                    <p>Importe um ficheiro para gerar conclusões automáticas.</p>
                </div>

            </div>
        `;

        if (window.lucide) {
            window.lucide.createIcons();
        }

        return;
    }

    const totalPendente =
        listaFaturas.reduce(
            function(total, fatura) {
                return (
                    total +
                    Number(
                        fatura.valorPendente || 0
                    )
                );
            },
            0
        );

    const maiorCliente =
        ranking[0] || null;

    const pesoMaiorCliente =
        (
            maiorCliente &&
            totalPendente > 0
        )
            ? (
                Number(
                    maiorCliente.valorPendente ||
                    0
                ) /
                totalPendente
            ) * 100
            : 0;

    const valorTop5 =
        ranking
            .slice(0, 5)
            .reduce(
                function(total, cliente) {
                    return (
                        total +
                        Number(
                            cliente.valorPendente ||
                            0
                        )
                    );
                },
                0
            );

    const pesoTop5 =
        totalPendente > 0
            ? (
                valorTop5 /
                totalPendente
            ) * 100
            : 0;

    const aging =
        calcularAntiguidadeDivida(
            listaFaturas
        );

    const mais90 =
        aging[3];

    let variacao = null;

    if (evolucao.length >= 2) {
        const atual =
            Number(
                evolucao[
                    evolucao.length - 1
                ].valorPendente || 0
            );

        const anterior =
            Number(
                evolucao[
                    evolucao.length - 2
                ].valorPendente || 0
            );

        if (anterior !== 0) {
            variacao =
                (
                    (
                        atual -
                        anterior
                    ) /
                    anterior
                ) * 100;
        }
    }

    const insights = [];

    if (maiorCliente) {
        insights.push({
            classe:
                pesoMaiorCliente >= 20
                    ? "critical"
                    : "warning",

            icone: "building-2",

            metrica:
                pesoMaiorCliente.toFixed(1) +
                "%",

            titulo:
                "Maior exposição num cliente",

            texto:
                (
                    maiorCliente.nome ||
                    maiorCliente.numeroCliente ||
                    "O principal cliente"
                ) +
                " representa " +
                pesoMaiorCliente.toFixed(1) +
                "% do valor pendente."
        });
    }

    insights.push({
        classe:
            pesoTop5 >= 60
                ? "critical"
                : "information",

        icone: "layers-3",

        metrica:
            pesoTop5.toFixed(1) +
            "%",

        titulo:
            "Concentração nos cinco maiores",

        texto:
            "Os cinco maiores clientes concentram " +
            formatarMoeda(
                valorTop5
            ) +
            " da carteira pendente."
    });

    insights.push({
        classe:
            mais90.valor > 0
                ? "critical"
                : "positive",

        icone:
            mais90.valor > 0
                ? "timer-off"
                : "circle-check-big",

        metrica:
            formatarMoedaCompacta(
                mais90.valor
            ),

        titulo:
            "Dívida vencida há mais de 90 dias",

        texto:
            formatarNumero(
                mais90.quantidade
            ) +
            " faturas encontram-se nesta faixa crítica."
    });

    if (variacao === null) {
        insights.push({
            classe: "information",
            icone: "chart-line",
            metrica: "—",
            titulo:
                "Evolução entre importações",
            texto:
                "É necessária pelo menos mais uma importação para calcular a variação."
        });

    } else {
        const diminuiu =
            variacao < 0;

        insights.push({
            classe:
                diminuiu
                    ? "positive"
                    : (
                        variacao > 0
                            ? "warning"
                            : "information"
                    ),

            icone:
                diminuiu
                    ? "trending-down"
                    : (
                        variacao > 0
                            ? "trending-up"
                            : "minus"
                    ),

            metrica:
                (
                    variacao > 0
                        ? "+"
                        : ""
                ) +
                variacao.toFixed(1) +
                "%",

            titulo:
                "Variação desde a importação anterior",

            texto:
                diminuiu
                    ? "O valor pendente diminuiu face à importação anterior."
                    : (
                        variacao > 0
                            ? "O valor pendente aumentou face à importação anterior."
                            : "O valor pendente manteve-se inalterado."
                    )
        });
    }

    grelha.innerHTML =
        insights.map(
            function(insight) {
                return `
                    <div class="ai-insight-card ${insight.classe}">

                        <div class="ai-insight-icon">
                            <i data-lucide="${insight.icone}"></i>
                        </div>

                        <div>

                            <span class="ai-insight-metric">
                                ${escaparHtml(
                                    insight.metrica
                                )}
                            </span>

                            <strong>
                                ${escaparHtml(
                                    insight.titulo
                                )}
                            </strong>

                            <p>
                                ${escaparHtml(
                                    insight.texto
                                )}
                            </p>

                        </div>

                    </div>
                `;
            }
        ).join("");

    if (window.lucide) {
        window.lucide.createIcons();
    }
}


function converterDataFrontend(
    valor
) {
    if (!valor) {
        return null;
    }

    if (
        valor instanceof Date &&
        !isNaN(valor.getTime())
    ) {
        const data =
            new Date(valor);

        data.setHours(0, 0, 0, 0);

        return data;
    }

    const textoData =
        String(valor).trim();

    const correspondencia =
        textoData.match(
            /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/
        );

    if (!correspondencia) {
        return null;
    }

    let ano =
        Number(
            correspondencia[3]
        );

    if (ano < 100) {
        ano +=
            ano >= 70
                ? 1900
                : 2000;
    }

    const data =
        new Date(
            ano,
            Number(
                correspondencia[2]
            ) - 1,
            Number(
                correspondencia[1]
            )
        );

    if (isNaN(data.getTime())) {
        return null;
    }

    data.setHours(0, 0, 0, 0);

    return data;
}


function abreviarNomeCliente(
    nome
) {
    const textoNome =
        String(nome || "").trim();

    if (textoNome.length <= 24) {
        return textoNome;
    }

    return (
        textoNome.slice(0, 22) +
        "…"
    );
}


function renderizarRankingClientes(
    clientes
) {
    const painel =
        document.querySelector(
            ".secondary-grid .panel:nth-child(2)"
        );

    if (!painel) {
        return;
    }

    const conteudoAntigo =
        painel.querySelector(
            ".table-placeholder, .ranking-clientes"
        );

    if (!conteudoAntigo) {
        return;
    }

    if (
        !Array.isArray(clientes) ||
        clientes.length === 0
    ) {
        conteudoAntigo.outerHTML = `
            <div class="ranking-clientes">

                <div class="alert-item neutral">

                    <div class="alert-marker"></div>

                    <div>

                        <strong>
                            Sem clientes para apresentar
                        </strong>

                        <p>
                            A folha PENDENTES ainda não contém dados.
                        </p>

                    </div>

                </div>

            </div>
        `;

        return;
    }

    const linhas = clientes
        .slice(0, 5)
        .map(function(cliente, indice) {
            return `
                <div
                    style="
                        display:grid;
                        grid-template-columns:34px minmax(0,1fr) auto;
                        align-items:center;
                        gap:11px;
                        padding:12px 0;
                        border-bottom:
                            ${indice === Math.min(clientes.length, 5) - 1
                                ? "none"
                                : "1px solid var(--border)"};
                    ">

                    <div
                        style="
                            width:30px;
                            height:30px;
                            display:grid;
                            place-items:center;
                            border-radius:9px;
                            background:var(--primary-soft);
                            color:var(--primary-dark);
                            font-size:10px;
                            font-weight:800;
                        ">
                        ${indice + 1}
                    </div>

                    <div style="min-width:0;">

                        <strong
                            style="
                                display:block;
                                overflow:hidden;
                                color:var(--text);
                                font-size:11px;
                                text-overflow:ellipsis;
                                white-space:nowrap;
                            ">
                            ${escaparHtml(
                                cliente.nome ||
                                cliente.numeroCliente ||
                                "Cliente"
                            )}
                        </strong>

                        <span
                            style="
                                color:var(--muted);
                                font-size:9px;
                            ">
                            ${formatarNumero(
                                cliente.totalFaturas || 0
                            )}
                            faturas
                        </span>

                    </div>

                    <strong
                        style="
                            color:var(--text);
                            font-size:11px;
                            white-space:nowrap;
                        ">
                        ${formatarMoeda(
                            cliente.valorPendente || 0
                        )}
                    </strong>

                </div>
            `;
        })
        .join("");

    conteudoAntigo.outerHTML = `
        <div class="ranking-clientes">
            ${linhas}
        </div>
    `;
}


function renderizarAlertasDashboard() {
    const lista =
        document.querySelector(
            ".alert-list"
        );

    if (!lista) {
        return;
    }

    if (DATA.dashboard.totalFaturas === 0) {
        lista.innerHTML = `
            <div class="alert-item neutral">

                <div class="alert-marker"></div>

                <div>

                    <strong>
                        Sem faturas pendentes
                    </strong>

                    <p>
                        A folha PENDENTES não contém documentos.
                    </p>

                </div>

            </div>
        `;

        return;
    }

    const percentagemVencidas =
        DATA.dashboard.totalFaturas > 0
            ? Math.round(
                (
                    DATA.dashboard.totalVencidas /
                    DATA.dashboard.totalFaturas
                ) * 100
            )
            : 0;

    lista.innerHTML = `
        <div class="alert-item neutral">

            <div
                class="alert-marker"
                style="
                    background:
                        ${DATA.dashboard.totalVencidas > 0
                            ? "var(--danger)"
                            : "var(--success)"};
                ">
            </div>

            <div>

                <strong>
                    ${formatarNumero(
                        DATA.dashboard.totalVencidas
                    )}
                    faturas vencidas
                </strong>

                <p>
                    Representam
                    ${formatarNumero(
                        percentagemVencidas
                    )}%
                    das faturas pendentes.
                </p>

            </div>

        </div>

        <div
            class="alert-item neutral"
            style="margin-top:10px;">

            <div
                class="alert-marker"
                style="background:var(--amber);">
            </div>

            <div>

                <strong>
                    Valor total pendente
                </strong>

                <p>
                    ${formatarMoeda(
                        DATA.dashboard.valorPendente
                    )}
                    por cobrar.
                </p>

            </div>

        </div>
    `;
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

            const separador =
                detetarSeparador(
                    conteudo
                );

            const tabela =
                converterCsvEmTabela(
                    conteudo,
                    separador
                );

            validarTabela(tabela);

            linhasCsv =
                converterTabelaEmObjetos(
                    tabela
                );

            if (linhasCsv.length === 0) {
                throw new Error(
                    "O ficheiro não contém faturas válidas."
                );
            }

            resumoCsv =
                calcularResumo(
                    linhasCsv
                );

            atualizarDataLocal(
                linhasCsv,
                resumoCsv
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


function atualizarDataLocal(
    linhas,
    resumo
) {
    DATA.faturas = linhas;

    DATA.dashboard = {
        totalClientes:
            resumo.totalClientes,

        totalFaturas:
            resumo.totalFaturas,

        valorTotal:
            resumo.valorTotal,

        valorPendente:
            resumo.valorPendente,

        totalVencidas:
            resumo.totalVencidas
    };
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

    const cabecalhos =
        tabela[0].map(
            normalizarCabecalho
        );

    const cabecalhosEmFalta =
        CABECALHOS_OBRIGATORIOS
            .filter(
                function(
                    cabecalhoObrigatorio
                ) {
                    return !cabecalhos.includes(
                        normalizarCabecalho(
                            cabecalhoObrigatorio
                        )
                    );
                }
            );

    if (
        cabecalhosEmFalta.length > 0
    ) {
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

            if (
                quantidade >
                maiorQuantidade
            ) {
                maiorQuantidade =
                    quantidade;

                melhorSeparador =
                    separador;
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
        const caractere =
            linha[indice];

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
        const caractere =
            conteudo[indice];

        const seguinte =
            conteudo[indice + 1];

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
                linhas.push(
                    linhaAtual
                );
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

    if (
        ultimaLinhaTemConteudo
    ) {
        linhas.push(
            linhaAtual
        );
    }

    return linhas;
}


function converterTabelaEmObjetos(
    tabela
) {
    const cabecalhosOriginais =
        tabela[0].map(
            function(cabecalho) {
                return cabecalho.trim();
            }
        );

    const mapaCabecalhos = {};

    cabecalhosOriginais.forEach(
        function(
            cabecalho,
            indice
        ) {
            mapaCabecalhos[
                normalizarCabecalho(
                    cabecalho
                )
            ] = indice;
        }
    );

    return tabela
        .slice(1)
        .map(
            function(linha) {
                const objeto = {};

                CABECALHOS_OBRIGATORIOS
                    .forEach(
                        function(
                            cabecalho
                        ) {
                            const indice =
                                mapaCabecalhos[
                                    normalizarCabecalho(
                                        cabecalho
                                    )
                                ];

                            objeto[cabecalho] =
                                indice !==
                                undefined
                                    ? String(
                                        linha[
                                            indice
                                        ] || ""
                                    ).trim()
                                    : "";
                        }
                    );

                return objeto;
            }
        )
        .filter(
            function(linha) {
                return (
                    linha["N."] !== "" ||
                    linha["Nome"] !== "" ||
                    linha[
                        "Documento"
                    ] !== "" ||
                    linha[
                        "N.º Doc."
                    ] !== ""
                );
            }
        );
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
    let totalVencidas = 0;

    const hoje =
        obterDataSemHoras(
            new Date()
        );

    linhas.forEach(
        function(linha) {
            const identificadorCliente =
                linha["N."] ||
                linha["Nome"];

            if (
                identificadorCliente
            ) {
                clientes.add(
                    identificadorCliente
                        .trim()
                        .toUpperCase()
                );
            }

            valorTotal +=
                converterNumero(
                    linha[
                        "Valor Total"
                    ]
                );

            const pendente =
                converterNumero(
                    linha[
                        "Val. Pendente"
                    ]
                );

            valorPendente +=
                pendente;

            const vencimento =
                converterDataCsv(
                    linha[
                        "Dt. Venc."
                    ]
                );

            if (
                pendente > 0 &&
                vencimento &&
                vencimento < hoje
            ) {
                totalVencidas++;
            }
        }
    );

    return {
        totalClientes:
            clientes.size,

        totalFaturas:
            linhas.length,

        totalVencidas:
            totalVencidas,

        valorTotal:
            arredondarMoeda(
                valorTotal
            ),

        valorPendente:
            arredondarMoeda(
                valorPendente
            )
    };
}


function converterDataCsv(valor) {
    const texto =
        String(valor || "")
            .trim();

    if (!texto) {
        return null;
    }

    const partes =
        texto.split(/[\/\-.]/);

    if (partes.length !== 3) {
        return null;
    }

    let dia;
    let mes;
    let ano;

    if (partes[0].length === 4) {
        ano = Number(partes[0]);
        mes = Number(partes[1]);
        dia = Number(partes[2]);

    } else {
        dia = Number(partes[0]);
        mes = Number(partes[1]);
        ano = Number(partes[2]);
    }

    const data =
        new Date(
            ano,
            mes - 1,
            dia
        );

    if (
        data.getFullYear() !== ano ||
        data.getMonth() !== mes - 1 ||
        data.getDate() !== dia
    ) {
        return null;
    }

    return obterDataSemHoras(
        data
    );
}


function obterDataSemHoras(data) {
    return new Date(
        data.getFullYear(),
        data.getMonth(),
        data.getDate()
    );
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

    } else if (
        texto.includes(",")
    ) {
        texto = texto.replace(
            ",",
            "."
        );
    }

    texto = texto.replace(
        /[^0-9.-]/g,
        ""
    );

    const numero =
        Number(texto);

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
    ELEMENTOS.analysisSection
        .classList.add(
            "visible"
        );

    ELEMENTOS.analysisContent
        .innerHTML = `
            <div class="analysis-grid">

                ${criarCartaoAnalise(
                    "Ficheiro",
                    escaparHtml(
                        ficheiro.name
                    )
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
                    "Faturas vencidas",
                    formatarNumero(
                        resumo.totalVencidas
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

    definirTextoBotaoConfirmacao(
        "Confirmar Importação"
    );

    ELEMENTOS.confirmImportBtn.disabled =
        false;
}


function criarCartaoAnalise(
    titulo,
    valor
) {
    return `
        <div class="analysis-card">

            <div class="analysis-card-label">
                ${titulo}
            </div>

            <div class="analysis-card-value">
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
    ELEMENTOS.analysisSection
        .classList.add(
            "visible"
        );

    ELEMENTOS.analysisContent
        .innerHTML = `
            <div class="import-state loading">

                <div class="import-spinner"></div>

                <h3>
                    ${escaparHtml(titulo)}
                </h3>

                <p>
                    ${escaparHtml(descricao)}
                </p>

            </div>
        `;
}


function mostrarImportacaoConcluida(
    resultado
) {
    const diferenca =
        Number(
            resultado
                .diferencaValorPendente ||
            0
        );

    const textoDiferenca =
        diferenca > 0
            ? "+" +
                formatarMoeda(
                    diferenca
                )
            : formatarMoeda(
                diferenca
            );

    ELEMENTOS.analysisSection
        .classList.add(
            "visible"
        );

    ELEMENTOS.analysisContent
        .innerHTML = `
            <div class="import-state success">

                <div class="success-heading">

                    <div class="success-check">
                        <i data-lucide="check"></i>
                    </div>

                    <div>

                        <h3>
                            Importação concluída
                        </h3>

                        <p>
                            ${escaparHtml(
                                resultado
                                    .idImportacao
                            )}
                        </p>

                    </div>

                </div>

                <div class="result-grid">

                    ${criarCartaoResultado(
                        "Clientes",
                        formatarNumero(
                            resultado
                                .totalClientes
                        )
                    )}

                    ${criarCartaoResultado(
                        "Faturas",
                        formatarNumero(
                            resultado
                                .totalFaturas
                        )
                    )}

                    ${criarCartaoResultado(
                        "Novas",
                        formatarNumero(
                            resultado
                                .novasFaturas
                        )
                    )}

                    ${criarCartaoResultado(
                        "Liquidadas",
                        formatarNumero(
                            resultado
                                .liquidadas
                        )
                    )}

                    ${criarCartaoResultado(
                        "Pagamentos parciais",
                        formatarNumero(
                            resultado
                                .pagamentosParciais
                        )
                    )}

                    ${criarCartaoResultado(
                        "Valor pendente",
                        formatarMoeda(
                            resultado
                                .valorPendente
                        )
                    )}

                    ${criarCartaoResultado(
                        "Diferença",
                        textoDiferenca
                    )}

                </div>

            </div>
        `;

    definirTextoBotaoConfirmacao(
        "Importação concluída"
    );

    ELEMENTOS.confirmImportBtn.disabled =
        true;

    if (window.lucide) {
        window.lucide.createIcons();
    }
}


function criarCartaoResultado(
    titulo,
    valor
) {
    return `
        <div class="result-card">

            <div class="result-card-label">
                ${titulo}
            </div>

            <div class="result-card-value">
                ${valor}
            </div>

        </div>
    `;
}


function mostrarErroImportacao(
    mensagem
) {
    ELEMENTOS.analysisSection
        .classList.add(
            "visible"
        );

    ELEMENTOS.analysisContent
        .innerHTML = `
            <div class="import-state error">

                <h3>
                    Erro na importação
                </h3>

                <p>
                    ${escaparHtml(
                        mensagem
                    )}
                </p>

            </div>
        `;

    ELEMENTOS.confirmImportBtn.disabled =
        false;

    definirTextoBotaoConfirmacao(
        "Tentar novamente"
    );
}


function atualizarUltimaImportacao(
    resultado
) {
    ELEMENTOS.lastImport.innerHTML = `
        <div class="last-import-icon">
            <i data-lucide="history"></i>
        </div>

        <div>

            <strong>
                Última importação
            </strong>

            <p>
                ${escaparHtml(
                    resultado
                        .dataImportacao
                )}
                ·
                ${formatarNumero(
                    resultado
                        .totalFaturas
                )}
                faturas
            </p>

        </div>
    `;

    if (window.lucide) {
        window.lucide.createIcons();
    }
}


function atualizarDashboardAposImportacao(
    resultado
) {
    ELEMENTOS.kpiClientes.textContent =
        formatarNumero(
            resultado.totalClientes ??
            DATA.dashboard.totalClientes
        );

    ELEMENTOS.kpiFaturas.textContent =
        formatarNumero(
            resultado.totalFaturas ??
            DATA.dashboard.totalFaturas
        );

    ELEMENTOS.kpiValorPendente.textContent =
        formatarMoeda(
            resultado.valorPendente ??
            DATA.dashboard.valorPendente
        );

    ELEMENTOS.kpiVencidas.textContent =
        formatarNumero(
            DATA.dashboard.totalVencidas
        );

    ELEMENTOS.dashboardLastImport
        .innerHTML = `
            <i data-lucide="clock-3"></i>

            <span>
                Atualizado em
                ${escaparHtml(
                    resultado
                        .dataImportacao ||
                    "agora"
                )}
            </span>
        `;

    if (window.lucide) {
        window.lucide.createIcons();
    }
}


function bloquearInterfaceImportacao() {
    ELEMENTOS.confirmImportBtn.disabled =
        true;

    definirTextoBotaoConfirmacao(
        "A importar..."
    );

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


function definirTextoBotaoConfirmacao(
    texto
) {
    const span =
        ELEMENTOS.confirmImportBtn
            .querySelector(
                "span"
            );

    if (span) {
        span.textContent =
            texto;

    } else {
        ELEMENTOS.confirmImportBtn
            .textContent =
            texto;
    }
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
                background:
                    ${obterCorEstado(tipo)};
                box-shadow:
                    0 0 0 4px
                    ${obterSombraEstado(tipo)};
            ">
        </span>

        <span>
            ${escaparHtml(
                textoEstado
            )}
        </span>
    `;
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
    ELEMENTOS.analysisSection
        .classList.add(
            "visible"
        );

    ELEMENTOS.analysisContent
        .innerHTML = `
            <div class="import-state error">

                <h3>
                    Ficheiro inválido
                </h3>

                <p>
                    ${escaparHtml(
                        mensagem
                    )}
                </p>

            </div>
        `;

    ELEMENTOS.confirmImportBtn.disabled =
        true;
}


function limparAnalise() {
    ELEMENTOS.analysisSection
        .classList.remove(
            "visible"
        );

    ELEMENTOS.analysisContent
        .innerHTML =
        "À espera de um ficheiro CSV...";

    ELEMENTOS.confirmImportBtn.disabled =
        true;

    definirTextoBotaoConfirmacao(
        "Confirmar Importação"
    );
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
