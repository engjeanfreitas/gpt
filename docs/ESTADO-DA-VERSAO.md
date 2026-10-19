# Tempo 0.1.0 — estado da primeira versão

Implementação disponível no repositório, com distribuição de teste para Windows x64.

| Verificação executada nesta instância Linux | Resultado |
|---|---|
| Classificação, regras, recorte de períodos, reagrupamento e CSV (Vitest) | 7 testes aprovados |
| SQLite, pausa, recuperação, exclusões, contexto de projeto e integridade dos intervalos (Rust) | 11 testes aprovados |
| Projetos, atribuição de 3h do TFLM, regras, pausa com vencimento e layout móvel (Chromium/Playwright) | 5 testes aprovados |
| TypeScript e build de produção da interface | Aprovados |
| Clippy do núcleo Rust e do alvo Windows completo, sem warnings | Aprovados |
| Compilação de produção para `x86_64-pc-windows-gnu` | Executável gerado |
| Empacotamento NSIS a partir de Linux | Instalador gerado; payload inclui `WebView2Loader.dll` |
| Integridade do arquivo ZIP portátil | Verificada |

O instalador mede aproximadamente 3,04 MiB. Isso é tamanho em disco, não consumo de RAM. CPU, memória e comportamento do coletor precisam ser medidos no Windows.

As distribuições estão em `artifacts/`, diretório de saída ignorado pelo Git:

- `Tempo-0.1.0-windows-x64-setup.exe`
- `Tempo-0.1.0-windows-x64-portable.zip`
- `SHA256SUMS.txt`

A distribuição portátil inclui executável, loader do WebView2 e instruções. O instalador detecta o WebView2 e pode baixar seu runtime da Microsoft caso necessário. Ambos são distribuições de teste sem assinatura de código.

Não foi executado um Windows real nesta instância. Portanto, captura de janelas do Eberick, áudio físico, notificações do sistema, bloqueio/suspensão, instalação e inicialização no login **ainda precisam dos ensaios em [VALIDACAO-WINDOWS.md](VALIDACAO-WINDOWS.md)**. A compilação e os testes de simulação não substituem essa validação.

O aplicativo desktop começa sem dados de exemplo; a interface de navegador é uma demonstração identificada e não monitora o computador. Extensão de navegador, importação de histórico de terceiros, divisão manual de intervalos e vigência de regras por data ficam para próximas versões, conforme os limites registrados no README.
