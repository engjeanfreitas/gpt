import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Bell,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  Clock3,
  Coffee,
  Download,
  FolderKanban,
  LayoutDashboard,
  ListFilter,
  LoaderCircle,
  Pause,
  Play,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Timer,
  Trash2,
  X,
} from 'lucide-react';
import { Dashboard, Timeline } from './components/Dashboard';
import { EventEditor, PauseEditor, ProjectEditor, RuleEditor } from './components/Editors';
import { Settings } from './components/Settings';
import { CategoryBadge } from './components/CategoryBadge';
import { AppIcon, Empty, Field, Modal, Toast } from './components/ui';
import {
  categoryColor,
  categoryPath,
  classify,
  clipEvents,
  csvEscape,
  dateInput,
  duration,
  formatCountdown,
  formatDuration,
  isInCategory,
  rangeForDays,
} from './lib/engine';
import { playAlarm, unlockAudio } from './lib/alarm';
import * as service from './lib/service';
import type {
  ClassifiedEvent,
  Configuration,
  DateRange,
  GroupMode,
  Page,
  Project,
  Rule,
  Snapshot,
} from './lib/types';

const titles: Record<Page, [string, string]> = {
  dashboard: ['Seu tempo, com clareza.', 'Menos suposições. Mais espaço para o que importa.'],
  timeline: ['Cada momento, em contexto.', 'Revise seus intervalos e organize o que aconteceu.'],
  projects: ['Tempo que vira projeto.', 'Acompanhe o esforço real, do primeiro passo à entrega.'],
  rules: [
    'Organize uma vez. Entenda sempre.',
    'Regras simples mantêm seu histórico fazendo sentido.',
  ],
  settings: ['Do seu jeito.', 'Ajustes para o Tempo acompanhar o seu ritmo.'],
};
const nav: [Page, string, typeof LayoutDashboard][] = [
  ['dashboard', 'Visão geral', LayoutDashboard],
  ['timeline', 'Linha do tempo', Clock3],
  ['projects', 'Projetos', FolderKanban],
  ['rules', 'Regras e atividades', SlidersHorizontal],
  ['settings', 'Preferências', Settings2],
];

