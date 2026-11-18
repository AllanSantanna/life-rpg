import { lazy, Suspense, useCallback, useId, useState } from 'react';
import { areas, type Period } from '../evolution/scoring';
import { displayDate, shiftDate } from '../records/dates';
import { EvolutionLines } from './EvolutionLines';
import { LandscapeBoundary } from './LandscapeBoundary';
import type { CameraCommand } from './sceneTypes';
import type { EvolutionPoint, LandscapeMode, Pillar } from './types';

const LandscapeScene = lazy(() =>
  import('./LandscapeScene').then((module) => ({
    default: module.LandscapeScene,
  })),
);
const modes: { id: LandscapeMode; label: string }[] = [
  { id: 'landscape', label: 'Paisagem' },
  { id: 'bars', label: 'Barras 3D' },
  { id: 'surface', label: 'Superfície' },
];

export function EvolutionLandscape({
  series,
  period,
}: {
  series: EvolutionPoint[];
  period: Period;
}) {
  const [mode, setMode] = useState<LandscapeMode>('landscape');
  const [visible, setVisible] = useState<Pillar[]>([...areas]);
  const [date, setDate] = useState(series.at(-1)!.date);
  const [pillar, setPillar] = useState<Pillar>('Finanças');
  const [unavailable, setUnavailable] = useState(
    () => typeof window.WebGL2RenderingContext === 'undefined',
  );
  const [camera, setCamera] = useState<CameraCommand>({
    action: 'reset',
    version: 0,
  });
  const id = useId();
  const found = series.findIndex((point) => point.date === date);
  const selected = found < 0 ? series.length - 1 : found;
  const point = series[selected]!;
  const onUnavailable = useCallback(() => setUnavailable(true), []);
  const onSelect = useCallback(
    (index: number, area?: Pillar) => {
      const next = series[index];
      if (next) setDate(next.date);
      if (area) setPillar(area);
    },
    [series],
  );
  function command(action: CameraCommand['action']) {
    setCamera((current) => ({ action, version: current.version + 1 }));
  }
  const fallback = (
    <EvolutionLines
      series={series}
      visible={visible}
      selected={selected}
      onSelect={onSelect}
    />
  );
  return (
    <section
      className="panel statistics-landscape"
      aria-label="Paisagem da Evolução 3D"
    >
      <div>
        <p className="eyebrow text-primary">Uma nova perspectiva</p>
        <h2 className="mt-1 text-xl font-semibold">Paisagem da Evolução 3D</h2>
        <p className="statistics-copy">
          Últimos {period} dias · dedicação móvel de 7 dias · 0 a 100.
        </p>
      </div>
      <div
        className="statistics-mode-controls"
        role="group"
        aria-label="Modo de visualização"
      >
        {modes.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`filter-button ${mode === item.id ? 'active' : ''}`}
            aria-pressed={mode === item.id}
            onClick={() => setMode(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="statistics-landscape-viewport" data-mode={mode}>
        {unavailable ? (
          fallback
        ) : (
          <LandscapeBoundary onUnavailable={onUnavailable} fallback={fallback}>
            <Suspense
              fallback={
                <p role="status" className="statistics-loading">
                  Carregando visualização 3D…
                </p>
              }
            >
              <LandscapeScene
                series={series}
                visible={visible}
                mode={mode}
                selected={selected}
                cameraCommand={camera}
                onSelect={onSelect}
                onUnavailable={onUnavailable}
              />
            </Suspense>
          </LandscapeBoundary>
        )}
      </div>
      <p className="statistics-copy">
        {unavailable
          ? 'Visualização 2D disponível: o navegador não oferece WebGL 2 ou o recurso 3D está indisponível.'
          : 'Arraste para girar. Use a roda ou dois dedos para aproximar. Toque em uma superfície para selecionar.'}{' '}
        Datas no eixo horizontal, pilares em profundidade e dedicação na altura.
      </p>
      {!unavailable && (
        <div
          className="statistics-camera-controls"
          role="group"
          aria-label="Controles da câmera"
        >
          <button
            type="button"
            className="filter-button"
            aria-label="Girar câmera à esquerda"
            onClick={() => command('left')}
          >
            ↶
          </button>
          <button
            type="button"
            className="filter-button"
            aria-label="Girar câmera à direita"
            onClick={() => command('right')}
          >
            ↷
          </button>
          <button
            type="button"
            className="filter-button"
            aria-label="Inclinar câmera para cima"
            onClick={() => command('up')}
          >
            ↑
          </button>
          <button
            type="button"
            className="filter-button"
            aria-label="Inclinar câmera para baixo"
            onClick={() => command('down')}
          >
            ↓
          </button>
          <button
            type="button"
            className="filter-button"
            aria-label="Aproximar câmera"
            onClick={() => command('in')}
          >
            +
          </button>
          <button
            type="button"
            className="filter-button"
            aria-label="Afastar câmera"
            onClick={() => command('out')}
          >
            −
          </button>
          <button
            type="button"
            className="filter-button"
            onClick={() => command('reset')}
          >
            Restaurar câmera
          </button>
        </div>
      )}
      <div
        className="statistics-layer-controls"
        role="group"
        aria-label="Pilares visíveis"
      >
        {areas.map((area) => (
          <button
            type="button"
            key={area}
            data-area={area}
            aria-pressed={visible.includes(area)}
            onClick={() =>
              // Mantém a ordem canônica dos pilares ao reativar uma camada.
              setVisible((current) =>
                current.includes(area)
                  ? current.filter((item) => item !== area)
                  : areas.filter(
                      (item) => item === area || current.includes(item),
                    ),
              )
            }
          >
            <span aria-hidden="true">{visible.includes(area) ? '●' : '○'}</span>{' '}
            {area}
          </button>
        ))}
      </div>
      {visible.length === 0 && (
        <p role="status" className="statistics-copy">
          Ative um pilar para exibir a série.
        </p>
      )}
      <div className="statistics-date-selector">
        <label htmlFor={`${id}-date`}>
          Data da paisagem: <strong>{displayDate(point.date)}</strong>
        </label>
        <div>
          <button
            type="button"
            className="filter-button"
            aria-label="Data anterior da paisagem"
            disabled={selected === 0}
            onClick={() => onSelect(selected - 1)}
          >
            ←
          </button>
          <input
            id={`${id}-date`}
            type="range"
            min="0"
            max={series.length - 1}
            step="1"
            value={selected}
            aria-valuetext={displayDate(point.date)}
            onChange={(event) => onSelect(Number(event.target.value))}
          />
          <button
            type="button"
            className="filter-button"
            aria-label="Próxima data da paisagem"
            disabled={selected === series.length - 1}
            onClick={() => onSelect(selected + 1)}
          >
            →
          </button>
        </div>
      </div>
      <div
        className="statistics-selected-point"
        role="status"
        aria-label="Valores da data selecionada"
      >
        <p>
          Ponto selecionado · {visible.includes(pillar) ? `${pillar} · ` : ''}
          <time dateTime={point.date}>{displayDate(point.date)}</time>
        </p>
        <dl>
          {visible.map((area) => (
            <div key={area} data-area={area}>
              <dt>{area}</dt>
              <dd>
                <strong>{point.scores[area]}/100</strong>
                <span>
                  {point.comparable[area]
                    ? `${point.scores[area] - point.previous[area] > 0 ? '+' : ''}${point.scores[area] - point.previous[area]} pontos vs. ${displayDate(shiftDate(point.date, -period))}`
                    : 'Sem comparação anterior disponível'}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <details className="statistics-method">
        <summary>Valores acessíveis e método</summary>
        <p>
          Cada data mostra a dedicação dos sete dias encerrados nela, pela
          fórmula existente do Radar. A comparação usa uma janela de sete dias
          encerrada {period} dias antes. Registros reais e confirmações
          históricas datadas; sessões de musculação não acrescentam pontos. Zero
          significa ausência de dedicação pontuada na janela. Os três modos usam
          a mesma série, sem interpolar dados ausentes.
        </p>
        <div
          className="statistics-values-scroll"
          tabIndex={0}
          role="region"
          aria-label="Tabela dos valores da paisagem"
        >
          <table className="statistics-values">
            <caption>
              Todos os pilares · dedicação móvel de 7 dias · 0 a 100
            </caption>
            <thead>
              <tr>
                <th scope="col">Data</th>
                {areas.map((area) => (
                  <th scope="col" key={area}>
                    {area}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {series.map((item) => (
                <tr key={item.date}>
                  <th scope="row">{displayDate(item.date)}</th>
                  {areas.map((area) => (
                    <td key={area}>{item.scores[area]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
