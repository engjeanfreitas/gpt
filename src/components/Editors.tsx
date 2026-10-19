import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Clock3,
  Coffee,
  FolderKanban,
  Pencil,
  Play,
  Plus,
  Save,
  Trash2,
} from 'lucide-react';
import { categoryPath, duration, formatDuration, matchesRule } from '../lib/engine';
import { COLORS } from '../lib/defaults';
import { Field, Modal, AppIcon } from './ui';
import type { ClassifiedEvent, Configuration, Project, Rule } from '../lib/types';

export function ProjectEditor({
  project,
  onSave,
  onClose,
}: {
  project?: Project;
  onSave: (project: Project) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(project?.name ?? '');
  const [client, setClient] = useState(project?.client ?? '');
  const [budget, setBudget] = useState(
    project?.budgetMinutes ? String(project.budgetMinutes / 60) : '',
  );
  const [apps, setApps] = useState(project?.apps.join(', ') ?? '');
  const [color, setColor] = useState(project?.color ?? COLORS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError('');
    try {
      await onSave({
        id: project?.id ?? crypto.randomUUID(),
        name: name.trim(),
        client: client.trim(),
        budgetMinutes: budget ? Math.round(Number(budget) * 60) : null,
        apps: apps
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean),
        color,
        archived: project?.archived ?? false,
      });
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={project ? 'Editar projeto' : 'Um novo projeto'}
      subtitle="Reúna o tempo das suas atividades em um só lugar."
      onClose={onClose}
    >
      <form onSubmit={submit}>
        <Field label="Nome do projeto">
          <input
            required
            autoFocus
            maxLength={100}
            placeholder="Ex.: Estrutural TFLM"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Cliente ou descrição">
          <input
            maxLength={120}
            placeholder="Ex.: Projeto estrutural residencial"
            value={client}
            onChange={(e) => setClient(e.target.value)}
          />
        </Field>
        <Field
          label="Estimativa de horas (opcional)"
          hint="Uma referência de planejamento. O tempo registrado não será limitado."
        >
          <input
            type="number"
            min="0.25"
            max="100000"
            step="0.25"
            placeholder="Ex.: 40"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          />
        </Field>
        <Field
          label="Softwares da sessão"
          hint="Ao selecionar este projeto, somente estes softwares recebem o vínculo automático. Separe por vírgula."
        >
          <input
            placeholder="eberick.exe, excel.exe"
            value={apps}
            onChange={(e) => setApps(e.target.value)}
          />
        </Field>
        <div className="field">
          <span>Cor do projeto</span>
          <div className="color-options">
            {COLORS.map((c) => (
              <button
                type="button"
                key={c}
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
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <button type="button" className="button button-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="button button-primary" disabled={busy}>
            <Save size={15} />
            {busy ? 'Salvando…' : 'Salvar projeto'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function PauseEditor({
  presets,
  onPause,
  onClose,
}: {
  presets: number[];
  onPause: (minutes: number | null) => Promise<void>;
  onClose: () => void;
}) {
  const [minutes, setMinutes] = useState('15');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pause = async (value: number | null) => {
    setBusy(true);
    try {
      await onPause(value);
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title="Hora de respirar"
      subtitle="Durante a pausa, o tempo não será atribuído aos projetos."
      onClose={onClose}
    >
      <div className="pause-illustration">
        <Coffee size={35} strokeWidth={1.4} />
        <span>Uma pausa também faz parte.</span>
      </div>
      <div className="pause-presets">
        {presets.map((n) => (
          <button
            key={n}
            className="button button-secondary"
            disabled={busy}
            onClick={() => void pause(n)}
          >
            {n}
            <small>minutos</small>
          </button>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void pause(Number(minutes));
        }}
      >
        <Field label="Outra duração (minutos)">
          <div className="inline-input">
            <input
              type="number"
              required
              min="0.05"
              max="1440"
              step="0.05"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
            <button className="button button-primary" disabled={busy}>
              <Play size={15} />
              Iniciar pausa
            </button>
          </div>
        </Field>
      </form>
      <button
        className="text-link pause-indefinite"
        disabled={busy}
        onClick={() => void pause(null)}
      >
        Pausar até eu voltar <ArrowRight size={14} />
      </button>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <p className="modal-note">
        <Clock3 size={14} />O aviso aparece ao terminar. Você escolhe quando continuar.
      </p>
    </Modal>
  );
}
export function RuleEditor({
  rule,
  config,
  examples,
  onSave,
  onClose,
}: {
  rule?: Rule;
  config: Configuration;
  examples: ClassifiedEvent[];
  onSave: (rule: Rule, newActivity?: { name: string; categoryId: string | null }) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(rule?.name ?? '');
  const [app, setApp] = useState(rule?.app ?? '');
  const [title, setTitle] = useState(rule?.titleContains ?? '');
  const [domain, setDomain] = useState(rule?.domain ?? '');
  const [priority, setPriority] = useState(rule?.priority ?? 30);
  const [activityId, setActivityId] = useState(rule?.activityId ?? '');
  const [projectId, setProjectId] = useState(rule?.projectId ?? '');
  const [activityName, setActivityName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const draft: Rule = {
    id: rule?.id ?? 'preview',
    name,
    enabled: rule?.enabled ?? true,
    priority,
    app: app.trim(),
    titleContains: title.trim(),
    domain: domain.trim().toLowerCase(),
    activityId: activityId === '__new' ? null : activityId || null,
    projectId: projectId || null,
  };
  const matching = examples.filter((e) => e.kind === 'active' && matchesRule(e, draft));
  const conflicts = matching.filter((e) =>
    config.rules.some(
      (r) =>
        r.id !== rule?.id &&
        r.priority === priority &&
        matchesRule(e, r) &&
        ((r.activityId && draft.activityId && r.activityId !== draft.activityId) ||
          (r.projectId && draft.projectId && r.projectId !== draft.projectId)),
    ),
  );
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!app.trim() && !title.trim() && !domain.trim()) {
      setError('Informe ao menos uma condição para reconhecer a atividade.');
      return;
    }
    if (!activityId && !projectId) {
      setError('Escolha uma atividade ou um projeto.');
      return;
    }
    setBusy(true);
    try {
      await onSave(
        {
          ...draft,
          id: rule?.id && rule.id !== 'preview' ? rule.id : crypto.randomUUID(),
          name: name.trim(),
        },
        activityId === '__new'
          ? { name: activityName.trim(), categoryId: categoryId || null }
          : undefined,
      );
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={rule && rule.id !== 'preview' ? 'Editar regra' : 'Criar regra'}
      subtitle="Todas as condições preenchidas devem ser atendidas."
      onClose={onClose}
      wide
    >
      <form onSubmit={submit}>
        <Field label="Nome da regra">
          <input
            required
            maxLength={100}
            placeholder="Ex.: Reconhecer projeto TFLM"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <div className="form-two">
          <Field label="Software (executável exato)">
            <input placeholder="eberick.exe" value={app} onChange={(e) => setApp(e.target.value)} />
          </Field>
          <Field label="Título da janela contém">
            <input placeholder="TFLM" value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
        </div>
        <div className="form-two">
          <Field
            label="Domínio exato (opcional)"
            hint="Só corresponde a dados com domínio. O coletor básico usa software e título."
          >
            <input
              placeholder="docs.python.org"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
            />
          </Field>
          <Field
            label="Prioridade"
            hint="O maior número vence. Padrões usam prioridade negativa; novas regras começam em 30."
          >
            <input
              type="number"
              required
              min="-1000"
              max="1000"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
            />
          </Field>
        </div>
        <div className="form-two">
          <Field label="Atribuir atividade">
            <select value={activityId} onChange={(e) => setActivityId(e.target.value)}>
              <option value="">Manter atividade das outras regras</option>
              {config.activities.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
              <option value="__new">+ Criar nova atividade</option>
            </select>
          </Field>
          <Field label="Atribuir projeto">
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              <option value="">Manter projeto do contexto</option>
              {config.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {activityId === '__new' && (
          <div className="inset-panel form-two">
            <Field label="Nome da nova atividade">
              <input
                required
                value={activityName}
                onChange={(e) => setActivityName(e.target.value)}
              />
            </Field>
            <Field label="Categoria">
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                <option value="">Sem categoria</option>
                {config.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {categoryPath(c.id, config.categories)
                      .map((c) => c.name)
                      .join(' › ')}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}
        <div className="rule-preview">
          <span className="eyebrow">PRÉVIA NO HISTÓRICO DISPONÍVEL</span>
          <strong>
            {formatDuration(duration(matching))}
            <small>em {matching.length} intervalos</small>
          </strong>
          {matching.slice(0, 2).map((e) => (
            <p key={e.id}>
              {e.app} · {e.title}
            </p>
          ))}
          {!matching.length && <p>Nenhum registro corresponde a esta combinação.</p>}
          {!!conflicts.length && (
            <p className="warning-line">
              <AlertTriangle size={14} />
              {conflicts.length} intervalos têm regras conflitantes com a mesma prioridade.
            </p>
          )}
        </div>
        <p className="modal-note">
          A regra será aplicada ao histórico disponível e aos próximos registros. Correções manuais
          continuam tendo prioridade.
        </p>
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
            <Check size={15} />
            {busy ? 'Salvando…' : 'Salvar regra'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function EventEditor({
  events,
  config,
  onSave,
  onRule,
  onClose,
}: {
  events: ClassifiedEvent[];
  config: Configuration;
  onSave: (config: Configuration) => Promise<void>;
  onRule: (rule: Rule) => void;
  onClose: () => void;
}) {
  const sameProject = new Set(events.map((e) => e.projectId)).size === 1;
  const sameActivity = new Set(events.map((e) => e.activityId)).size === 1;
  const sameApp = new Set(events.map((e) => e.app)).size === 1;
  const [projectId, setProjectId] = useState(sameProject ? (events[0].projectId ?? '') : '__keep');
  const [activityId, setActivityId] = useState(
    sameActivity ? (events[0].activityId ?? '') : '__keep',
  );
  const [renameActivity, setRenameActivity] = useState('');
  const [renameSoftware, setRenameSoftware] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [projectTouched, setProjectTouched] = useState(false);
  const [activityTouched, setActivityTouched] = useState(false);
  const [activityCategory, setActivityCategory] = useState(
    config.activities.find((a) => a.id === events[0].activityId)?.categoryId ?? '',
  );
  const [softwareCategory, setSoftwareCategory] = useState(
    config.softwares.find((s) => s.executable.toLowerCase() === events[0].app.toLowerCase())
      ?.categoryId ?? '',
  );
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [softwareCategoryTouched, setSoftwareCategoryTouched] = useState(false);
  const first = events[0];
  const matched = config.rules.filter((r) => first.matchedRules.includes(r.id));
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const next = structuredClone(config);
    for (const event of events) {
      next.assignments[event.id] = {
        ...next.assignments[event.id],
        ...(projectTouched && projectId !== '__keep' ? { projectId: projectId || null } : {}),
        ...(activityTouched && activityId !== '__keep' ? { activityId: activityId || null } : {}),
      };
    }
    if (renameActivity.trim() && activityId && activityId !== '__keep') {
      const activity = next.activities.find((a) => a.id === activityId);
      if (activity) activity.name = renameActivity.trim();
    }
    if (categoryTouched && activityId && activityId !== '__keep') {
      const activity = next.activities.find((a) => a.id === activityId);
      if (activity) activity.categoryId = activityCategory || null;
    }
    if (sameApp && (renameSoftware.trim() || softwareCategoryTouched)) {
      const software = next.softwares.find(
        (s) => s.executable.toLowerCase() === first.app.toLowerCase(),
      );
      if (software) {
        if (renameSoftware.trim()) software.name = renameSoftware.trim();
        if (softwareCategoryTouched) software.categoryId = softwareCategory || null;
      } else
        next.softwares.push({
          executable: first.app,
          name: renameSoftware.trim() || first.softwareName,
          categoryId: softwareCategory || null,
        });
    }
    try {
      await onSave(next);
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title="Organizar seu tempo"
      subtitle={`${events.length} intervalos selecionados · ${formatDuration(duration(events))}`}
      onClose={onClose}
      wide
    >
      <form onSubmit={save}>
        <div className="event-context">
          <AppIcon app={first.app} />
          <div>
            <strong>{sameApp ? first.softwareName : 'Vários softwares'}</strong>
            <p>
              {events.length === 1
                ? first.title
                : `${events.length} registros. A atribuição será aplicada a todos os selecionados.`}
            </p>
          </div>
        </div>
        <div className="form-two">
          <Field label="Projeto">
            <select
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setProjectTouched(true);
              }}
            >
              <option value="__keep">Manter cada projeto</option>
              <option value="">Sem projeto</option>
              {config.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Atividade">
            <select
              value={activityId}
              onChange={(e) => {
                setActivityId(e.target.value);
                setActivityTouched(true);
                setActivityCategory(
                  config.activities.find((a) => a.id === e.target.value)?.categoryId ?? '',
                );
                setCategoryTouched(false);
                setRenameActivity('');
              }}
            >
              <option value="__keep">Manter cada atividade</option>
              <option value="">Sem classificação</option>
              {config.activities.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {!!activityId && activityId !== '__keep' && (
          <Field
            label="Renomear esta atividade (opcional)"
            hint="Altera o nome em todos os relatórios, preservando os vínculos."
          >
            <input
              placeholder={config.activities.find((a) => a.id === activityId)?.name}
              value={renameActivity}
              onChange={(e) => setRenameActivity(e.target.value)}
            />
          </Field>
        )}
        {sameApp && (
          <Field
            label="Nome amigável do software (opcional)"
            hint="Muda a apresentação do software em todo o histórico."
          >
            <input
              placeholder={first.softwareName}
              value={renameSoftware}
              onChange={(e) => setRenameSoftware(e.target.value)}
            />
          </Field>
        )}
        <div className="form-two">
          {!!activityId && activityId !== '__keep' && (
            <Field label="Categoria desta atividade" hint="Move a atividade em todo o histórico.">
              <select
                value={activityCategory}
                onChange={(e) => {
                  setActivityCategory(e.target.value);
                  setCategoryTouched(true);
                }}
              >
                <option value="">Sem categoria</option>
                {config.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {categoryPath(c.id, config.categories)
                      .map((c) => c.name)
                      .join(' › ')}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {sameApp && (
            <Field
              label="Categoria padrão do software"
              hint="Usada quando a atividade não tem categoria."
            >
              <select
                value={softwareCategory}
                onChange={(e) => {
                  setSoftwareCategory(e.target.value);
                  setSoftwareCategoryTouched(true);
                }}
              >
                <option value="">Sem categoria</option>
                {config.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {categoryPath(c.id, config.categories)
                      .map((c) => c.name)
                      .join(' › ')}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
        <div className="inset-panel">
          <span className="eyebrow">POR QUE ESTE REGISTRO FOI CLASSIFICADO?</span>
          {matched.length ? (
            matched.map((r) => (
              <p key={r.id} className="matched-rule">
                <Check size={14} />
                {r.name}
                <small>prioridade {r.priority}</small>
              </p>
            ))
          ) : (
            <p>Contexto do projeto, configuração do software ou atribuição manual.</p>
          )}
          <p className="muted small">
            Atividade e projeto são resolvidos separadamente. A correção manual tem prioridade.
          </p>
        </div>
        <button
          type="button"
          className="text-link create-from-event"
          onClick={() =>
            onRule({
              id: 'preview',
              name: '',
              enabled: true,
              priority: 40,
              app: sameApp ? first.app : '',
              titleContains: '',
              domain: '',
              activityId: sameActivity ? first.activityId : null,
              projectId: sameProject ? first.projectId : null,
            })
          }
        >
          <Plus size={15} />
          Criar regra para os próximos registros
        </button>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <button type="button" className="button button-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button className="button button-primary" disabled={busy}>
            <Check size={15} />
            {busy ? 'Salvando…' : 'Aplicar aos intervalos'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
