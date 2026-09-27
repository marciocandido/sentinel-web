import {
  searchCommercialGroup,
  searchEstablishmentsByRadius,
  searchFilteredEstablishments,
  searchNeighboringEstablishments,
  searchRootBranches,
} from "../../services/sentinelApi";
import type { QueryResult, SubmittedQuery } from "./discoveryTypes";

/**
 * Executa uma consulta submetida contra o contrato vigente do seu tipo. A
 * família Filtros usa sempre FILTERED; RADIUS, NEIGHBORS, ROOT_BRANCHES e
 * COMMERCIAL_GROUP permanecem contratos distintos.
 */
export async function runDiscoveryQuery(
  query: SubmittedQuery,
  limit: number,
  offset: number,
  signal: AbortSignal,
): Promise<QueryResult> {
  const options = { signal };
  if (query.kind === "filtered") {
    const { snapshot } = query;
    const page = await searchFilteredEstablishments({
      segmentId: snapshot.segmentId,
      uf: snapshot.uf,
      municipioNome: snapshot.municipioNome,
      codigoTom: snapshot.codigoTom,
      codigoIbge: snapshot.codigoIbge,
      porteCodigo: snapshot.porteCodigo,
      capitalMin: snapshot.capitalMin,
      capitalMax: snapshot.capitalMax,
      includeDiscarded: snapshot.includeDiscarded,
      limit,
      offset,
    }, options);
    return { kind: "filtered", snapshot, page };
  }
  if (query.kind === "radius") {
    const { snapshot } = query;
    const page = await searchEstablishmentsByRadius({
      origin: snapshot.origin,
      radiusKm: snapshot.radiusKm,
      segmentId: snapshot.segmentId,
      resultUf: snapshot.resultUf,
      includeDiscarded: snapshot.includeDiscarded,
      limit,
      offset,
    }, options);
    return { kind: "radius", snapshot, page };
  }
  if (query.kind === "neighbors") {
    const { snapshot } = query;
    const page = await searchNeighboringEstablishments({
      cnpjFull: snapshot.cnpj,
      radiusKm: snapshot.radiusKm,
      segmentId: snapshot.segmentId,
      resultUf: snapshot.resultUf,
      includeDiscarded: snapshot.includeDiscarded,
      limit,
      offset,
    }, options);
    return { kind: "neighbors", snapshot, page };
  }
  if (query.kind === "root") {
    const { snapshot } = query;
    const page = await searchRootBranches({
      identifier: snapshot.identifier,
      includeDiscarded: snapshot.includeDiscarded,
      limit,
      offset,
    }, options);
    return { kind: "root", snapshot, page };
  }
  const { snapshot } = query;
  const page = await searchCommercialGroup({
    groupId: snapshot.groupId,
    includeDiscarded: snapshot.includeDiscarded,
    limit,
    offset,
  }, options);
  return { kind: "group", snapshot, page };
}
