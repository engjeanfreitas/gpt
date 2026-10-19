import { useEffect, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { version } from '../../package.json';
import { Modal } from './ui';
import * as service from '../lib/service';

export function Updates() {
  const [info, setInfo] = useState<service.UpdateInfo | null>(null);
  const [phase, setPhase] = useState<'ready' | 'checking' | 'downloading' | 'installing'>('ready');
  const [progress, setProgress] = useState<service.UpdateProgress | null>(null);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  const busy = phase !== 'ready';
  useEffect(() => {
    if (!service.isDesktop) return;
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void import('@tauri-apps/api/event')
      .then(({ listen }) =>
        listen<service.UpdateProgress>('update-progress', ({ payload }) => {
          setProgress(payload);
          setPhase(payload.phase);
        }),
      )
      .then((fn) => {
        if (cancelled) fn();
        else unlisten = fn;
      })
      .catch(() => {
        /* The command still reports completion or failure. */
      });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);
  const check = async () => {
    setPhase('checking');
    setInfo(null);
    setError('');
    try {
      setInfo(await service.checkForUpdates());
    } catch (e) {
      setError(String(e));
    } finally {
      setPhase('ready');
    }
  };
  const install = async () => {
    setConfirm(false);
    setError('');
    setProgress(null);
    setPhase('downloading');
    try {
      await service.installUpdate();
      setPhase('installing');
    } catch (e) {
      setError(String(e));
      setInfo(null);
      setPhase('ready');
    }
  };
  const percent = progress?.total
    ? Math.min(100, Math.floor((progress.downloaded / progress.total) * 100))
    : undefined;
  return (
    <section className="card settings-section update-settings" aria-busy={busy}>
      <div className="card-heading">
        <div>
          <h2>Atualizações</h2>
          <p>Versão instalada: {info?.currentVersion ?? version}</p>
        </div>
        <RefreshCw size={18} className="muted" />
      </div>
      {!service.isDesktop ? (
        <p>Disponível no aplicativo Windows instalado.</p>
      ) : (
        <>
          <p>
            Verifique e instale novas versões por aqui. O Tempo salva um backup e reinicia para
            concluir a atualização.
          </p>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => void check()}
            disabled={busy}
          >
            <RefreshCw size={14} />
            {phase === 'checking' ? 'Verificando…' : 'Verificar atualizações'}
          </button>
          {info && !info.availableVersion && (
            <p role="status">Você está usando a versão mais recente.</p>
          )}
          {info?.availableVersion && (
            <div className="update-available">
              <strong>Versão {info.availableVersion} disponível</strong>
              {info.notes && <p className="update-notes">{info.notes}</p>}
              <button
                type="button"
                className="button button-primary"
                disabled={busy}
                onClick={() => setConfirm(true)}
              >
                <Download size={14} />
                Baixar e instalar
              </button>
            </div>
          )}
          {(phase === 'downloading' || phase === 'installing') && (
            <div role="status" className="update-progress">
              <p>
                {phase === 'installing'
                  ? 'Iniciando o instalador. O Tempo será fechado…'
                  : `Baixando atualização${percent === undefined ? '…' : `: ${percent}%`}`}
              </p>
              {phase === 'downloading' && (
                <progress max={100} value={percent} aria-label="Download da atualização" />
              )}
            </div>
          )}
          {error && (
            <p className="update-error" role="alert">
              {error}
            </p>
          )}
        </>
      )}
      {confirm && (
        <Modal title="Atualizar o Tempo?" onClose={() => setConfirm(false)}>
          <p>
            O Tempo baixará a versão {info?.availableVersion}, verificará sua assinatura, salvará um
            backup dos dados e abrirá o instalador do Windows. A coleta será interrompida durante a
            instalação e o aplicativo será reaberto ao concluir.
          </p>
          <div className="modal-footer">
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setConfirm(false)}
            >
              Cancelar
            </button>
            <button type="button" className="button button-primary" onClick={() => void install()}>
              Atualizar agora
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
