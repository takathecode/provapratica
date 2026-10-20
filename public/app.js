const API = "/api";

let token = localStorage.getItem("edu_token");
let professor = null;
let turmaAtual = null;

const $ = id => document.getElementById(id);

async function requisicao(url, opcoes = {}) {
    const headers = { ...(opcoes.headers || {}) };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    if (opcoes.body) {
        headers["Content-Type"] = "application/json";
    }

    const resposta = await fetch(API + url, {
        ...opcoes,
        headers
    });

    const dados = await resposta.json().catch(() => ({}));

    if (resposta.status === 401 && url !== "/login") {
        sair(false);
        throw new Error(dados.erro || "Faça login novamente.");
    }

    if (!resposta.ok) {
        throw new Error(dados.erro || "Erro na operação.");
    }

    return dados;
}

function escapar(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, caractere => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[caractere]);
}

function mensagem(texto) {
    const toast = $("toast");

    toast.textContent = texto;
    toast.classList.add("show");

    clearTimeout(mensagem.timer);

    mensagem.timer = setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

function mostrarLogin() {
    $("loginScreen").classList.remove("hidden");
    $("appScreen").classList.add("hidden");
}

function mostrarSistema() {
    $("loginScreen").classList.add("hidden");
    $("appScreen").classList.remove("hidden");

    $("teacherName").textContent = professor.nome;
    $("avatar").textContent = professor.nome.charAt(0).toUpperCase();
}

function sair(avisar = true) {
    token = null;
    professor = null;
    turmaAtual = null;

    localStorage.removeItem("edu_token");

    mostrarLogin();

    if (avisar) {
        mensagem("Você saiu do sistema.");
    }
}

// LOGIN
$("loginForm").addEventListener("submit", async event => {
    event.preventDefault();

    $("loginError").textContent = "";

    const botao = $("loginForm").querySelector(
        'button[type="submit"]'
    );

    botao.disabled = true;
    botao.textContent = "Entrando...";

    try {
        const resultado = await fetch(API + "/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email: $("email").value.trim(),
                senha: $("senha").value
            })
        });

        const dados = await resultado.json();

        if (!resultado.ok) {
            throw new Error(dados.erro || "Falha no login.");
        }

        token = dados.token;
        professor = dados.professor;

        localStorage.setItem("edu_token", token);

        mostrarSistema();
        await listarTurmas();

    } catch (erro) {
        $("loginError").textContent = erro.message;
    } finally {
        botao.disabled = false;
        botao.textContent = "Entrar no sistema";
    }
});

// RECUPERAR SESSÃO AO ATUALIZAR A PÁGINA
async function iniciar() {
    if (!token) {
        mostrarLogin();
        return;
    }

    try {
        const dados = await requisicao("/perfil");

        professor = dados.professor;

        mostrarSistema();
        await listarTurmas();

    } catch (erro) {
        mostrarLogin();
    }
}

// FORMULÁRIO DE TURMA
function abrirFormularioTurma() {
    $("classForm").classList.remove("hidden");
    $("classError").textContent = "";
    $("className").focus();
}

function fecharFormularioTurma() {
    $("classForm").reset();
    $("classForm").classList.add("hidden");
    $("classError").textContent = "";
}

$("openClassForm").addEventListener("click", abrirFormularioTurma);
$("emptyAddClass").addEventListener("click", abrirFormularioTurma);
$("cancelClass").addEventListener("click", fecharFormularioTurma);

// CADASTRAR TURMA
$("classForm").addEventListener("submit", async event => {
    event.preventDefault();

    $("classError").textContent = "";

    try {
        await requisicao("/turmas", {
            method: "POST",
            body: JSON.stringify({
                nome: $("className").value.trim(),
                descricao: $("classDescription").value.trim()
            })
        });

        fecharFormularioTurma();
        mensagem("Turma cadastrada com sucesso!");

        await listarTurmas();

    } catch (erro) {
        $("classError").textContent = erro.message;
    }
});

// LISTAR TURMAS
async function listarTurmas() {
    try {
        const turmas = await requisicao("/turmas");

        $("classGrid").innerHTML = turmas.map(turma => `
            <article class="class-card">
                <div class="class-symbol">▦</div>

                <h3>${escapar(turma.nome)}</h3>

                <p class="class-description">
                    ${escapar(turma.descricao || "Sem descrição.")}
                </p>

                <div class="class-meta">
                    ${Number(turma.total_atividades)} atividade(s)
                </div>

                <div class="class-actions">
                    <button
                        class="btn btn-primary"
                        data-abrir="${Number(turma.id)}">
                        Atividades
                    </button>

                    <button
                        class="btn delete-button"
                        data-excluir="${Number(turma.id)}"
                        data-nome="${escapar(turma.nome)}">
                        Excluir
                    </button>
                </div>
            </article>
        `).join("");

        $("classGrid").classList.toggle(
            "hidden",
            turmas.length === 0
        );

        $("emptyClasses").classList.toggle(
            "hidden",
            turmas.length > 0
        );

        $("dashboardView").classList.remove("hidden");
        $("activitiesView").classList.add("hidden");

        $("pageTitle").textContent = "Minhas turmas";

    } catch (erro) {
        mensagem(erro.message);
    }
}

