require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error("Configure JWT_SECRET no arquivo .env.");
    process.exit(1);
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const db = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "sistema_professor",
    waitForConnections: true,
    connectionLimit: 10
});

// Middleware para autenticar o professor
function autenticar(req, res, next) {
    const autorizacao = req.headers.authorization;

    if (!autorizacao || !autorizacao.startsWith("Bearer ")) {
        return res.status(401).json({
            erro: "Você precisa fazer login."
        });
    }

    const token = autorizacao.split(" ")[1];

    try {
        req.professor = jwt.verify(token, JWT_SECRET);
        next();
    } catch (erro) {
        return res.status(401).json({
            erro: "Sessão inválida. Faça login novamente."
        });
    }
}

// Cria o professor de demonstração automaticamente
async function criarProfessorDemo() {
    const email = "professor@escola.com";

    const [professores] = await db.execute(
        "SELECT id FROM professores WHERE email = ?",
        [email]
    );

    if (professores.length === 0) {
        const senhaHash = await bcrypt.hash("Professor@123", 10);

        await db.execute(
            `INSERT INTO professores (nome, email, senha_hash)
             VALUES (?, ?, ?)`,
            ["Professor Demonstração", email, senhaHash]
        );

        console.log("Professor de demonstração criado.");
    }
}

// Verifica se a API está funcionando
app.get("/api/health", (req, res) => {
    res.json({ mensagem: "API funcionando!" });
});

// LOGIN
app.post("/api/login", async (req, res) => {
    try {
        const email = String(req.body.email || "").trim().toLowerCase();
        const senha = String(req.body.senha || "");

        if (!email || !senha) {
            return res.status(400).json({
                erro: "Preencha o e-mail e a senha."
            });
        }

        const [professores] = await db.execute(
            "SELECT * FROM professores WHERE email = ?",
            [email]
        );

        if (
            professores.length === 0 ||
            !(await bcrypt.compare(senha, professores[0].senha_hash))
        ) {
            return res.status(401).json({
                erro: "E-mail ou senha incorretos."
            });
        }

        const professor = professores[0];

        const token = jwt.sign(
            {
                id: professor.id,
                nome: professor.nome,
                email: professor.email
            },
            JWT_SECRET,
            { expiresIn: "8h" }
        );

        res.json({
            token,
            professor: {
                id: professor.id,
                nome: professor.nome,
                email: professor.email
            }
        });
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: "Erro ao realizar login." });
    }
});

// CONSULTA OS DADOS DO PROFESSOR LOGADO
app.get("/api/perfil", autenticar, async (req, res) => {
    res.json({ professor: req.professor });
});

// LISTAR TURMAS DO PROFESSOR
app.get("/api/turmas", autenticar, async (req, res) => {
    try {
        const [turmas] = await db.execute(
            `SELECT t.id, t.nome, t.descricao, t.criado_em,
                (SELECT COUNT(*) FROM atividades a
                 WHERE a.turma_id = t.id) AS total_atividades
             FROM turmas t
             WHERE t.professor_id = ?
             ORDER BY t.id DESC`,
            [req.professor.id]
        );

        res.json(turmas);
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: "Erro ao listar turmas." });
    }
});

// CADASTRAR TURMA
app.post("/api/turmas", autenticar, async (req, res) => {
    try {
        const nome = String(req.body.nome || "").trim();
        const descricao = String(req.body.descricao || "").trim();

        if (!nome) {
            return res.status(400).json({
                erro: "O nome da turma é obrigatório."
            });
        }

        if (nome.length > 100 || descricao.length > 255) {
            return res.status(400).json({
                erro: "Confira o limite de caracteres dos campos."
            });
        }

        const [resultado] = await db.execute(
            `INSERT INTO turmas (professor_id, nome, descricao)
             VALUES (?, ?, ?)`,
            [req.professor.id, nome, descricao || null]
        );

        res.status(201).json({
            mensagem: "Turma cadastrada com sucesso!",
            id: resultado.insertId
        });
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: "Erro ao cadastrar turma." });
    }
});

