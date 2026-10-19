Primeira versão de teste do **Tempo**, rastreador pessoal de tempo para Windows x64.

### Baixar

- **Tempo-0.1.0-windows-x64-setup.exe**: instalador recomendado, aproximadamente 3 MB.
- **Tempo-0.1.0-windows-x64-portable.zip**: versão portátil; extraia todos os arquivos e execute `tempo.exe`, mantendo `WebView2Loader.dll` na mesma pasta.
- **SHA256SUMS.txt**: checksums dos arquivos publicados.

Requer Windows 10/11 e WebView2 Runtime. O instalador pode obter o runtime da Microsoft se necessário.

### Recursos

- Dashboard e árvore por atividade, software e projeto, com detalhes dos títulos das janelas.
- Projetos com estimativa de horas, seleção do projeto atual e atribuição de intervalos anteriores.
- Regras, nomes amigáveis, categorias, filtros, timeline e exportação CSV.
- Pausa configurável com contador, aviso visual, alarme sonoro e prorrogação.
- Coletor Windows, bandeja, armazenamento local SQLite e início no login configurável.

Para começar, crie o projeto **TFLM**, informe `eberick.exe` nos softwares da sessão e selecione o projeto atual. Uma regra por nome de projeto depende de esse nome aparecer no título da janela.

### Estado da validação

Passaram 7 testes de classificação, 11 testes do núcleo Rust e 5 fluxos de navegador, além do build de produção e Clippy. O executável Windows e o instalador NSIS foram gerados a partir de Linux.

**Esta é uma prévia sem assinatura de código.** Instalação, captura real do Eberick, áudio, notificações, bloqueio/suspensão e início no login ainda precisam de validação em um Windows real. O Windows pode exibir um aviso sobre um aplicativo não reconhecido. CPU e RAM ainda não foram medidos.

O desktop começa sem dados de exemplo; a versão de navegador é uma demonstração identificada. Ainda não há extensão de navegador, importação de histórico de terceiros ou sincronização. Consulte o README e `docs/VALIDACAO-WINDOWS.md`.
