Atualização do **Tempo** para Windows x64: linha do tempo mais simples, preservando a contabilização.

### O que mudou

- Trocas de tela com duração inferior a cinco minutos ficam dentro de blocos expansíveis, sem uma linha principal para cada troca.
- Uma tela diferente usada por cinco minutos ou mais abre outro bloco. O retorno à mesma janela após consultas curtas permanece no bloco anterior.
- Exemplo: Eberick por 30 min → navegador por 2 min → Eberick por 20 min aparece como um bloco de 52 min. Nos totais, continuam sendo **50 min no Eberick e 2 min no navegador**, com suas categorias e projetos originais.
- Abra os detalhes para consultar e editar um intervalo específico, ou marque **Mostrar todos os intervalos** para ver o histórico completo.
- Pausas, ausência, lacunas de coleta e mudanças de dia continuam separadas. Um bloco com projetos diferentes é identificado como **Vários projetos**.
- O agrupamento só altera a visualização. Dashboard, árvore de categorias, projetos e CSV continuam usando os registros individuais, sem arredondar ou transferir tempo entre atividades.

### Como atualizar a versão instalada

1. No ícone da bandeja do Windows, escolha **Encerrar Tempo**. Fechar apenas a janela mantém o coletor em execução.
2. Baixe e execute **Tempo-0.1.1-windows-x64-setup.exe**, usando o mesmo usuário e local da instalação anterior. Se o assistente oferecer a escolha, é possível instalar sem desinstalar primeiro.
3. Abra o Tempo novamente. Esta versão mantém o identificador do aplicativo, o caminho do banco SQLite e o formato dos dados, preservando histórico, projetos, regras e preferências. Não selecione uma opção de apagar dados caso use o desinstalador.

Não é necessário desinstalar manualmente a versão anterior. Alterar regras, categorias, projetos ou preferências no próprio aplicativo tem efeito imediato e não exige outro instalador. Ainda não há atualizador automático; mudanças no programa são distribuídas por um novo instalador. Para a distribuição portátil, encerre o programa e substitua os arquivos extraídos, mantendo `tempo.exe` e `WebView2Loader.dll` juntos.

### Validação e distribuição

Passaram 16 testes unitários da interface, incluindo limiar exato de cinco minutos, totais por categoria/software/projeto, pausas, lacunas e meia-noite, além de 6 fluxos de navegador com edição dos detalhes. O núcleo SQLite continua com 11 testes. Interface e executável Windows foram compilados para produção; instalador NSIS e ZIP portátil têm checksums publicados.

Esta distribuição continua sendo uma prévia sem assinatura de código, compilada a partir de Linux. Instalação e atualização em um Windows real, captura de janelas, áudio e notificações ainda exigem os ensaios de `docs/VALIDACAO-WINDOWS.md`. Não há mudança no coletor nesta atualização.
