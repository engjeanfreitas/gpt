import { useId, useState } from 'react';
import {
  ArrowDownRight,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Clock3,
  Coffee,
  FolderKanban,
  Hourglass,
  Layers3,
  Monitor,
  MoreHorizontal,
  Pencil,
  Timer,
  HelpCircle,
} from 'lucide-react';
import { AppIcon, Empty } from './ui';
import {
  categoryColor,
  dayStart,
  duration,
  formatClock,
  formatDuration,
  groupEvents,
} from '../lib/engine';
import { buildTimeline } from '../lib/timeline';
import { chartBins, chartSeries, type ChartSeries } from '../lib/chart';
import { dashboardTotals } from '../lib/metrics';
import type { ClassifiedEvent, Configuration, DateRange, GroupMode, GroupRow } from '../lib/types';

interface Props {
  events: ClassifiedEvent[];
  config: Configuration;
  range: DateRange;
  mode: GroupMode;
  onMode: (mode: GroupMode) => void;
  onSelect: (events: ClassifiedEvent[]) => void;
  onProject: (id: string) => void;
  onNewProject: () => void;
}
export function ActivityChart({
  series,
  range,
  mode,
}: {
  series: ChartSeries[];
  range: DateRange;
  mode: GroupMode;
}) {
  const id = useId().replaceAll(':', '');
  const bins = chartBins(series, range);
  const daily = range.end - range.start > 26 * 3600_000;
  const totals = bins.map((bin) =>
    bin.segments.reduce((sum, segment) => sum + segment.duration, 0),
  );
  const max = Math.max(daily ? 3600_000 : 1800_000, ...totals);
  const graphHeight = 155;
  const step = 700 / Math.max(1, bins.length);
  const barWidth = Math.max(2, Math.min(32, step * 0.55));
  const grouping = mode === 'activity' ? 'categoria' : mode === 'software' ? 'software' : 'projeto';
  return (
    <div className="chart-container">
      <svg
        viewBox="0 0 760 204"
        role="img"
        aria-label={`Distribuição do tempo por ${grouping}, com pausas e ausência`}
      >
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <line
              x1="43"
              x2="752"
              y1={12 + (i * graphHeight) / 3}
              y2={12 + (i * graphHeight) / 3}
              stroke="#ecece6"
              strokeDasharray="3 5"
            />
            <text x="0" y={16 + (i * graphHeight) / 3} className="chart-label">
              {formatDuration((max * (3 - i)) / 3, true)}
            </text>
          </g>
        ))}
        {bins.map((bin, index) => {
          const x = 46 + index * step + (step - barWidth) / 2;
          const height = (totals[index] / max) * graphHeight;
          let offset = 0;
          const clip = `${id}-bar-${index}`;
          return (
            <g key={bin.start} className="chart-bin">
              <title>{`${bin.label}: ${bin.segments.map((segment) => `${segment.name}: ${formatDuration(segment.duration)}`).join('; ') || 'Sem registros'}`}</title>
              <defs>
                <clipPath id={clip}>
                  <rect
                    x={x}
                    y={12 + graphHeight - height}
                    width={barWidth}
                    height={height}
                    rx="3"
                  />
                </clipPath>
              </defs>
              <g clipPath={`url(#${clip})`}>
                {bin.segments.map((segment) => {
                  const segmentHeight = (segment.duration / max) * graphHeight;
                  offset += segmentHeight;
                  return (
                    <rect
                      key={segment.id}
                      className="chart-segment"
                      data-series-id={segment.id}
                      data-duration={segment.duration}
                      x={x}
                      y={12 + graphHeight - offset}
                      width={barWidth}
                      height={segmentHeight}
                      fill={segment.color}
                    >
                      <title>{`${bin.label} · ${segment.name}: ${formatDuration(segment.duration)}`}</title>
                    </rect>
                  );
                })}
              </g>
              {(bins.length <= 18 || index % Math.ceil(bins.length / 12) === 0) && (
                <text x={x + barWidth / 2} y="192" textAnchor="middle" className="chart-label">
                  {bin.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
export function Dashboard({
  events,
  config,
  range,
  mode,
  onMode,
  onSelect,
  onProject,
  onNewProject,
}: Props) {
  const totals = dashboardTotals(events, config);
  const total = totals.active;
  const multipleDays = dayStart(new Date(range.start)) !== dayStart(new Date(range.end - 1));
  const share = (value: number) =>
    `${total ? Math.round((value / total) * 100) : 0}% do tempo ativo`;
  const rows = groupEvents(events, config, mode);
  const chartGroups = chartSeries(events, config, mode, rows);
  const softwareRows = groupEvents(events, config, 'software').slice(0, 4);
  const projectRows = groupEvents(events, config, 'project')
    .filter((r) => r.id !== 'p:none')
    .slice(0, 3);
  return (
    <>
      <div className="metrics">
        <Metric
          label={multipleDays ? 'Tempo ativo no período' : 'Tempo ativo no dia'}
          value={formatDuration(totals.active)}
          icon={<Clock3 size={18} />}
          note={
            totals.unclassified
              ? `${formatDuration(totals.unclassified)} sem atividade definida`
              : 'Nos softwares em primeiro plano'
          }
          tone="blue"
        />
        <Metric
          label="Tempo de trabalho"
          value={formatDuration(totals.work)}
          icon={<FolderKanban size={18} />}
          note={`${share(totals.work)} · ${config.categories.find((c) => c.id === 'work')?.name ?? 'Trabalho'}`}
          tone="green"
          color={categoryColor('work', config.categories)}
        />
        <Metric
          label="Tempo AFK"
          value={formatDuration(totals.afk)}
          icon={<Coffee size={18} />}
          note={
            totals.paused
              ? `Ausência / tela bloqueada · pausa separada: ${formatDuration(totals.paused)}`
              : 'Ausência automática / tela bloqueada'
          }
          tone="neutral"
        />
        <Metric
          label="Tempo procrastinando"
          value={formatDuration(totals.procrastination)}
          icon={<Hourglass size={18} />}
          note={`${share(totals.procrastination)} · ${config.categories.find((c) => c.id === 'personal')?.name ?? 'Pessoal'}`}
          tone="purple"
          color={categoryColor('personal', config.categories)}
        />
      </div>
      <div className="dashboard-grid">
        <section className="card distribution-card">
          <div className="card-heading">
            <div>
              <h2>
                {range.end - range.start > 26 * 3600_000
                  ? 'O ritmo do período'
                  : 'O ritmo do seu dia'}
              </h2>
              <p>As cores acompanham o agrupamento escolhido abaixo.</p>
            </div>
            <span className="subtle-icon">
              <Timer size={18} />
            </span>
          </div>
          <ActivityChart series={chartGroups} range={range} mode={mode} />
          <div className="chart-legend">
            {chartGroups.map((group) => (
              <span key={group.id} data-series-id={group.id}>
                <i style={{ background: group.color }} />
                {group.name}
              </span>
            ))}
            <span className="legend-note">
              <HelpCircle size={12} /> Passe o mouse sobre uma faixa para ver o tempo. Intervalos
              sem coleta não entram no total.
            </span>
          </div>
        </section>
        <section className="card software-card">
          <div className="card-heading">
            <div>
              <h2>Seus softwares</h2>
              <p>As ferramentas do seu trabalho.</p>
            </div>
            <Monitor size={18} className="muted" />
          </div>
          {softwareRows.length ? (
            <div className="software-ranking">
              {softwareRows.map((row) => (
                <button key={row.id} className="software-rank" onClick={() => onSelect(row.events)}>
                  <AppIcon app={row.events[0].app} />
                  <span className="rank-info">
                    <span className="rank-label">
                      {row.name}
                      <strong>{formatDuration(row.duration)}</strong>
                    </span>
                    <span className="progress-track">
                      <span
                        style={{
                          width: `${(row.duration / Math.max(total, 1)) * 100}%`,
                          background: row.color,
                        }}
                      />
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="small-empty">Os softwares aparecerão após a primeira coleta.</p>
          )}
          <button className="text-link ranking-link" onClick={() => onMode('software')}>
            Explorar por software <ArrowRight size={14} />
          </button>
        </section>
      </div>
      <section className="card tree-card">
        <div className="card-heading tree-heading">
          <div>
            <h2>Para onde foi seu tempo?</h2>
            <p>Explore os detalhes. Cada intervalo conta uma única vez.</p>
          </div>
          <div className="segmented" aria-label="Agrupar tempo">
            {(
              [
                ['activity', 'Atividade'],
                ['software', 'Software'],
                ['project', 'Projeto'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                className={mode === value ? 'selected' : ''}
                onClick={() => onMode(value)}
                aria-pressed={mode === value}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {rows.length ? (
          <ActivityTree rows={rows} total={total} onSelect={onSelect} mode={mode} />
        ) : (
          <Empty
            title="Seu tempo começa aqui"
            description="As atividades deste período aparecerão na árvore. Experimente outro período ou ajuste os filtros."
          />
        )}
        {!!rows.length && (
          <div className="table-footer">
            <span>
              <span className="tiny-dot" /> Os totais dos pais incluem seus filhos
            </span>
            <strong>
              Total ativo <b>{formatDuration(total)}</b>
            </strong>
          </div>
        )}
      </section>
      <section className="projects-overview">
        <div className="section-heading">
          <div>
            <h2>Projetos em movimento</h2>
            <p>Veja o que está recebendo sua atenção.</p>
          </div>
          <button className="text-link" onClick={onNewProject}>
            Novo projeto <ArrowRight size={15} />
          </button>
        </div>
        <div className="mini-projects">
          {projectRows.length ? (
            projectRows.map((row) => {
              const p = config.projects.find((p) => `p:${p.id}` === row.id)!;
              return (
                <button className="mini-project card" key={row.id} onClick={() => onProject(p.id)}>
                  <span
                    className="project-mark"
                    style={{ color: p.color, background: `${p.color}18` }}
                  >
                    <FolderKanban size={19} />
                  </span>
                  <span>
                    <strong>{row.name}</strong>
                    <small>{p.client || 'Projeto pessoal'}</small>
                  </span>
                  <span className="mini-project-time">
                    {formatDuration(row.duration)}
                    <ArrowDownRight size={15} />
                  </span>
                </button>
              );
            })
          ) : (
            <div className="card mini-project-empty">
              Atribua atividades a um projeto para acompanhar seu tempo aqui.
            </div>
          )}
        </div>
      </section>
    </>
  );
}
function Metric({
  label,
  value,
  note,
  icon,
  tone,
  color,
}: {
  label: string;
  value: string;
  note: string;
  icon: React.ReactNode;
  tone: string;
  color?: string;
}) {
  return (
    <section className={`card metric metric-${tone}`}>
      <div className="metric-label">
        {label}
        <span style={color ? { color } : undefined}>{icon}</span>
      </div>
      <div className="metric-value">{value}</div>
      <p>{note}</p>
    </section>
  );
}
function ActivityTree({
  rows,
  total,
  onSelect,
  mode,
}: {
  rows: GroupRow[];
  total: number;
  onSelect: (events: ClassifiedEvent[]) => void;
  mode: GroupMode;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['work', 'work/engineering']));
  const toggle = (key: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const renderRows = (items: GroupRow[], depth = 0, parent = ''): React.ReactNode =>
    items.map((row) => {
      const key = `${parent}${parent ? '/' : ''}${row.id}`;
      const open = expanded.has(key);
      const percent = (row.duration / Math.max(total, 1)) * 100;
      return (
        <div key={key}>
          <div className={`activity-row ${depth ? 'child-row' : ''}`} data-group-id={row.id}>
            <div className="activity-name" style={{ paddingLeft: `${depth * 25 + 16}px` }}>
              {row.children.length ? (
                <button
                  className="tree-toggle"
                  onClick={() => toggle(key)}
                  aria-label={`${open ? 'Recolher' : 'Expandir'} ${row.name}`}
                  aria-expanded={open}
                >
                  {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                </button>
              ) : (
                <span className="tree-toggle-placeholder" />
              )}
              <span className="category-dot" style={{ background: row.color }} />
              <button className="row-name-button" onClick={() => onSelect(row.events)}>
                <strong>{row.name}</strong>
                <small>{row.subtitle}</small>
              </button>
            </div>
            <strong className="row-time">{formatDuration(row.duration)}</strong>
            <div className="row-bar">
              <span style={{ width: `${Math.max(1, percent)}%`, background: row.color }} />
            </div>
            <span className="row-percentage">{Math.round(percent)}%</span>
            <button
              className="icon-button row-edit"
              onClick={() => onSelect(row.events)}
              aria-label={`Editar ${row.name}`}
            >
              <MoreHorizontal size={18} />
            </button>
          </div>
          {open && renderRows(row.children, depth + 1, key)}
        </div>
      );
    });
  return (
    <div className="activity-table">
      <div className="table-head">
        <span>
          {mode === 'activity'
            ? 'Categoria / atividade'
            : mode === 'software'
              ? 'Software / atividade'
              : 'Projeto / atividade'}
        </span>
        <span>Tempo</span>
        <span>Distribuição</span>
        <span>%</span>
        <span />
      </div>
      {renderRows(rows)}
    </div>
  );
}
export function Timeline({
  events,
  onSelect,
  onEditBlock,
}: {
  events: ClassifiedEvent[];
  onSelect: (events: ClassifiedEvent[]) => void;
  onEditBlock: (events: ClassifiedEvent[]) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const blocks = buildTimeline(events, !showAll);
  const renderInterval = (event: ClassifiedEvent) => {
    const rest = event.kind !== 'active';
    return (
      <button
        className={`timeline-item ${rest ? 'timeline-rest' : ''}`}
        onClick={() => !rest && onSelect([event])}
        disabled={rest}
      >
        <span className="timeline-hours">
          {formatClock(event.start)}
          <small>{formatClock(event.end)}</small>
        </span>
        <span className="timeline-connector">
          <i />
        </span>
        {rest ? (
          <span className="rest-icon">
            <Coffee size={18} />
          </span>
        ) : (
          <AppIcon app={event.app} />
        )}
        <span className="timeline-content">
          <strong>
            {rest
              ? event.kind === 'pause'
                ? 'Pausa'
                : event.kind === 'idle'
                  ? 'AFK / ausente ou tela bloqueada'
                  : 'Intervalo sem coleta'
              : event.activityName}
          </strong>
          <small>{rest ? 'Fora do tempo ativo' : event.title || event.softwareName}</small>
        </span>
        {!rest && <span className="project-pill">{event.projectName}</span>}
        <strong className="timeline-duration">{formatDuration(event.end - event.start)}</strong>
        {!rest && <ChevronRight size={16} />}
      </button>
    );
  };
  let previousDay = 0;
  return (
    <section className="card timeline-card">
      <div className="card-heading">
        <div>
          <h2>Sua linha do tempo</h2>
          <p>
            Trocas de menos de 5 minutos ficam nos detalhes. Categorias e projetos mantêm o tempo
            exato.
          </p>
        </div>
        <Clock3 size={18} className="muted" />
      </div>
      <div className="timeline-options">
        <label>
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
          Mostrar todos os intervalos
        </label>
        <span>
          Use Editar bloco para alterar todos os intervalos ou abra os detalhes para editar um.
        </span>
      </div>
      {!blocks.length ? (
        <Empty
          title="Nenhum intervalo neste período"
          description="A coleta registra o uso dos softwares automaticamente no aplicativo Windows."
        />
      ) : (
        <div className="timeline-list">
          {blocks.map((block) => {
            const day = dayStart(new Date(block.start));
            const showDay = day !== previousDay;
            previousDay = day;
            const grouped = block.events.length > 1;
            const open = expanded.has(block.id);
            const projectNames = new Set(block.events.map((event) => event.projectId));
            return (
              <div key={block.id} className={grouped ? 'timeline-block' : undefined}>
                {showDay && (
                  <div className="timeline-date">
                    {new Date(day).toLocaleDateString('pt-BR', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                    })}
                  </div>
                )}
                {!grouped ? (
                  renderInterval(block.events[0])
                ) : (
                  <>
                    <div className="timeline-block-heading">
                      <button
                        className="timeline-item timeline-summary"
                        aria-expanded={open}
                        onClick={() =>
                          setExpanded((current) => {
                            const next = new Set(current);
                            if (next.has(block.id)) next.delete(block.id);
                            else next.add(block.id);
                            return next;
                          })
                        }
                      >
                        <span className="timeline-hours">
                          {formatClock(block.start)}
                          <small>{formatClock(block.end)}</small>
                        </span>
                        <span className="timeline-connector">
                          <i />
                        </span>
                        {block.anchor ? (
                          <AppIcon app={block.anchor.app} />
                        ) : (
                          <span className="rest-icon">
                            <Layers3 size={18} />
                          </span>
                        )}
                        <span className="timeline-content">
                          <strong>
                            {block.anchor
                              ? `${block.anchor.activityName} e mudanças rápidas`
                              : 'Mudanças rápidas'}
                          </strong>
                          <small>
                            {block.events.length} intervalos · total do bloco ·{' '}
                            {open ? 'fechar detalhes' : 'abrir detalhes'}
                          </small>
                        </span>
                        <span className="project-pill">
                          {projectNames.size > 1 ? 'Vários projetos' : block.events[0].projectName}
                        </span>
                        <strong className="timeline-duration">
                          {formatDuration(duration(block.events))}
                        </strong>
                        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                      <button
                        className="button button-secondary timeline-edit-block"
                        title={`Editar todos os ${block.events.length} intervalos de ${formatClock(block.start)} a ${formatClock(block.end)}`}
                        onClick={() => onEditBlock(block.events)}
                      >
                        <Pencil size={14} />
                        Editar bloco
                      </button>
                    </div>
                    {open && (
                      <div className="timeline-details">
                        <p>
                          Cada intervalo mantém sua própria categoria e projeto. Selecione um para
                          editar.
                        </p>
                        {[...block.events].reverse().map((event) => (
                          <div key={`${event.id}:${event.start}`}>{renderInterval(event)}</div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
