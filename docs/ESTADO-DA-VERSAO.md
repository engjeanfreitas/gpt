# Tempo 0.1.3 — estado da versão

Implementação disponível no repositório, com distribuição de teste para Windows x64.

| Verificação executada nesta instância Linux | Resultado |
|---|---|
| Classificação, regras, recorte de períodos, timeline condensada, reagrupamento e CSV (Vitest) | 20 testes aprovados |
| SQLite, pausa, recuperação, exclusões, contexto de projeto e integridade dos intervalos (Rust) | 15 testes aprovados |
| Projetos, atribuição de 3h do TFLM, regras, pausa, layout e edição de detalhes da timeline (Chromium/Playwright) | 9 testes aprovados |
| TypeScript e build de produção da interface | Aprovados |
| Assinatura do instalador publicado e rejeição de alterações (Rust) | 2 testes aprovados |
| Clippy do núcleo Rust e do alvo Windows completo, sem warnings | Aprovados para o código atual |
| Compilação de produção para `x86_64-pc-windows-gnu` | Executável gerado |
| Empacotamento NSIS a partir de Linux | Instalador gerado; payload inclui `WebView2Loader.dll` |
| Integridade do arquivo ZIP portátil | Verificada |

O instalador mede aproximadamente 4 MiB. Isso é tamanho em disco, não consumo de RAM. CPU, memória e comportamento do coletor precisam ser medidos no Windows.

As distribuições publicadas estão em `downloads/v0.1.3/` e na Release `v0.1.3` do GitHub:

- `Tempo-0.1.3-windows-x64-setup.exe`
- `Tempo-0.1.3-windows-x64-portable.zip`
- `SHA256SUMS.txt`

A distribuição portátil inclui executável, loader do WebView2 e instruções. O instalador detecta o WebView2 e pode baixar seu runtime da Microsoft caso necessário. Ambos são distribuições de teste sem assinatura de código.

Não foi executado um Windows real nesta instância. Portanto, captura de janelas do Eberick, áudio físico, notificações do sistema, bloqueio/suspensão, instalação e inicialização no login **ainda precisam dos ensaios em [VALIDACAO-WINDOWS.md](VALIDACAO-WINDOWS.md)**. A compilação e os testes de simulação não substituem essa validação.

A 0.1.3 agrupa trocas de tela inferiores a cinco minutos somente na apresentação. Os testes verificam a preservação dos tempos exatos e da classificação por categoria, software e projeto, os limites de pausa/dia/lacuna, o limiar inclusivo de cinco minutos e a edição individual dos detalhes. A inspeção visual em Chromium confirmou o bloco expandido em desktop e em largura de 390 px sem rolagem horizontal da página.

A atualização mantém o identificador `com.tempo.desktop`, o caminho e o esquema SQLite. O assistente NSIS permite atualizar sobre a instalação existente; a preservação em uma atualização real de 0.1.0 para 0.1.3 está no roteiro de ensaios Windows. Há atualização iniciada pelo usuário nas preferências; o fluxo real de instalação/reabertura ainda depende do ensaio Windows.

A 0.1.3 também identifica AFK no cabeçalho e na bandeja, com limite padrão de três minutos configurável. A leitura de entrada da sessão antecede a consulta do processo em primeiro plano. Os testes novos cobrem transições, limite, conservação das durações e preferência persistida; o fluxo de navegador usa snapshots via IPC simulado. A ausência é contabilizada a partir do limite, sem retroação, como explicado em [AFK.md](AFK.md).

O aplicativo desktop começa sem dados de exemplo; a interface de navegador é uma demonstração identificada e não monitora o computador. Extensão de navegador, importação de histórico de terceiros, divisão manual de intervalos e vigência de regras por data ficam para próximas versões, conforme os limites registrados no README.

A 0.1.3 adiciona o plugin oficial de atualização, assinatura vinculada à versão, progresso, confirmação e backup anterior à instalação. Dois testes adicionais verificam a assinatura do instalador distribuído e a rejeição de bytes alterados. A interface cobre erros e novas tentativas por IPC simulado. A chave privada permanece fora do Git; sua preservação e o fluxo de publicação estão em [ATUALIZACOES.md](ATUALIZACOES.md).

O gráfico agora empilha categorias específicas, softwares ou projetos com as mesmas cores da árvore e da legenda, incluindo pausa/AFK separados. A paleta padrão é migrada para cores mais distintas, sem alterar durações, regras, nomes ou cores fora da paleta anterior. Foram verificados recortes por hora/dia e o layout de 390 px.
