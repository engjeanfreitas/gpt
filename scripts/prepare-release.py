"""Package a signed Tauri Windows NSIS build. Never reads the private signing key."""
import argparse
import base64
from datetime import datetime, timezone
from hashlib import sha256
import json
from pathlib import Path
import shutil
from zipfile import ZipFile, ZIP_DEFLATED

parser = argparse.ArgumentParser()
parser.add_argument('--native-dir', required=True, type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
version = json.loads((root / 'package.json').read_text())['version']
config = json.loads((root / 'src-tauri/tauri.conf.json').read_text())
assert config['version'] == version
assert config['plugins']['updater']['requireSignedVersion'] is True
native = args.native_dir.resolve()
source = native / f'bundle/nsis/Tempo_{version}_x64-setup.exe'
signature = Path(str(source) + '.sig').read_text().strip()
trusted = base64.b64decode(signature).decode().splitlines()[2]
assert f'\tversion:{version}' in trusted, 'Signature must bind the application version'
out = root / 'downloads' / f'v{version}'
out.mkdir(parents=True, exist_ok=True)
installer = out / f'Tempo-{version}-windows-x64-setup.exe'
shutil.copyfile(source, installer)
Path(str(installer) + '.sig').write_text(signature + '\n')
notes = (root / f'docs/RELEASE-NOTES-v{version}.md').read_text()
manifest = {
    'version': version,
    'notes': notes,
    'pub_date': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
    'platforms': {'windows-x86_64': {
        'signature': signature,
        'url': f'https://github.com/engjeanfreitas/gpt/releases/download/v{version}/{installer.name}',
    }},
}
(out / 'latest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
portable = out / f'Tempo-{version}-windows-x64-portable.zip'
with ZipFile(portable, 'w', compression=ZIP_DEFLATED, compresslevel=9) as archive:
    for name in ['tempo.exe', 'WebView2Loader.dll']:
        archive.write(native / name, f'Tempo/{name}')
    archive.writestr('Tempo/LEIA-ME.txt', f'''Tempo {version} — versão de teste para Windows x64

Extraia todos os arquivos e execute tempo.exe. Mantenha WebView2Loader.dll ao lado.
Requer Windows 10/11 e Microsoft Edge WebView2 Runtime.

Para usar atualizações integradas, use o instalador do Windows. A atualização
pelo app executa esse instalador e reabre a cópia instalada; o executável
portátil antigo permanece na pasta em que foi extraído.
Para atualizar somente a pasta portátil, encerre o Tempo pela bandeja e
substitua os arquivos extraídos pelo ZIP da nova versão.

Os dados ficam em %LOCALAPPDATA%\\com.tempo.desktop\\tempo.sqlite.
Fechar somente a janela mantém o coletor em segundo plano.
Consulte NOTAS-DA-VERSAO.md, AFK.md e VALIDACAO-WINDOWS.md.

Distribuição de teste sem assinatura de código Authenticode. A assinatura
das atualizações é independente e verificada pelo Tempo. Captura e instalação
ainda precisam de validação em um Windows real.
''')
    for name in ['AFK.md', 'VALIDACAO-WINDOWS.md']:
        archive.write(root / 'docs' / name, f'Tempo/{name}')
    archive.writestr('Tempo/NOTAS-DA-VERSAO.md', notes)
files = [installer, Path(str(installer) + '.sig'), portable, out / 'latest.json']
(out / 'SHA256SUMS.txt').write_text(''.join(f'{sha256(path.read_bytes()).hexdigest()}  {path.name}\n' for path in files))
for path in files:
    print(f'{path.name}: {path.stat().st_size} bytes')
