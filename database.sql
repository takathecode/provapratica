CREATE DATABASE IF NOT EXISTS sistema_professor
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE sistema_professor;

CREATE TABLE IF NOT EXISTS professores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(120) NOT NULL,
    email VARCHAR(180) NOT NULL UNIQUE,
    senha_hash VARCHAR(255) NOT NULL,
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS turmas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    professor_id INT NOT NULL,
    nome VARCHAR(100) NOT NULL,
    descricao VARCHAR(255),
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (professor_id)
        REFERENCES professores(id)
        ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS atividades (
    id INT AUTO_INCREMENT PRIMARY KEY,
    turma_id INT NOT NULL,
    titulo VARCHAR(150) NOT NULL,
    descricao TEXT,
    data_entrega DATE,
    status ENUM(
        'Pendente',
        'Em andamento',
        'Concluída'
    ) NOT NULL DEFAULT 'Pendente',
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (turma_id)
        REFERENCES turmas(id)
        ON DELETE CASCADE
);