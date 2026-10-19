# Ensaios no Windows

Estes ensaios são necessários antes de considerar o coletor validado em uso real. A compilação para o alvo Windows verifica código e dependências; não executa as APIs de janela, áudio e sessão.

1. Inicie o aplicativo sem administrador. Abra dois programas e alterne entre eles. Marque **Mostrar todos os intervalos** na timeline e confirme executável, título e duração; não deve haver sobreposição.
2. Crie TFLM com `eberick.exe`, selecione o projeto e trabalhe no Eberick. Depois selecione outro projeto no mesmo software. Verifique que os intervalos ficam separados e o total é preservado. Confirme antes se o nome TFLM é exposto no título para testar regras automáticas.
3. Faça uma pausa curta. Feche o dashboard pelo X. Aguarde o alarme e a notificação; confira o contador pelo tooltip da bandeja e reabra o dashboard. Sem retomada automática, a pausa deve continuar até **Continuar**.
4. Prorrogue uma pausa vencida e aguarde novamente. Deve haver um novo aviso para o novo prazo, sem repetição a cada segundo.
5. Inicie uma pausa, encerre o aplicativo e reabra antes/depois do prazo. O estado deve ser recuperado e o aviso não deve se repetir se já tiver sido registrado como emitido.
6. Teste silêncio, volume e som, considerando volume do Windows e suas configurações de notificações. Avisos do sistema podem ser bloqueados pelas preferências do dispositivo.
7. Bloqueie a sessão durante alguns minutos. Suspenda e retome o computador. O período não deve aumentar as horas ativas do projeto. Teste também iniciar o coletor numa sessão inicialmente bloqueada.
8. Configure uma exclusão por executável e outra por texto de título. Use os programas e verifique o banco/CSV: o contexto excluído não pode aparecer. Apenas um intervalo sem coleta pode ficar registrado.
9. Salve um backup, encerre o aplicativo e confira o arquivo com SQLite. Exclua um período parcial e confirme que somente os trechos dentro dele foram apagados. Backups anteriores são independentes.
10. Ative início no login, reinicie a sessão e confirme a coleta com o dashboard fechado. Desative e verifique que a entrada de inicialização foi removida.
11. Monitore o processo e todos os subprocessos WebView2 com dashboard aberto e fechado. Registre CPU, RAM e crescimento do banco numa jornada representativa, incluindo títulos dinâmicos. Não considere o objetivo de leveza validado sem esse registro.
12. Trabalhe em uma janela por mais de cinco minutos, consulte outra por menos de cinco minutos e retorne. Confirme um bloco expansível na timeline e o tempo separado por categoria/software/projeto no dashboard. Uma mudança duradoura para outra tela deve abrir outro bloco. Pausa e ausência devem continuar visíveis.
13. Na versão 0.1.0, crie projeto e regra e registre intervalos. Encerre o Tempo pela bandeja e instale 0.1.1 no mesmo local, sem excluir dados. Confirme histórico, regras, projetos e preferências, além do novo agrupamento visual. Este ensaio de atualização ainda exige um Windows real.

Anote versão do Windows, arquitetura, versão do Eberick, comportamento de títulos, configuração de ausência e resultado de cada ensaio. Sessões remotas, apps elevados/protegidos, jogos e múltiplos monitores precisam de casos próprios.