// EXCLUIR TURMA DO PROFESSOR LOGADO
app.delete("/api/turmas/:id", autenticar, async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id < 1) {
            return res.status(400).json({ erro: "ID inválido." });
        }

        const [resultado] = await db.execute(
            `DELETE FROM turmas
             WHERE id = ? AND professor_id = ?`,
            [id, req.professor.id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                erro: "Turma não encontrada."
            });
        }

        res.json({ mensagem: "Turma excluída com sucesso!" });
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ erro: "Erro ao excluir turma." });
    }
});

// LISTAR ATIVIDADES DE UMA TURMA
app.get(
    "/api/turmas/:id/atividades",
    autenticar,
    async (req, res) => {
        try {
            const turmaId = Number(req.params.id);

            const [turmas] = await db.execute(
                `SELECT id, nome, descricao
                 FROM turmas
                 WHERE id = ? AND professor_id = ?`,
                [turmaId, req.professor.id]
            );

            if (turmas.length === 0) {
                return res.status(404).json({
                    erro: "Turma não encontrada."
                });
            }

            const [atividades] = await db.execute(
                `SELECT id, titulo, descricao, data_entrega, status
                 FROM atividades
                 WHERE turma_id = ?
                 ORDER BY data_entrega IS NULL, data_entrega ASC, id DESC`,
                [turmaId]
            );

            res.json({
                turma: turmas[0],
                atividades
            });
        } catch (erro) {
            console.error(erro);
            res.status(500).json({
                erro: "Erro ao listar atividades."
            });
        }
    }
);

// CADASTRAR ATIVIDADE
app.post(
    "/api/turmas/:id/atividades",
    autenticar,
    async (req, res) => {
        try {
            const turmaId = Number(req.params.id);
            const titulo = String(req.body.titulo || "").trim();
            const descricao = String(req.body.descricao || "").trim();
            const dataEntrega = req.body.data_entrega || null;
            const status = req.body.status || "Pendente";

            if (!titulo) {
                return res.status(400).json({
                    erro: "O título da atividade é obrigatório."
                });
            }

            if (titulo.length > 150) {
                return res.status(400).json({
                    erro: "O título deve ter até 150 caracteres."
                });
            }

            if (
                !["Pendente", "Em andamento", "Concluída"].includes(status)
            ) {
                return res.status(400).json({
                    erro: "Status inválido."
                });
            }

            if (
                dataEntrega &&
                !/^\d{4}-\d{2}-\d{2}$/.test(dataEntrega)
            ) {
                return res.status(400).json({
                    erro: "Data de entrega inválida."
                });
            }

            const [turmas] = await db.execute(
                `SELECT id FROM turmas
                 WHERE id = ? AND professor_id = ?`,
                [turmaId, req.professor.id]
            );

            if (turmas.length === 0) {
                return res.status(404).json({
                    erro: "Turma não encontrada."
                });
            }

            const [resultado] = await db.execute(
                `INSERT INTO atividades
                 (turma_id, titulo, descricao, data_entrega, status)
                 VALUES (?, ?, ?, ?, ?)`,
                [
                    turmaId,
                    titulo,
                    descricao || null,
                    dataEntrega,
                    status
                ]
            );

            res.status(201).json({
                mensagem: "Atividade cadastrada com sucesso!",
                id: resultado.insertId
            });
        } catch (erro) {
            console.error(erro);
            res.status(500).json({
                erro: "Erro ao cadastrar atividade."
            });
        }
    }
);

// PÁGINA INICIAL
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// INICIAR SERVIDOR
async function iniciarServidor() {
    try {
        await db.query("SELECT 1");
        await criarProfessorDemo();

        app.listen(PORT, () => {
            console.log(`Sistema rodando em http://localhost:${PORT}`);
        });
    } catch (erro) {
        console.error("Não foi possível conectar ao MySQL.");
        console.error("Confira o serviço MySQL e o arquivo .env.");
        console.error(erro.message);
        process.exit(1);
    }
}

iniciarServidor();