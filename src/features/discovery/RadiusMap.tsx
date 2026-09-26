import { useEffect, useRef, useState } from "react";
import {
  createRadiusMapController,
  type RadiusMapController,
  type RadiusMapData,
} from "./radiusMapAdapter";
import { radiusMapOptions } from "./radiusMapConfig";
import { ResultsErrorBoundary } from "./ResultsErrorBoundary";

interface RadiusMapProps {
  data: RadiusMapData;
  accessibleName?: string;
}

// O mapa é complementar: uma falha dele não pode remover a tabela vizinha.
export function RadiusMap(props: RadiusMapProps) {
  return (
    <ResultsErrorBoundary
      resetKey={props.data.items}
      fallback={() => (
        <div className="radius-map-panel">
          <p className="map-warning" role="status">
            O mapa não pôde ser exibido. Os resultados e posições continuam
            disponíveis na tabela.
          </p>
        </div>
      )}
    >
      <RadiusMapCanvas {...props} />
    </ResultsErrorBoundary>
  );
}

function RadiusMapCanvas({ data, accessibleName = "Mapa da busca por raio" }: RadiusMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<RadiusMapController | null>(null);
  const [tileFailed, setTileFailed] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const controller = createRadiusMapController(
      containerRef.current,
      radiusMapOptions(import.meta.env, () => setTileFailed(true)),
    );
    controllerRef.current = controller;
    return () => {
      controller.destroy();
      controllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    controllerRef.current?.update(data);
  }, [data]);

  return (
    <div className="radius-map-panel">
      <p className="muted">
        O mapa é complementar; todos os dados permanecem disponíveis na tabela.
      </p>
      {tileFailed && (
        <p className="map-warning" role="status">
          O mapa-base não pôde ser carregado. Os resultados e posições continuam
          disponíveis na tabela.
        </p>
      )}
      <div
        ref={containerRef}
        className="radius-map"
        role="region"
        aria-label={accessibleName}
      />
    </div>
  );
}
