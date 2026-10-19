import { createConfig } from './defaults';
import { dayStart } from './engine';
import type { Snapshot, TimeEvent } from './types';

export function createDemo(): Snapshot {
  const config = createConfig();
  config.projects = [
    {
      id: 'tflm',
      name: 'Estrutural TFLM',
      client: 'Engenharia estrutural',
      color: '#c87957',
      budgetMinutes: 2400,
      apps: ['eberick.exe', 'excel.exe'],
      archived: false,
    },
    {
      id: 'aurora',
      name: 'Residencial Aurora',
      client: 'Projeto residencial',
      color: '#778db5',
      budgetMinutes: 3600,
      apps: ['eberick.exe'],
      archived: false,
    },
    {
      id: 'office',
      name: 'Gestão do escritório',
      client: 'Interno',
      color: '#7e9274',
      budgetMinutes: null,
      apps: ['outlook.exe'],
      archived: false,
    },
  ];
  config.rules.push(
    {
      id: 'rule-tflm',
      name: 'Reconhecer projeto TFLM',
      enabled: true,
      priority: 50,
      app: '',
      titleContains: 'TFLM',
      domain: '',
      activityId: null,
      projectId: 'tflm',
    },
    {
      id: 'rule-aurora',
      name: 'Reconhecer Residencial Aurora',
      enabled: true,
      priority: 50,
      app: '',
      titleContains: 'Aurora',
      domain: '',
      activityId: null,
      projectId: 'aurora',
    },
    {
      id: 'rule-research',
      name: 'Documentação e referências',
      enabled: true,
      priority: 30,
      app: 'chrome.exe',
      titleContains: 'documentação',
      domain: '',
      activityId: 'research',
      projectId: null,
    },
    {
      id: 'rule-personal',
      name: 'Navegação pessoal',
      enabled: true,
      priority: 10,
      app: 'chrome.exe',
      titleContains: 'YouTube',
      domain: '',
      activityId: 'leisure',
      projectId: null,
    },
  );
  const events: TimeEvent[] = [];
  const sequence: [string, string, number, TimeEvent['kind'], string | null][] = [
    ['outlook.exe', 'Caixa de entrada — Outlook', 25, 'active', 'office'],
    ['eberick.exe', 'TFLM — Pavimento térreo — Eberick', 95, 'active', 'tflm'],
    ['', '', 15, 'pause', null],
    ['eberick.exe', 'TFLM — Lançamento de pilares — Eberick', 85, 'active', 'tflm'],
    ['excel.exe', 'TFLM — Quantitativos.xlsx — Excel', 44, 'active', 'tflm'],
    ['', '', 45, 'idle', null],
    ['chrome.exe', 'Documentação técnica — Dimensionamento', 38, 'active', 'tflm'],
    ['eberick.exe', 'Aurora — Fundação — Eberick', 65, 'active', 'aurora'],
    ['chrome.exe', 'YouTube — Música para trabalhar', 12, 'active', null],
    ['chrome.exe', 'Nova guia — Google Chrome', 18, 'active', null],
  ];
  for (let day = 13; day >= 0; day--) {
    const d = new Date(dayStart());
    d.setDate(d.getDate() - day);
    d.setHours(8, 15, 0, 0);
    let cursor = d.getTime();
    for (let i = 0; i < sequence.length; i++) {
      const [app, title, minutes, kind, projectId] = sequence[i];
      const multiplier = day === 0 ? 1 : [0.65, 0.8, 1, 1.15][day % 4];
      const end = cursor + Math.round(minutes * multiplier) * 60_000;
      events.push({
        id: `demo-${day}-${i}`,
        start: cursor,
        end,
        app,
        title,
        kind,
        projectId,
        domain: null,
      });
      cursor = end;
    }
  }
  return {
    config,
    events,
    pause: null,
    currentProjectId: 'tflm',
    capturing: false,
    platform: 'demo',
    lastError: null,
  };
}
