# Documentação do EduGestor

## 1. Diagrama de caso de uso

```mermaid
flowchart TD
    P[Professor]
    L((Realizar login))
    V((Visualizar turmas))
    C((Cadastrar turma))
    E((Excluir turma))
    A((Listar atividades))
    N((Cadastrar atividade))
    S((Realizar logout))

    P --> L
    P --> V
    P --> C
    P --> E
    P --> A
    P --> N
    P --> S