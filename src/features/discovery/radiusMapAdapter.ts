import L from "leaflet";
import type { RadiusSearchEstablishment, RadiusSearchOrigin } from "../../types/api";

export interface RadiusMapData { origin: RadiusSearchOrigin; radiusKm: number; items: RadiusSearchEstablishment[]; }
export interface RadiusMapController { update(data: RadiusMapData): void; destroy(): void; }
export interface RadiusMapOptions { tileUrl: string; attribution: string; onTileFailure: () => void; }

export function createRadiusMapController(container: HTMLElement, options: RadiusMapOptions): RadiusMapController {
  const map = L.map(container, { attributionControl: true });
  let failures = 0;
  const tile = L.tileLayer(options.tileUrl, { attribution: options.attribution });
  tile.on("tileerror", () => { failures += 1; if (failures === 3) options.onTileFailure(); });
  tile.addTo(map);
  const layers = L.layerGroup().addTo(map);
  return {
    update(data) {
      layers.clearLayers();
      const center = L.latLng(data.origin.latitude, data.origin.longitude);
      const origin = L.circleMarker(center, { radius: 8, color: "#124da9", fillColor: "#175cd3", fillOpacity: 1 }).addTo(layers);
      origin.bindTooltip("Origem resolvida");
      const circle = L.circle(center, { radius: data.radiusKm * 1000, color: "#175cd3", fillOpacity: .06 }).addTo(layers);
      const bounds = circle.getBounds();
      bounds.extend(center);
      for (const item of data.items) {
        const marker = L.circleMarker([item.latitude, item.longitude], { radius: 5, color: "#7a4d00", fillColor: "#f59e0b", fillOpacity: .9 }).addTo(layers);
        const tooltip = document.createElement("div");
        const title = document.createElement("strong"); title.textContent = item.razao_social || item.nome_fantasia || "Empresa";
        const detail = document.createElement("div"); detail.textContent = `${item.cnpj_full} · ${item.distance_km.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km`;
        tooltip.append(title, detail); marker.bindTooltip(tooltip); bounds.extend(marker.getLatLng());
      }
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 14 });
      map.invalidateSize({ pan: false });
    },
    destroy() { tile.off(); layers.clearLayers(); map.remove(); },
  };
}