// BOTÕES DE TURMA
$("classGrid").addEventListener("click", async event => {
    const abrir = event.target.closest("[data-abrir]");
    const excluir = event.target.closest("[data-excluir]");

    if (abrir) {
        try {
            const turmas = await requisicao("/turmas");

            const turma = turmas.find(
                item => Number(item.id) === Number(abrir.dataset.abrir)
            );

            if (turma) {
                await abrirAtividades(turma);
            }
        } catch (erro) {
            mensagem(erro.message);
        }
    }

    if (excluir) {
        const nome = excluir.dataset.nome;

        const confirmou = confirm(
            `Deseja excluir a turma "${nome}" e todas as atividades dela?`
        );

        if (!confirmou) return;

        try {
            await requisicao(
                `/turmas/${excluir.dataset.excluir}`,
                { method: "DELETE" }
            );

            mensagem("Turma excluída com sucesso!");

            await listarTurmas();

        } catch (erro) {
            mensagem(erro.message);
        }
    }
});

// ABRIR ATIVIDADES DE UMA TURMA
async function abrirAtividades(turma) {
    turmaAtual = turma;

    $("dashboardView").classList.add("hidden");
    $("activitiesView").classList.remove("hidden");

    $("pageTitle").textContent = "Atividades da turma";
    $("activitiesClassName").textContent = turma.nome;

    $("activitiesClassDescription").textContent =
        turma.descricao || "Gerencie as atividades desta turma.";

    fecharFormularioAtividade();

    await listarAtividades();
}

// VOLTAR ÀS TURMAS
$("backToClasses").addEventListener("click", listarTurmas);
$("navTurmas").addEventListener("click", listarTurmas);

// FORMULÁRIO DE ATIVIDADE
$("openActivityForm").addEventListener("click", () => {
    $("activityError").textContent = "";
    $("activityForm").classList.remove("hidden");
    $("activityTitle").focus();
});

function fecharFormularioAtividade() {
    $("activityForm").reset();
    $("activityForm").classList.add("hidden");
    $("activityError").textContent = "";
}

$("cancelActivity").addEventListener(
    "click",
    fecharFormularioAtividade
);

// CADASTRAR ATIVIDADE
$("activityForm").addEventListener("submit", async event => {
    event.preventDefault();

    if (!turmaAtual) return;

    $("activityError").textContent = "";

    try {
        await requisicao(
            `/turmas/${turmaAtual.id}/atividades`,
            {
                method: "POST",
                body: JSON.stringify({
                    titulo: $("activityTitle").value.trim(),
                    descricao: $("activityDescription").value.trim(),
                    data_entrega: $("activityDate").value || null,
                    status: $("activityStatus").value
                })
            }
        );

        fecharFormularioAtividade();

        mensagem("Atividade cadastrada com sucesso!");

        await listarAtividades();

    } catch (erro) {
        $("activityError").textContent = erro.message;
    }
});

// FORMATAR DATA
function formatarData(data) {
    if (!data) return "Sem data de entrega";

    const partes = String(data).slice(0, 10).split("-");

    return `Entrega: ${partes[2]}/${partes[1]}/${partes[0]}`;
}

// LISTAR ATIVIDADES
async function listarAtividades() {
    if (!turmaAtual) return;

    try {
        const resultado = await requisicao(
            `/turmas/${turmaAtual.id}/atividades`
        );

        $("activitiesClassName").textContent = resultado.turma.nome;

        const atividades = resultado.atividades;

        $("activityList").innerHTML = atividades.map(atividade => {
            let classeStatus = "status-pendente";

            if (atividade.status === "Em andamento") {
                classeStatus = "status-andamento";
            }

            if (atividade.status === "Concluída") {
                classeStatus = "status-concluida";
            }

            return `
                <article class="activity-card">
                    <div>
                        <h3>${escapar(atividade.titulo)}</h3>

                        <p>${escapar(
                            atividade.descricao || "Sem descrição."
                        )}</p>

                        <div class="activity-date">
                            ${formatarData(atividade.data_entrega)}
                        </div>
                    </div>

                    <span class="status ${classeStatus}">
                        ${escapar(atividade.status)}
                    </span>
                </article>
            `;
        }).join("");

        $("activityList").classList.toggle(
            "hidden",
            atividades.length === 0
        );

        $("emptyActivities").classList.toggle(
            "hidden",
            atividades.length > 0
        );

    } catch (erro) {
        mensagem(erro.message);
    }
}

// LOGOUT
$("logoutBtn").addEventListener("click", () => sair());
$("topLogoutBtn").addEventListener("click", () => sair());

// INICIALIZAR SISTEMA
iniciar();