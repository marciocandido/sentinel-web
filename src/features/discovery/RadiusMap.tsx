import { useEffect, useRef, useState } from "react";
import {
  createRadiusMapController,
  type RadiusMapController,
  type RadiusMapData,
} from "./radiusMapAdapter";
import { radiusMapOptions } from "./radiusMapConfig";

export function RadiusMap({ data }: { data: RadiusMapData }) {
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
        aria-label="Mapa da busca por raio"
      />
    </div>
  );
}
