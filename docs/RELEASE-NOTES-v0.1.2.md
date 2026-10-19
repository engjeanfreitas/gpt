**Tempo 0.1.2 — identificação de AFK**, incluindo o agrupamento da linha do tempo publicado na 0.1.1.

### Ausência automática

- Indicação **AFK / ausente** no cabeçalho e na bandeja, distinta de tela bloqueada, pausa manual e espera de sinal de coleta.
- Padrão de **3 minutos sem mouse ou teclado**, configurável entre 1 e 60 minutos nas preferências. O detector já existia; esta atualização explicita o estado e melhora sua integração.
- Ao atingir o limite, a ausência deixa de contar nas atividades e projetos. Os minutos anteriores de tolerância continuam ativos, sem retroação. Ao usar mouse ou teclado, a coleta retoma automaticamente.
- Tela bloqueada interrompe o tempo ativo imediatamente. Pausa manual tem prioridade e não se sobrepõe a AFK.
- Detecção de entrada da sessão antes da leitura da janela em primeiro plano: AFK funciona mesmo quando o processo dessa janela não permite leitura. Durante AFK, o coletor evita ler o título da janela.
- Timeline e dashboard identificam o tempo de ausência como AFK / tela bloqueada, fora do total ativo. Registros antigos permanecem compatíveis.

Três minutos são um ponto inicial; para leitura prolongada ou reuniões, aumente o limite. O [guia de AFK](https://github.com/engjeanfreitas/gpt/blob/main/docs/AFK.md) detalha a contabilização e seus limites.

### Como atualizar

Encerre o Tempo pelo menu da bandeja e execute **Tempo-0.1.2-windows-x64-setup.exe** no mesmo usuário e local de instalação. Não precisa desinstalar manualmente. O identificador, o esquema SQLite e o caminho dos dados permanecem iguais, preservando histórico, projetos, regras e preferências. Não selecione exclusão dos dados se usar o desinstalador. Não há atualizador automático; ajustes nas preferências não exigem reinstalação.

Também há ZIP portátil com `tempo.exe` e `WebView2Loader.dll`; extraia todos os arquivos. Os checksums estão em `SHA256SUMS.txt`.

### Validação

16 testes unitários da interface, 14 testes do núcleo Rust e 7 fluxos de navegador aprovados. Os casos novos verificam o limite exato de AFK, retorno de entrada, ausência sem título/projeto, conservação das durações, prioridade da pausa e indicador/configuração via IPC simulado. Build de produção e Clippy para Windows aprovados.

Distribuição de teste sem assinatura de código, compilada a partir de Linux. Entrada real do Windows, instalação/atualização, coleta, áudio e notificações ainda exigem os ensaios de `docs/VALIDACAO-WINDOWS.md`; simulação não substitui validação no desktop real.