export default function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loadError, setLoadError] = useState('');
  const [page, setPage] = useState<Page>('dashboard');
  const [mode, setMode] = useState<GroupMode>('activity');
  const [period, setPeriod] = useState('1');
  const [range, setRange] = useState<DateRange>(() => rangeForDays(1));
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  const localDay = dateInput(now);
  useEffect(() => {
    if (period !== 'custom') setRange(rangeForDays(Number(period)));
  }, [localDay, period]);
  const [projectEditor, setProjectEditor] = useState<Project | 'new' | null>(null);
  const [ruleEditor, setRuleEditor] = useState<Rule | 'new' | null>(null);
  const [selected, setSelected] = useState<ClassifiedEvent[] | null>(null);
  const [pauseEditor, setPauseEditor] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const alarmId = useRef('');
  const notify = useCallback((message: string, error = false) => {
    setToast({ message, error });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);
  const refresh = useCallback(async () => {
    try {
      const data = await service.getSnapshot();
      setSnapshot(data);
      setLoadError('');
    } catch (e) {
      setLoadError(String(e));
    }
  }, []);
  useEffect(() => {
    void refresh();
    const poll = setInterval(() => void refresh(), 2000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
      clearTimeout(toastTimer.current);
    };
  }, [refresh]);
  useEffect(() => {
    if (!service.isDesktop || !snapshot) return;
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    void import('@tauri-apps/api/event')
      .then(({ listen }) =>
        listen('pause-finished', () => {
          notify('Sua pausa terminou. Hora de continuar?');
          void refresh();
        }),
      )
      .then((fn) => {
        if (cancelled) fn();
        else unlisten = fn;
      });
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [!!snapshot, notify, refresh]);
  useEffect(() => {
    const pause = snapshot?.pause;
    const deadlineId = pause ? `${pause.id}:${pause.endsAt}` : '';
    if (service.isDesktop || !pause?.notified || alarmId.current === deadlineId) return;
    alarmId.current = deadlineId;
    playAlarm(snapshot!.config.settings);
    notify('Sua pausa terminou. Hora de continuar?');
    if ('Notification' in window && Notification.permission === 'granted')
      new Notification('Tempo · Sua pausa terminou', {
        body: 'Você pode continuar ou estender a pausa.',
      });
    if (snapshot!.config.settings.autoResume)
      void service
        .resumeTracking()
        .then(refresh)
        .catch((e) => notify(String(e), true));
  }, [snapshot, notify, refresh]);
  const all = useMemo(
    () => (snapshot ? classify(snapshot.events, snapshot.config) : []),
    [snapshot],
  );
  const events = useMemo(
    () =>
      clipEvents(all, range).filter((e) => {
        if (
          projectFilter &&
          (projectFilter === '__none' ? !!e.projectId : e.projectId !== projectFilter)
        )
          return false;
        if (
          categoryFilter &&
          !isInCategory(e.categoryId, categoryFilter, snapshot!.config.categories)
        )
          return false;
        if (search) {
          const query = search.toLocaleLowerCase('pt-BR');
          if (
            ![e.title, e.softwareName, e.projectName, e.activityName].some((v) =>
              v.toLocaleLowerCase('pt-BR').includes(query),
            )
          )
            return false;
        }
        return true;
      }),
    [all, range, search, projectFilter, categoryFilter, snapshot],
  );
  const saveConfig = async (config: Configuration) => {
    await service.saveConfig(config);
    await refresh();
    notify('Alterações salvas. Seu histórico foi atualizado.');
  };
  const act = async (action: () => Promise<void>, message?: string) => {
    try {
      await action();
      await refresh();
      if (message) notify(message);
    } catch (e) {
      notify(String(e), true);
    }
  };
  const exportCSV = () => {
    const header = [
      'Início',
      'Fim',
      'Minutos',
      'Tipo',
      'Software',
      'Título',
      'Atividade',
      'Projeto',
    ];
    const lines = events.map((e) =>
      [
        new Date(e.start).toISOString(),
        new Date(e.end).toISOString(),
        ((e.end - e.start) / 60000).toFixed(2),
        e.kind,
        e.softwareName,
        e.title,
        e.activityName,
        e.projectName,
      ]
        .map(csvEscape)
        .join(';'),
    );
    service.downloadFile(
      `tempo-${dateInput(range.start)}.csv`,
      '\uFEFF' + [header.map(csvEscape).join(';'), ...lines].join('\r\n'),
      'text/csv;charset=utf-8',
    );
    notify('Relatório exportado.');
  };
  if (!snapshot)
    return (
      <div className="loading-screen">
        <span className="brand-symbol">
          t<span />
        </span>
        {loadError ? (
          <>
            <h2>Não foi possível carregar seus dados.</h2>
            <p>{loadError}</p>
            <button className="button button-primary" onClick={() => void refresh()}>
              Tentar novamente
            </button>
          </>
        ) : (
          <>
            <LoaderCircle className="spin" />
            <p>Preparando seu espaço…</p>
          </>
        )}
      </div>
    );
  const { config, pause } = snapshot;
  const paused = !!pause;
  const expired = !!pause?.endsAt && now >= pause.endsAt;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage('dashboard');
          }}
          aria-label="Tempo, visão geral"
        >
          <span className="brand-symbol">
            t<span />
          </span>
          <span>
            tempo<span className="brand-period">.</span>
          </span>
        </a>
        <span className="sidebar-label">SEU ESPAÇO</span>
        <nav>
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              className={`nav-item ${page === id ? 'nav-active' : ''}`}
              onClick={() => setPage(id)}
              aria-label={label}
              aria-current={page === id ? 'page' : undefined}
            >
              <Icon size={19} strokeWidth={1.65} />
              {label}
              {id === 'projects' && (
                <span className="nav-count">
                  {config.projects.filter((p) => !p.archived).length}
                </span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-projects">
          <div className="sidebar-label">
            PROJETO ATUAL
            <button
              className="sidebar-plus"
              onClick={() => setProjectEditor('new')}
              aria-label="Novo projeto"
            >
              <Plus size={15} />
            </button>
          </div>
          <select
            aria-label="Projeto atual"
            value={snapshot.currentProjectId ?? ''}
            onChange={(e) =>
              void act(
                () => service.setCurrentProject(e.target.value || null),
                'Projeto da sessão atualizado.',
              )
            }
          >
            <option value="">Sem projeto selecionado</option>
            {config.projects
              .filter((p) => !p.archived)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
          <p>O vínculo vale para os softwares definidos no projeto.</p>
        </div>
        <div className="sidebar-bottom">
          <div className="local-note">
            <ShieldCheck size={18} />
            <div>
              Seu tempo é seu.<span>Dados locais. Sem conta.</span>
            </div>
          </div>
          <div className="sidebar-profile">
            <span className="avatar">EU</span>
            <div>
              Meu espaço
              <small>{service.isDesktop ? 'Neste computador' : 'Demonstração interativa'}</small>
            </div>
            <span className="profile-dot" />
          </div>
        </div>
      </aside>
      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumb">
            Meu espaço <span>/</span> {nav.find((n) => n[0] === page)?.[1]}
          </div>
          <div className="topbar-right">
            <span
              className={`capture-status ${paused ? 'status-paused' : service.isDesktop && ['afk', 'locked'].includes(snapshot.trackingStatus) ? 'status-afk' : ''}`}
              role="status"
              title={
                service.isDesktop && snapshot.trackingStatus === 'afk'
                  ? 'Sem mouse ou teclado pelo limite configurado. A coleta volta automaticamente quando houver entrada.'
                  : undefined
              }
            >
              <i />
              {paused
                ? 'Em pausa'
                : service.isDesktop
                  ? snapshot.trackingStatus === 'afk'
                    ? 'AFK / ausente'
                    : snapshot.trackingStatus === 'locked'
                      ? 'Tela bloqueada'
                      : snapshot.capturing
                        ? 'Coleta ativa'
                        : 'Aguardando sinal de coleta'
                  : 'Modo demonstração'}
            </span>
            <span className="topbar-separator" />
            <span className="topbar-date">
              {new Date(now).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
            </span>
          </div>
        </header>
        <div className="page-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow greeting">
                {page === 'dashboard' ? 'UM POUCO MAIS DE PERSPECTIVA' : 'SEU TEMPO, ORGANIZADO'}
              </div>
              <h1>{titles[page][0]}</h1>
              <p>{titles[page][1]}</p>
            </div>
            <div className="heading-actions">
              <button className="button button-secondary" onClick={exportCSV}>
                <Download size={15} />
                Exportar
              </button>
              <button
                className={`button ${paused ? 'button-green' : 'button-primary'}`}
                onClick={() => {
                  unlockAudio();
                  if (paused) void act(service.resumeTracking, 'Pausa encerrada.');
                  else setPauseEditor(true);
                }}
              >
                {paused ? <Play size={15} /> : <Pause size={15} />}
                {paused ? 'Continuar' : 'Fazer uma pausa'}
              </button>
            </div>
          </div>
          {!service.isDesktop && (
            <div className="demo-banner">
              <span>
                <Sparkles size={14} />
                <strong>Explore com dados de exemplo.</strong> A captura real está disponível no
                aplicativo Windows.
              </span>
              <span className="demo-badge">DEMONSTRAÇÃO</span>
            </div>
          )}
          {(loadError || snapshot.lastError) && (
            <div className="error-banner" role="alert">
              Falha na coleta ou armazenamento: {loadError || snapshot.lastError}. Os dados
              existentes permanecem disponíveis.
            </div>
          )}
          {paused && (
            <div
              className={`pause-banner ${expired ? 'pause-expired' : ''}`}
              role={expired ? 'alert' : 'status'}
            >
              <span className="pause-banner-icon">
                {expired ? <Bell size={22} /> : <Coffee size={22} />}
              </span>
              <div>
                <strong>{expired ? 'Sua pausa terminou.' : 'Uma pausa para recarregar.'}</strong>
                <p>
                  {expired
                    ? 'Você pode continuar ou aproveitar mais alguns minutos.'
                    : 'O tempo de pausa fica separado das horas dos projetos.'}
                </p>
              </div>
              <span className="pause-counter" aria-label="Tempo restante">
                {pause.endsAt
                  ? expired
                    ? '00:00'
                    : formatCountdown(pause.endsAt - now)
                  : 'Sem prazo'}
              </span>
              <button
                className="button button-secondary"
                onClick={() =>
                  void act(() => service.extendPause(5), 'Pausa estendida em 5 minutos.')
                }
              >
                + 5 min
              </button>
              <button
                className="button button-primary"
                onClick={() => void act(service.resumeTracking, 'Pausa encerrada.')}
              >
                <Play size={14} />
                Continuar
              </button>
            </div>
          )}
          <div className="toolbar">
            <div className="toolbar-left">
              <div className="period-select">
                <CalendarDays size={15} />
                <select
                  aria-label="Período"
                  value={period}
                  onChange={(e) => {
                    setPeriod(e.target.value);
                    if (e.target.value !== 'custom') setRange(rangeForDays(Number(e.target.value)));
                  }}
                >
                  <option value="1">Hoje</option>
                  <option value="7">Últimos 7 dias</option>
                  <option value="30">Últimos 30 dias</option>
                  <option value="custom">Personalizado</option>
                </select>
                <ChevronDown size={13} />
              </div>
              <span className="period-description">
                {new Date(range.start).toLocaleDateString('pt-BR', {
                  day: 'numeric',
                  month: 'long',
                })}
                {period !== '1' &&
                  ` — ${new Date(range.end - 1).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}`}
              </span>
              {period === 'custom' && (
                <div className="custom-dates">
                  <input
                    type="date"
                    aria-label="Data inicial"
                    value={dateInput(range.start)}
                    max={dateInput(range.end - 1)}
                    onChange={(e) => {
                      if (e.target.value)
                        setRange((r) => ({
                          ...r,
                          start: new Date(e.target.value + 'T00:00:00').getTime(),
                        }));
                    }}
                  />
                  <span>até</span>
                  <input
                    type="date"
                    aria-label="Data final"
                    value={dateInput(range.end - 1)}
                    min={dateInput(range.start)}
                    onChange={(e) => {
                      if (e.target.value) {
                        const end = new Date(e.target.value + 'T00:00:00');
                        end.setDate(end.getDate() + 1);
                        setRange((r) => ({ ...r, end: end.getTime() }));
                      }
                    }}
                  />
                </div>
              )}
            </div>
            <div className="toolbar-right">
              <label className="search-field">
                <Search size={15} />
                <input
                  placeholder="Buscar atividade…"
                  aria-label="Buscar atividade"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button onClick={() => setSearch('')} aria-label="Limpar busca">
                    <X size={13} />
                  </button>
                )}
              </label>
              <button
                className={`button button-filter ${filtersOpen || projectFilter || categoryFilter ? 'filter-active' : ''}`}
                onClick={() => setFiltersOpen((v) => !v)}
                aria-expanded={filtersOpen}
              >
                <ListFilter size={15} />
                Filtros
                {(projectFilter || categoryFilter) && (
                  <span className="filter-count">
                    {Number(!!projectFilter) + Number(!!categoryFilter)}
                  </span>
                )}
              </button>
            </div>
          </div>
          {filtersOpen && (
            <div className="filter-panel">
              <Field label="Projeto">
                <select
                  aria-label="Filtrar projeto"
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                >
                  <option value="">Todos os projetos</option>
                  <option value="__none">Sem projeto</option>
                  {config.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Categoria">
                <select
                  aria-label="Filtrar categoria"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="">Todas as categorias</option>
                  {config.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {categoryPath(c.id, config.categories)
                        .map((c) => c.name)
                        .join(' › ')}
                    </option>
                  ))}
                </select>
              </Field>
              <button
                className="text-link"
                onClick={() => {
                  setProjectFilter('');
                  setCategoryFilter('');
                  setSearch('');
                }}
              >
                Limpar filtros
              </button>
            </div>
          )}
          {page === 'dashboard' && (
            <Dashboard
              events={events}
              config={config}
              range={range}
              mode={mode}
              onMode={setMode}
              onSelect={setSelected}
              onNewProject={() => setProjectEditor('new')}
              onProject={(id) => {
                setProjectFilter(id);
                setFiltersOpen(true);
                setMode('project');
              }}
            />
          )}
          {page === 'timeline' && <Timeline events={events} onSelect={setSelected} />}
          {page === 'projects' && (
            <Projects
              config={config}
              events={all}
              periodEvents={events}
              current={snapshot.currentProjectId}
              onNew={() => setProjectEditor('new')}
              onEdit={setProjectEditor}
              onSelect={(id) =>
                void act(() => service.setCurrentProject(id), 'Projeto selecionado para a sessão.')
              }
              onExplore={(id) => {
                setProjectFilter(id);
                setFiltersOpen(true);
                setMode('project');
                setPage('dashboard');
              }}
              onArchive={(p) =>
                void act(
                  () =>
                    service.saveConfig({
                      ...config,
                      projects: config.projects.map((item) =>
                        item.id === p.id ? { ...item, archived: !item.archived } : item,
                      ),
                    }),
                  p.archived
                    ? 'Projeto reativado.'
                    : 'Projeto arquivado. O histórico foi preservado.',
                )
              }
            />
          )}
          {page === 'rules' && (
            <Rules
              config={config}
              events={all}
              onNew={() => setRuleEditor('new')}
              onEdit={setRuleEditor}
              onChange={(c) => void act(() => saveConfig(c))}
            />
          )}
          {page === 'settings' && (
            <Settings
              config={config}
              onSave={saveConfig}
              onDelete={() => setDeleteOpen(true)}
              notify={notify}
            />
          )}
          <footer className="page-footer">
            <span className="footer-brand">tempo.</span>
            <span>Pequenos registros. Uma visão maior.</span>
            <span>
              <ShieldCheck size={12} />
              {service.isDesktop
                ? 'Armazenado neste computador'
                : 'Dados de exemplo salvos neste navegador'}
            </span>
          </footer>
        </div>
      </main>
      {projectEditor && (
        <ProjectEditor
          project={projectEditor === 'new' ? undefined : projectEditor}
          onClose={() => setProjectEditor(null)}
          onSave={async (project) => {
            const projects = config.projects.some((p) => p.id === project.id)
              ? config.projects.map((p) => (p.id === project.id ? project : p))
              : [...config.projects, project];
            await saveConfig({ ...config, projects });
          }}
        />
      )}
      {pauseEditor && (
        <PauseEditor
          presets={config.settings.pausePresets}
          onClose={() => setPauseEditor(false)}
          onPause={async (minutes) => {
            await service.startPause(minutes);
            await refresh();
          }}
        />
      )}
      {ruleEditor && (
        <RuleEditor
          rule={ruleEditor === 'new' ? undefined : ruleEditor}
          config={config}
          examples={all}
          onClose={() => setRuleEditor(null)}
          onSave={async (rule, activity) => {
            const next = structuredClone(config);
            if (activity) {
              const id = crypto.randomUUID();
              next.activities.push({ id, ...activity });
              rule.activityId = id;
            }
            next.rules = next.rules.some((r) => r.id === rule.id)
              ? next.rules.map((r) => (r.id === rule.id ? rule : r))
              : [...next.rules, rule];
            await saveConfig(next);
          }}
        />
      )}
      {selected && (
        <EventEditor
          events={selected}
          config={config}
          onClose={() => setSelected(null)}
          onSave={saveConfig}
          onRule={(rule) => {
            setSelected(null);
            setRuleEditor(rule);
          }}
        />
      )}
      {deleteOpen && (
        <Modal
          title="Apagar histórico do período?"
          subtitle="Esta operação não pode ser desfeita. Exporte os registros se precisar guardá-los."
          onClose={() => setDeleteOpen(false)}
        >
          <p className="delete-description">
            Serão apagados os intervalos entre{' '}
            <strong>{new Date(range.start).toLocaleDateString('pt-BR')}</strong> e{' '}
            <strong>{new Date(range.end - 1).toLocaleDateString('pt-BR')}</strong>, incluindo os que
            não aparecem nos filtros atuais.
          </p>
          <div className="modal-footer">
            <button className="button button-secondary" onClick={() => setDeleteOpen(false)}>
              Cancelar
            </button>
            <button
              className="button button-danger"
              onClick={() =>
                void act(async () => {
                  await service.deleteHistory(range.start, range.end);
                  setDeleteOpen(false);
                }, 'Histórico do período apagado.')
              }
            >
              <Trash2 size={14} />
              Apagar definitivamente
            </button>
          </div>
        </Modal>
      )}
      {toast && <Toast message={toast.message} error={toast.error} />}
    </div>
  );
}

