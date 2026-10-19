# Regras automáticas padrão

O Tempo inclui 114 novas regras editáveis, inspiradas nas [categorias padrão do ActivityWatch](https://github.com/ActivityWatch/aw-webui/blob/7e3347feed8c408a84853186e2560ef526235197/src/util/classes.ts#L101). A adaptação mantém a organização que já existia no Tempo:

| Categoria | Atividades reconhecidas                                                                                                                        |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Trabalho  | Programação, documentos e escritório, imagem e design, edição de áudio e vídeo, modelagem 3D, desenho técnico/BIM, mensagens/e-mail e reuniões |
| Estudo    | Pesquisa e referências (Wikipedia/Wikipédia)                                                                                                   |
| Pessoal   | Vídeos, música, jogos e redes sociais                                                                                                          |

Exemplos: VS Code, Visual Studio, PyCharm, Word, LibreOffice, GIMP, Inkscape, Blender, AutoCAD, Revit, Teams, Zoom, Slack, WhatsApp, Thunderbird, Spotify, VLC, Minecraft e RimWorld. As regras anteriores de Eberick, Excel e Outlook continuam valendo.

Chrome, Edge, Firefox, Brave e Opera recebem regras por título para GitHub, Stack Overflow, GitLab, Google Docs/Documentos Google, YouTube, Netflix, Twitch, Spotify, Deezer, Reddit, Facebook, Instagram, Gmail e Wikipedia/Wikipédia. Elas exigem **o executável do navegador e o trecho do título**; o coletor básico não observa a URL. Títulos podem ser ambíguos ou mudar, e páginas sem correspondência continuam sem classificação automática. Não classificamos todo navegador como trabalho ou lazer, nem todo processo de jogos como uma sessão de jogo.

Mensagens e reuniões começam em Trabalho como convenção editável; uma conversa pessoal pode ser corrigida manualmente ou receber uma regra mais específica. PDFs e navegadores sem título reconhecido não recebem uma categoria presumida.

As novas regras usam prioridade −100 (software) e −90 (título no navegador). As regras existentes mantêm suas prioridades; novas regras criadas pela interface começam em 30. O maior número vence e correções manuais prevalecem. Nenhuma regra padrão atribui projeto. Todos os relatórios são recalculados sobre os intervalos originais, sem alterar tempos registrados.

O catálogo compartilhado está em `src/lib/common-defaults.json`, utilizado pelo desktop e pela demonstração. Instalações existentes recebem os novos itens uma única vez. A migração acrescenta IDs ausentes e preserva nomes, categorias, cores e regras já editados. Depois disso, desativar, editar ou remover um padrão não o recria ao reiniciar. A busca em **Regras e atividades** encontra software, condição, atividade, categoria ou projeto.

Atividades e subcategorias usam a cor da categoria principal, tanto na árvore quanto no gráfico por atividade. Trabalho começa em verde; cores personalizadas são preservadas. Ao agrupar por software ou projeto, o grupo principal conserva a cor própria desse agrupamento.
