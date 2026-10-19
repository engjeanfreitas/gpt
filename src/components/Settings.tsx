import { useEffect, useState } from 'react';
import { Bell, Check, FolderTree, Play, Plus, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { categoryPath, isInCategory } from '../lib/engine';
import { COLORS } from '../lib/defaults';
import { Field, Modal } from './ui';
import { playAlarm, unlockAudio } from '../lib/alarm';
import * as service from '../lib/service';
import { Updates } from './Updates';
import type { Category, Configuration, Settings as Preferences } from '../lib/types';

export function Settings({
  config,
  onSave,
  onDelete,
  notify,
}: {
  config: Configuration;
  onSave: (c: Configuration) => Promise<void>;
  onDelete: () => void;
  notify: (message: string, error?: boolean) => void;
}) {
  const [settings, setSettings] = useState<Preferences>(structuredClone(config.settings));
  const [presets, setPresets] = useState(config.settings.pausePresets.join(', '));
  const [privacyApps, setPrivacyApps] = useState(config.settings.privacyApps.join(', '));
  const [privacyTitles, setPrivacyTitles] = useState(config.settings.privacyTitles.join('\n'));
  const [autostart, setAutostart] = useState(false);
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState<Category | 'new' | null>(null);
  useEffect(() => {
    void service
      .getAutostart()
      .then(setAutostart)
      .catch((e) => notify(String(e), true));
  }, []);
  const set = <K extends keyof Preferences>(key: K, value: Preferences[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const values = [
      ...new Set(
        presets
          .split(',')
          .map((v) => Number(v.trim()))
          .filter((n) => Number.isFinite(n) && n > 0 && n <= 1440),
      ),
    ].slice(0, 6);
    if (!values.length) {
      notify('Informe ao menos uma duração de pausa entre 1 e 1440 minutos.', true);
      return;
    }
    setBusy(true);
    try {
      await onSave({
        ...config,
        settings: {
          ...settings,
          pausePresets: values,
          privacyApps: privacyApps
            .split(',')
            .map((v) => v.trim().toLowerCase())
            .filter(Boolean),
          privacyTitles: privacyTitles
            .split('\n')
            .map((v) => v.trim())
            .filter(Boolean),
        },
      });
    } catch (e) {
      notify(String(e), true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="settings-layout">
      <form onSubmit={save} className="settings-form">
        <section className="card settings-section">
          <div className="card-heading">
            <div>
              <h2>Seu jeito de fazer uma pausa</h2>
              <p>Configure o contador e o aviso de término.</p>
            </div>
            <Bell size={19} className="muted" />
          </div>
          <Field label="Durações favoritas, em minutos">
            <input
              value={presets}
              onChange={(e) => setPresets(e.target.value)}
              placeholder="5, 10, 15, 30"
            />
          </Field>
          <div className="form-two">
            <Field label="Som do alarme">
              <select
                value={settings.alarmSound}
                onChange={(e) => set('alarmSound', e.target.value as Preferences['alarmSound'])}
              >
                <option value="soft">Toque suave</option>
                <option value="bell">Campainha</option>
                <option value="none">Silencioso</option>
              </select>
            </Field>
            <Field label={`Volume: ${settings.alarmVolume}%`}>
              <input
                aria-label="Volume do alarme"
                type="range"
                min="0"
                max="100"
                value={settings.alarmVolume}
                onChange={(e) => set('alarmVolume', Number(e.target.value))}
              />
            </Field>
          </div>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => {
              unlockAudio();
              playAlarm(settings);
            }}
          >
            <Play size={14} />
            Testar este som
          </button>
          <label className="toggle-row">
            <span>
              <strong>Retomar automaticamente</strong>
              <small>
                Ao terminar o contador, retomar a coleta se houver atividade. Desativado: aguardar
                “Continuar”.
              </small>
            </span>
            <input
              type="checkbox"
              checked={settings.autoResume}
              onChange={(e) => set('autoResume', e.target.checked)}
            />
          </label>
          {!service.isDesktop && (
            <p className="inline-notice">
              Na demonstração, mantenha a página aberta para receber o aviso. O app Windows mantém o
              contador com o dashboard fechado.
            </p>
          )}
          {!service.isDesktop && (
            <button
              type="button"
              className="text-link"
              onClick={async () => {
                if (!('Notification' in window)) {
                  notify('Este navegador não oferece notificações.', true);
                  return;
                }
                const permission = await Notification.requestPermission();
                notify(
                  permission === 'granted'
                    ? 'Notificações do navegador ativadas.'
                    : 'Use o aviso na interface ou ajuste a permissão no navegador.',
                );
              }}
            >
              Ativar notificações do navegador
            </button>
          )}
        </section>
        <section className="card settings-section">
          <div className="card-heading">
            <div>
              <h2>Captura e privacidade</h2>
              <p>O histórico permanece no seu dispositivo.</p>
            </div>
            <ShieldCheck size={19} className="muted" />
          </div>
          <Field
            label="Detectar AFK após (minutos sem mouse ou teclado)"
            hint="Recomendado: 3 minutos. Ao atingir o limite, a ausência deixa de somar tempo ativo; os minutos de tolerância anteriores continuam ativos. A coleta volta automaticamente com mouse ou teclado. Tela bloqueada interrompe a atividade imediatamente. Para leitura ou reuniões, aumente o limite."
          >
            <input
              type="number"
              min="1"
              max="60"
              step="1"
              required
              value={settings.idleSeconds / 60}
              onChange={(e) => set('idleSeconds', Number(e.target.value) * 60)}
            />
          </Field>
          <Field
            label="Não registrar estes softwares"
            hint="Executáveis exatos, separados por vírgula. A exclusão vale antes de gravar os próximos registros."
          >
            <input
              value={privacyApps}
              onChange={(e) => setPrivacyApps(e.target.value)}
              placeholder="keepass.exe, 1password.exe"
            />
          </Field>
          <Field
            label="Não registrar títulos contendo"
            hint="Uma expressão de texto por linha. O histórico existente pode ser apagado na área abaixo."
          >
            <textarea
              rows={3}
              value={privacyTitles}
              onChange={(e) => setPrivacyTitles(e.target.value)}
              placeholder="Banco pessoal"
            />
          </Field>
          <Field
            label="Manter histórico por (dias)"
            hint="Registros mais antigos são removidos na manutenção do app Windows. Exporte antes de reduzir o prazo."
          >
            <input
              type="number"
              required
              min="1"
              max="3650"
              value={settings.retentionDays}
              onChange={(e) => set('retentionDays', Number(e.target.value))}
            />
          </Field>
          <label className="toggle-row">
            <span>
              <strong>Iniciar com o Windows</strong>
              <small>
                {service.isDesktop
                  ? 'O coletor começa na bandeja, sem abrir o dashboard.'
                  : 'Disponível no aplicativo instalado.'}
              </small>
            </span>
            <input
              type="checkbox"
              checked={autostart}
              disabled={!service.isDesktop}
              onChange={async (e) => {
                const checked = e.target.checked;
                try {
                  await service.setAutostart(checked);
                  setAutostart(checked);
                  notify('Inicialização atualizada.');
                } catch (e) {
                  notify(String(e), true);
                }
              }}
            />
          </label>
        </section>
        <div className="settings-actions">
          <span>As alterações são salvas somente neste dispositivo.</span>
          <button className="button button-primary" disabled={busy}>
            <Save size={15} />
            {busy ? 'Salvando…' : 'Salvar preferências'}
          </button>
        </div>
      </form>
      <aside className="settings-aside">
        <Updates />
        <section className="card settings-section">
          <div className="card-heading">
            <div>
              <h2>Sua árvore de categorias</h2>
              <p>Renomeie e reorganize os agrupamentos.</p>
            </div>
            <FolderTree size={18} className="muted" />
          </div>
          <div className="category-settings">
            {config.categories.map((c) => (
              <button key={c.id} onClick={() => setCategory(c)}>
                <span className="category-dot" style={{ background: c.color }} />
                <span>
                  {categoryPath(c.id, config.categories)
                    .map((c) => c.name)
                    .join(' › ')}
                </span>
                <span className="text-link">Editar</span>
              </button>
            ))}
          </div>
          <button className="button button-secondary" onClick={() => setCategory('new')}>
            <Plus size={14} />
            Nova categoria
          </button>
        </section>
        <section className="card settings-section data-settings">
          <h2>Seus dados, sob seu controle</h2>
          <p>Guarde uma cópia local do banco e das configurações.</p>
          <button
            className="button button-secondary"
            onClick={() =>
              void service
                .createBackup()
                .then((path) => notify(`Backup salvo: ${path}`))
                .catch((e) => notify(String(e), true))
            }
          >
            <Save size={14} />
            Salvar backup local
          </button>
          <p>
            Apague somente o período selecionado no cabeçalho. Essa operação não pode ser desfeita.
            Backups e exportações existentes permanecem separados.
          </p>
          <button className="button button-danger" onClick={onDelete}>
            <Trash2 size={14} />
            Apagar período
          </button>
        </section>
      </aside>
      {category && (
        <CategoryEditor
          category={category === 'new' ? undefined : category}
          config={config}
          onClose={() => setCategory(null)}
          onSave={onSave}
        />
      )}
    </div>
  );
}
function CategoryEditor({
  category,
  config,
  onClose,
  onSave,
}: {
  category?: Category;
  config: Configuration;
  onClose: () => void;
  onSave: (config: Configuration) => Promise<void>;
}) {
  const [name, setName] = useState(category?.name ?? '');
  const [parentId, setParentId] = useState(category?.parentId ?? '');
  const [color, setColor] = useState(category?.color ?? COLORS[0]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={category ? 'Editar categoria' : 'Nova categoria'} onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const next = structuredClone(config);
          const item = {
            id: category?.id ?? crypto.randomUUID(),
            name: name.trim(),
            parentId: parentId || null,
            color,
          };
          if (category) next.categories = next.categories.map((c) => (c.id === item.id ? item : c));
          else next.categories.push(item);
          try {
            await onSave(next);
            onClose();
          } catch (e) {
            setError(String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Nome">
          <input required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Categoria pai">
          <select value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">Nível principal</option>
            {config.categories
              .filter((c) => !category || !isInCategory(c.id, category.id, config.categories))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {categoryPath(c.id, config.categories)
                    .map((c) => c.name)
                    .join(' › ')}
                </option>
              ))}
          </select>
        </Field>
        <div className="field">
          <span>Cor</span>
          <div className="color-options">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                style={{ background: c }}
                aria-label={`Cor ${c}`}
                aria-pressed={color === c}
                onClick={() => setColor(c)}
              >
                {color === c && <Check size={16} />}
              </button>
            ))}
          </div>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <button type="button" className="button button-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="button button-primary" disabled={busy}>
            <Save size={14} />
            Salvar categoria
          </button>
        </div>
      </form>
    </Modal>
  );
}
