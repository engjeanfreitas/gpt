**Tempo 0.1.4 — categorias e regras padrão para organizar seu tempo automaticamente.**

### Categorias e regras comuns

Inclui 114 novas regras editáveis inspiradas nos padrões do ActivityWatch, adaptadas ao Windows e às categorias existentes do Tempo:

- **Trabalho:** programação, documentos e escritório, imagem e design, edição de vídeo e áudio, modelagem 3D, desenho técnico/BIM, mensagens/e-mail e reuniões.
- **Estudo:** pesquisa e referências.
- **Pessoal:** vídeos, música, jogos e redes sociais.

Há regras para aplicativos como VS Code, Word, LibreOffice, GIMP, Inkscape, Blender, AutoCAD, Revit, Teams, Zoom, WhatsApp, Thunderbird, Spotify, VLC, Minecraft e RimWorld. Chrome, Edge, Firefox, Brave e Opera recebem regras para títulos reconhecidos de sites como GitHub, YouTube, Netflix, Gmail, Instagram e Wikipedia/Wikipédia.

As condições de sites exigem o navegador e o trecho do título; o coletor básico não lê a URL. Títulos podem ser ambíguos ou mudar. Navegação sem título reconhecido permanece sem classificação automática. Mensagens e reuniões começam em Trabalho, como uma convenção que pode ser alterada.

### Busca, edição e prioridades

Em **Regras e atividades**, busque por software, atividade, categoria ou projeto. Você pode renomear, editar ou desativar qualquer regra.

Os novos padrões usam prioridade baixa (−100 para software e −90 para títulos no navegador). Suas regras existentes mantêm as prioridades e prevalecem sobre esses padrões; novas regras criadas pela interface começam em 30. Correções manuais continuam tendo prioridade. Nenhum padrão atribui projetos automaticamente. As regras anteriores de Eberick, Excel e Outlook são mantidas.

### Cores das categorias

Trabalho passa a usar verde como cor padrão e Estudo usa azul. Atividades e subcategorias herdam a cor da categoria principal; alterar essa cor atualiza toda a sua árvore e o gráfico por atividade. A legenda reúne os descendentes na categoria principal sem contar tempo duas vezes. Nos agrupamentos por software ou projeto, cada grupo principal mantém sua própria cor.

### Seus dados e como atualizar

Os novos itens são acrescentados uma única vez na abertura. Configurações já editadas são preservadas por identificador; padrões desativados ou removidos depois da migração não reaparecem ao reiniciar. A troca de cores só substitui os antigos valores padrão correspondentes, uma vez. O histórico, seus intervalos, projetos e atribuições não são apagados. A classificação dos relatórios é recalculada sobre os registros existentes.

Se já usa **0.1.3**, abra **Preferências → Atualizações → Verificar atualizações**, escolha **Baixar e instalar** e confirme. O Tempo verifica a assinatura e salva um backup local antes da instalação. Se usa uma versão anterior, encerre o Tempo pela bandeja e execute **Tempo-0.1.4-windows-x64-setup.exe** com o mesmo usuário e local de instalação, sem desinstalar ou excluir dados. Para permanecer portátil, substitua os arquivos extraídos pelo ZIP com o aplicativo encerrado.

### Validação

Validado com 25 testes unitários da interface, 17 testes do núcleo Rust, 11 fluxos de navegador, compilação da interface e análise estática do núcleo. A assinatura do instalador é verificada com a chave pública já utilizada nas instalações anteriores, incluindo um teste de rejeição de arquivo alterado.

O instalador é compilado para Windows a partir de Linux. Captura real, áudio e a atualização completa com reinício ainda precisam de validação em um Windows real. A assinatura das atualizações é independente de Authenticode; esta distribuição de teste permanece sem certificado de reputação do Windows.
