# Atualizações pelo aplicativo

## Uso

O botão está em Preferências → Atualizações, a partir da versão 0.1.3. A consulta é manual, sem verificação ou download periódico em segundo plano. O aplicativo continua funcionando sem internet. Para adicionar esse recurso às versões anteriores, instale manualmente uma vez a versão mais recente (0.1.3 ou posterior).

O fluxo consulta a versão disponível, mostra as notas, pede confirmação, baixa o instalador, valida a assinatura com a chave pública embutida e verifica a versão assinada. Antes de iniciar o NSIS, finaliza o intervalo pendente e cria backup SQLite em `backups/antes-atualizacao-<versão>-<instante>.sqlite`. Novas observações são suspensas após o backup e o instalador reabre o Tempo ao terminar. Falhas anteriores à instalação mantêm a instalação atual; é possível verificar novamente e tentar outra vez.

Os dados continuam em `%LOCALAPPDATA%\com.tempo.desktop\tempo.sqlite`. O esquema não muda nesta versão. O backup guarda o histórico concluído, configurações e estado persistido de pausa/projeto. Não há rollback automático de binário ou banco nesta versão.

O recurso usa o instalador do Windows. Na cópia portátil, ele instala/reabre a cópia padrão e não substitui o executável portátil original. Quem preferir permanecer portátil deve substituir os arquivos extraídos manualmente. O Windows pode solicitar autorização conforme as permissões da instalação.

## Assinatura e publicação

O plugin oficial `tauri-plugin-updater` verifica a assinatura Minisign do instalador. `requireSignedVersion` está ativado: o número de versão do manifesto deve corresponder à versão no comentário autenticado da assinatura. Não são aceitos downgrades pela comparação padrão do plugin. TLS e validação de certificados permanecem ativos. O renderer não fornece URL, chave ou argumentos de instalação aos comandos; a origem e a chave são configuradas no código nativo.

Essa assinatura é independente de Authenticode. O instalador continua sem certificado de assinatura de código do Windows.

A chave privada de publicação está **fora do repositório**, no ambiente de trabalho em `/workspace/.tempo-secrets/updater.key`, com acesso restrito ao proprietário; a configuração contém somente a chave pública. Não publique a chave privada em commits, releases, logs ou respostas de chat. O mantenedor precisa guardá-la em armazenamento privado persistente antes de descartar este ambiente. Se a chave for perdida, as instalações existentes não aceitarão atualizações assinadas por outra chave: será necessária uma instalação manual para trocar a chave de confiança. Não gere uma chave nova por rotina de build.

O pipeline atual publica artefatos já compilados e assinados, sem precisar da chave privada no GitHub. Para automatizar futuramente a compilação de releases no GitHub, armazene a mesma chave em um Secret do repositório chamado `TAURI_SIGNING_PRIVATE_KEY`; não a coloque no YAML ou no checkout. O workflow de validação gera instalador sem artefatos de atualização, identificado como **validation-only**, e não publica esse instalador como release.

### Preparar uma versão

1. Atualize a versão em package.json, package-lock.json, Cargo.toml, Cargo.lock e tauri.conf.json e escreva as notas da versão.
2. Para compilar e empacotar uma release, disponibilize a chave privada e a senha para o Tauri pela variável `TAURI_SIGNING_PRIVATE_KEY` (conteúdo ou caminho absoluto aceito pelo CLI) e `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. Este ambiente usa a chave local já existente, com senha vazia e arquivo de acesso restrito. Nunca imprima esses valores.
3. Execute o build e bundle NSIS com `createUpdaterArtifacts: true`. O CLI gera o instalador e `.sig`, incluindo a versão assinada. Ao assinar manualmente, use `tauri signer sign --app-version <versão>` com a mesma chave.
4. Execute `python3 scripts/prepare-release.py --native-dir <diretório release do alvo Windows>`. O script prepara instalador, assinatura, ZIP, manifesto e checksums em `downloads/v<versão>/`.
5. Execute os testes, incluindo `cargo test --manifest-path src-tauri/Cargo.toml --test update_signature --locked`, para verificar a assinatura do instalador real e a rejeição de um arquivo alterado.
6. Publique o commit e a tag `v<versão>`. O workflow cria a prévia com todos os arquivos e só então atualiza `updates/windows-x64.json` em `main`. O feed é servido por HTTPS pelo domínio raw.githubusercontent.com. A serialização de releases e a comparação das versões impedem que uma publicação antiga substitua um feed mais novo. Depois da publicação, sincronize o checkout local com o commit do bot.

Não republique bytes diferentes para uma versão existente. Use um novo número de versão. Nunca desative a verificação de assinatura ou certificado para contornar uma falha de atualização.

## Validação pendente no Windows

Os testes de navegador simulam IPC; não executam o instalador. Os testes de assinatura verificam os bytes do instalador distribuído usando o mesmo verificador Minisign do plugin. Ainda é necessário ensaiar uma atualização real entre duas versões assinadas, incluindo permissões do Windows, antivírus, reabertura na bandeja, pausa em andamento e preservação de histórico/projetos. Consulte VALIDACAO-WINDOWS.md.
