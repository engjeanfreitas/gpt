# Ausência automática (AFK)

O Tempo consulta o tempo desde a última entrada de mouse ou teclado da sessão do Windows, usando `GetLastInputInfo`, a cada segundo. Não lê o conteúdo digitado nem usa capturas de tela. O monitoramento continua com o dashboard fechado.

## Limite recomendado

O padrão é **3 minutos**, configurável entre **1 e 60 minutos** em Preferências → **Detectar AFK após**. Três minutos evitam que pequenas paradas para pensar ou consultar um documento se tornem ausências frequentes, sem deixar cinco ou dez minutos de uma saída sempre associados ao software aberto. O valor coincide com o padrão do watcher AFK do ActivityWatch consultado na [pesquisa](PESQUISA-E-PROPOSTA.md).

Para leitura prolongada, vídeos, reuniões ou apresentações, aumente para 5–10 minutos, conforme seu uso. Ausência de entrada não comprova ausência de trabalho; esta versão não detecta atenção, reuniões ou reprodução de mídia. A pausa manual continua disponível e tem precedência sobre a detecção AFK.

## Como o tempo é contado

- Antes do limite, a tolerância continua sendo tempo ativo. Se você voltar antes, não aparece uma ausência.
- Ao atingir o limite, os próximos segundos entram como ausência, fora das categorias e projetos de trabalho. Não há retroação ao instante da última entrada.
- Uma nova entrada de mouse ou teclado retoma a coleta automaticamente, sem exigir **Continuar**. O projeto selecionado é mantido.
- Bloquear a tela interrompe o tempo ativo imediatamente, independentemente do limite.
- Pausa manual, ausência e lacunas de coleta não somam duas vezes. Uma janela que não pode ser consultada é uma lacuna, não uma ausência presumida; o tempo de entrada da sessão permite detectar AFK independentemente da permissão para consultar essa janela.

Por exemplo, com limite de 3 minutos, uma saída de 10 minutos sem entrada conta aproximadamente 3 minutos de tolerância ativa e 7 minutos de AFK. A consulta por segundo e o limite entre observações afetam a resolução; suspensão e falhas de coleta permanecem como lacunas, sem inventar atividade.

## Identificação na interface

O cabeçalho e o tooltip da bandeja mostram **AFK / ausente**, **Tela bloqueada**, **Coleta ativa**, pausa ou espera de sinal de coleta. Na timeline e nos totais, a ausência aparece como **AFK / ausente ou tela bloqueada**: registros históricos de ausência e bloqueio compartilham o tipo `idle`, preservando o esquema do banco existente.

A ausência fica separada dos blocos de trocas rápidas inferiores a cinco minutos. O limite de AFK e o agrupamento visual da timeline são independentes.
