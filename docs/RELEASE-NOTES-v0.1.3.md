**Tempo 0.1.3 — gráfico com cores distintas e botão de atualização dentro do aplicativo.** Inclui também AFK e a linha do tempo simplificada das versões anteriores.

### Gráfico com cores por destino do tempo

O gráfico **O ritmo do seu dia** agora usa barras verticais empilhadas, com faixas nas mesmas cores da árvore **Para onde foi seu tempo?**. O agrupamento escolhido — Atividade, Software ou Projeto — também controla o gráfico e a legenda. Passe o mouse sobre uma faixa para consultar sua duração.

Na visão de atividade, cada intervalo entra na sua categoria específica; o tempo dos pais não é somado novamente. Pausa e AFK têm cores próprias, separadas das horas de trabalho. A paleta padrão anterior foi substituída por cores mais distintas nas categorias e projetos que a utilizavam; cores fora da paleta anterior são preservadas. Os testes verificam os totais em todos os agrupamentos e nas transições de hora/dia.

### Como usar o botão de atualização

Abra **Preferências → Atualizações → Verificar atualizações**. Quando houver uma versão mais recente, o Tempo mostra a versão e as notas; escolha **Baixar e instalar** e confirme **Atualizar agora**.

O download tem indicador de progresso. O aplicativo valida a assinatura do instalador e a versão assinada, salva um backup local, encerra a coleta e abre o instalador do Windows em modo de atualização. O Tempo é reaberto ao concluir. O Windows ainda pode pedir autorização para a instalação, conforme as permissões locais.

A coleta continua durante o download. Falha de rede ou assinatura inválida não inicia instalação. A atualização requer internet; coleta, histórico e projetos continuam locais. A verificação é feita somente quando você clica no botão.

### Uma instalação manual inicial

As versões 0.1.0–0.1.2 ainda não possuem esse botão. Encerre o Tempo pela bandeja e execute **Tempo-0.1.3-windows-x64-setup.exe** uma vez, com o mesmo usuário e local da instalação anterior. Não é preciso desinstalar manualmente ou excluir dados. As próximas versões assinadas poderão ser instaladas pelo botão.

Os dados mantêm o mesmo identificador, caminho e esquema SQLite. Backups automáticos anteriores à atualização ficam na subpasta `backups` do diretório de dados. Para uso portátil, o botão abre o instalador e passa a usar a cópia instalada; a pasta portátil antiga não é substituída. Para permanecer portátil, substitua os arquivos pelo ZIP da nova versão com o aplicativo encerrado.

### Verificação e limites

Passaram 20 testes unitários da interface, 15 testes do núcleo Rust, 2 testes da assinatura do instalador publicado e 9 fluxos de navegador. Os testes do botão cobrem confirmação/cancelamento, progresso, falta de conexão, falha de instalação simulada e consulta sem nova versão. O instalador foi compilado para Windows a partir de Linux; o fluxo completo de atualização, reinício e entrada real do Windows ainda precisa de validação em um computador Windows.

As atualizações são assinadas para verificação pelo Tempo. Isso é independente da assinatura de código Authenticode: a distribuição de teste continua sem certificado de reputação para o Windows, que pode mostrar avisos ao executar o instalador.