function Projects({
  config,
  events,
  periodEvents,
  current,
  onNew,
  onEdit,
  onSelect,
  onExplore,
  onArchive,
}: {
  config: Configuration;
  events: ClassifiedEvent[];
  periodEvents: ClassifiedEvent[];
  current: string | null;
  onNew: () => void;
  onEdit: (p: Project) => void;
  onSelect: (id: string) => void;
  onExplore: (id: string) => void;
  onArchive: (p: Project) => void;
}) {
  const [showArchived, setShowArchived] = useState(false);
  const projects = config.projects.filter((p) => showArchived || !p.archived);
  return (
    <>
      <div className="section-heading">
        <p>{projects.length} projetos · O acumulado considera todo o histórico disponível.</p>
        <div className="inline-actions">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Mostrar arquivados
          </label>
          <button className="button button-primary" onClick={onNew}>
            <Plus size={15} />
            Novo projeto
          </button>
        </div>
      </div>
      {!projects.length ? (
        <section className="card">
          <Empty
            title="Todo projeto merece seu espaço"
            description="Crie seu primeiro projeto e associe o tempo dos softwares a ele."
            action={
              <button className="button button-primary" onClick={onNew}>
                <Plus size={15} />
                Criar projeto
              </button>
            }
          />
        </section>
      ) : (
        <div className="project-grid">
          {projects.map((p) => {
            const projectEvents = events.filter((e) => e.kind === 'active' && e.projectId === p.id);
            const total = duration(projectEvents);
            const periodTotal = duration(
              periodEvents.filter((e) => e.kind === 'active' && e.projectId === p.id),
            );
            const budget = (p.budgetMinutes ?? 0) * 60_000;
            const apps = [...new Set(projectEvents.map((e) => e.app))];
            return (
              <section
                className={`card project-card ${p.archived ? 'archived-project' : ''}`}
                key={p.id}
              >
                <div className="project-card-top">
                  <span
                    className="project-mark"
                    style={{ color: p.color, background: `${p.color}18` }}
                  >
                    <FolderKanban size={22} />
                  </span>
                  {current === p.id && <span className="current-badge">Projeto atual</span>}
                  {p.archived && <span className="current-badge">Arquivado</span>}
                  <button className="text-link" onClick={() => onEdit(p)}>
                    Editar
                  </button>
                </div>
                <h2>{p.name}</h2>
                <p>{p.client || 'Projeto pessoal'}</p>
                <div className="project-hours">
                  <strong>{formatDuration(total)}</strong>
                  <span>acumuladas</span>
                </div>
                <div className="project-period">
                  {formatDuration(periodTotal)} no período selecionado
                </div>
                {budget > 0 ? (
                  <>
                    <div className="project-budget-label">
                      <span>Estimativa: {formatDuration(budget)}</span>
                      <strong>{Math.round((total / budget) * 100)}%</strong>
                    </div>
                    <div className="progress-track project-progress">
                      <span
                        style={{
                          width: `${Math.min(100, (total / budget) * 100)}%`,
                          background: p.color,
                        }}
                      />
                    </div>
                    <p className="budget-remaining">
                      {total > budget
                        ? `${formatDuration(total - budget)} acima da estimativa`
                        : `${formatDuration(budget - total)} até a estimativa`}
                    </p>
                  </>
                ) : (
                  <p className="no-budget">Sem estimativa de horas</p>
                )}
                <div className="project-apps">
                  {apps.map((app) => (
                    <AppIcon key={app} app={app} size="small" />
                  ))}
                  <span>
                    {apps.length ? `${apps.length} softwares utilizados` : 'Pronto para começar'}
                  </span>
                </div>
                <div className="project-card-actions">
                  <button className="text-link" onClick={() => onExplore(p.id)}>
                    Ver atividades <ArrowRight size={14} />
                  </button>
                  {!p.archived && (
                    <button
                      className="button button-secondary"
                      onClick={() => onSelect(p.id)}
                      disabled={current === p.id}
                    >
                      {current === p.id ? 'Selecionado' : 'Trabalhar neste'}
                    </button>
                  )}
                </div>
                <button className="archive-link" onClick={() => onArchive(p)}>
                  {p.archived ? 'Reativar projeto' : 'Arquivar projeto'}
                </button>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
function Rules({
  config,
  events,
  onNew,
  onEdit,
  onChange,
}: {
  config: Configuration;
  events: ClassifiedEvent[];
  onNew: () => void;
  onEdit: (r: Rule) => void;
  onChange: (c: Configuration) => void;
}) {
  const [search, setSearch] = useState('');
  const query = search.trim().toLocaleLowerCase('pt-BR');
  const visibleRules = [...config.rules]
    .filter((rule) => {
      const activity = config.activities.find((a) => a.id === rule.activityId);
      return [
        rule.name,
        rule.app,
        rule.titleContains,
        rule.domain,
        activity?.name,
        ...categoryPath(activity?.categoryId ?? null, config.categories).map((c) => c.name),
        config.projects.find((p) => p.id === rule.projectId)?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('pt-BR')
        .includes(query);
    })
    .sort((a, b) => b.priority - a.priority);
  return (
    <>
      <div className="section-heading">
        <p>As regras valem para todo o histórico disponível. A maior prioridade vence.</p>
        <button className="button button-primary" onClick={onNew}>
          <Plus size={15} />
          Nova regra
        </button>
      </div>
      <section className="card rules-card">
        <div className="card-heading">
          <div>
            <h2>Regras automáticas</h2>
            <p>Os padrões têm prioridade baixa. Você pode editar ou desativar qualquer regra.</p>
          </div>
          <label className="search-field">
            <Search size={16} />
            <input
              aria-label="Buscar regras"
              placeholder="Software, atividade ou categoria…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        <div className="rules-table">
          <div className="rules-table-head">
            <span>Regra e condições</span>
            <span>Classificação</span>
            <span>Prioridade</span>
            <span>Ativa</span>
            <span />
          </div>
          {visibleRules.map((rule) => (
            <div className="rule-row" key={rule.id} data-rule-id={rule.id}>
              <button className="rule-name" onClick={() => onEdit(rule)}>
                <strong>{rule.name}</strong>
                <small>
                  {[
                    rule.app,
                    rule.titleContains && `Título contém “${rule.titleContains}”`,
                    rule.domain,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </small>
              </button>
              <div className="rule-target">
                <span>
                  {config.activities.find((a) => a.id === rule.activityId)?.name ||
                    'Manter atividade'}
                </span>
                <CategoryBadge
                  categoryId={
                    config.activities.find((a) => a.id === rule.activityId)?.categoryId ?? null
                  }
                  categories={config.categories}
                  emptyLabel={
                    rule.activityId ? 'Sem categoria' : 'Atividade definida por outras regras'
                  }
                />
                {rule.projectId && (
                  <small>
                    <FolderKanban size={12} />
                    {config.projects.find((p) => p.id === rule.projectId)?.name}
                  </small>
                )}
              </div>
              <span className="priority-pill">{rule.priority}</span>
              <input
                type="checkbox"
                aria-label={`Ativar regra ${rule.name}`}
                checked={rule.enabled}
                onChange={(e) =>
                  onChange({
                    ...config,
                    rules: config.rules.map((r) =>
                      r.id === rule.id ? { ...r, enabled: e.target.checked } : r,
                    ),
                  })
                }
              />
              <button className="text-link" onClick={() => onEdit(rule)}>
                Editar
              </button>
            </div>
          ))}
        </div>
        {!!config.rules.length && !visibleRules.length && (
          <Empty
            title="Nenhuma regra encontrada"
            description="Busque outro software, atividade ou categoria."
          />
        )}
        {!config.rules.length && (
          <Empty
            title="Sua organização começa com uma regra"
            description="Escolha um software ou parte do título e diga como deseja classificá-lo."
            action={
              <button className="button button-primary" onClick={onNew}>
                Criar regra
              </button>
            }
          />
        )}
      </section>
      <div className="rule-tip">
        <span>
          <Sparkles size={22} />
        </span>
        <div>
          <strong>Uma regra, muitos registros organizados.</strong>
          <p>
            Use condições específicas para projetos e condições gerais para atividades. Correções
            manuais de intervalos têm prioridade sobre as regras.
          </p>
        </div>
      </div>
      <section className="card activity-library">
        <div className="card-heading">
          <div>
            <h2>Suas atividades</h2>
            <p>Para renomear uma atividade, abra um registro na árvore ou na timeline.</p>
          </div>
        </div>
        <div className="activity-chips">
          {config.activities.map((a) => (
            <span key={a.id}>
              <i
                style={{
                  background: categoryColor(a.categoryId, config.categories),
                }}
              />
              {a.name}
              <small>
                {formatDuration(
                  duration(events.filter((e) => e.kind === 'active' && e.activityId === a.id)),
                )}
              </small>
            </span>
          ))}
        </div>
      </section>
    </>
  );
}
