import { useCallback, useEffect, useRef, useState } from "react";
import { SentinelApiError } from "../../services/apiClient";
import {
  searchEstablishmentsByRegion,
  searchEstablishmentsBySegment,
} from "../../services/sentinelApi";
import { DiscoveryResults } from "./DiscoveryResults";
import { DiscoverySearchForm } from "./DiscoverySearchForm";
import {
  EMPTY_FORM,
  type DiscoveryFormValues,
  type DiscoverySearchSnapshot,
  type DiscoveryViewState,
  type SearchMode,
  type ValidationErrors,
} from "./discoveryTypes";
import { createSnapshot, validateSearch } from "./discoveryUtils";
import type { DiscoveryEstablishment } from "../../types/api";
import { DiscoveryDetailsDrawer } from "./DiscoveryDetailsDrawer";

export function DiscoveryLanding() {
  const [mode, setMode] = useState<SearchMode>("segment");
  const [values, setValues] = useState<DiscoveryFormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [state, setState] = useState<DiscoveryViewState>({ kind: "initial" });
  const [limit, setLimit] = useState(50);
  const [selectedEstablishment, setSelectedEstablishment] = useState<DiscoveryEstablishment | null>(null);
  const [detailsTrigger, setDetailsTrigger] = useState<HTMLElement | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const submittedRef = useRef<DiscoverySearchSnapshot | null>(null);
  const lastRequestRef = useRef<{ snapshot: DiscoverySearchSnapshot; limit: number; offset: number } | null>(null);

  const execute = useCallback(async (snapshot: DiscoverySearchSnapshot, requestLimit: number, offset: number) => {
    setSelectedEstablishment(null);
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const requestId = ++requestIdRef.current;
    lastRequestRef.current = { snapshot, limit: requestLimit, offset };
    setState({ kind: "loading" });

    try {
      const page = snapshot.mode === "segment"
        ? await searchEstablishmentsBySegment({
            segmentId: snapshot.segmentId,
            uf: snapshot.uf,
            codigoTom: snapshot.codigoTom,
            porteCodigo: snapshot.porteCodigo,
            capitalMin: snapshot.capitalMin,
            capitalMax: snapshot.capitalMax,
            limit: requestLimit,
            offset,
          }, { signal: controller.signal })
        : await searchEstablishmentsByRegion({
            segmentId: snapshot.segmentId,
            uf: snapshot.uf,
            codigoTom: snapshot.codigoTom,
            codigoIbge: snapshot.codigoIbge,
            municipioNome: snapshot.municipioNome,
            limit: requestLimit,
            offset,
          }, { signal: controller.signal });
      if (requestId === requestIdRef.current && !controller.signal.aborted) {
        setState({ kind: "success", page });
      }
    } catch (error) {
      if (requestId !== requestIdRef.current || controller.signal.aborted) return;
      const code = error instanceof SentinelApiError ? error.code : "network_error";
      if (code !== "request_aborted") setState({ kind: "error", code });
    }
  }, []);

  useEffect(() => () => {
    requestIdRef.current += 1;
    controllerRef.current?.abort();
  }, []);

  const changeMode = (nextMode: SearchMode) => {
    if (nextMode === mode) return;
    requestIdRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    submittedRef.current = null;
    lastRequestRef.current = null;
    setSelectedEstablishment(null);
    setMode(nextMode);
    setErrors({});
    setState({ kind: "initial" });
  };

  const changeValue = (field: keyof DiscoveryFormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined, region: undefined }));
  };

  const submit = () => {
    const validation = validateSearch(mode, values);
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;
    const snapshot = createSnapshot(mode, values);
    submittedRef.current = snapshot;
    void execute(snapshot, limit, 0);
  };

  const retry = () => {
    const request = lastRequestRef.current;
    if (request) void execute(request.snapshot, request.limit, request.offset);
  };

  const previous = () => {
    if (state.kind !== "success" || !submittedRef.current) return;
    const { pagination } = state.page;
    void execute(submittedRef.current, pagination.limit, Math.max(0, pagination.offset - pagination.limit));
  };

  const next = () => {
    if (state.kind !== "success" || !submittedRef.current || !state.page.pagination.has_more) return;
    const { pagination } = state.page;
    void execute(submittedRef.current, pagination.limit, pagination.offset + pagination.limit);
  };

  const changeLimit = (nextLimit: number) => {
    setLimit(nextLimit);
    if (submittedRef.current) void execute(submittedRef.current, nextLimit, 0);
  };

  const openDetails = (establishment: DiscoveryEstablishment) => {
    if (document.activeElement instanceof HTMLElement) {
      setDetailsTrigger(document.activeElement);
    }
    setSelectedEstablishment(establishment);
  };

  const closeDetails = useCallback(() => {
    setSelectedEstablishment(null);
  }, []);

  return (
    <section className="discovery" aria-labelledby="discovery-title">
      <div
        className="discovery-content"
        inert={selectedEstablishment ? true : undefined}
        aria-hidden={selectedEstablishment ? true : undefined}
      >
        <div className="page-intro">
          <p className="eyebrow">Discovery</p>
          <h1 id="discovery-title">Buscar empresas</h1>
          <p>Pesquise a base do Sentinel por segmento ou por critérios regionais.</p>
        </div>

        <article className="search-card" aria-labelledby="search-card-title">
          <div>
            <h2 id="search-card-title">Critérios da busca</h2>
            <p className="muted">Informe apenas filtros suportados pelo modo selecionado.</p>
          </div>
          <DiscoverySearchForm
            mode={mode}
            values={values}
            errors={errors}
            searching={state.kind === "loading"}
            onModeChange={changeMode}
            onValueChange={changeValue}
            onSubmit={submit}
          />
        </article>
        <DiscoveryResults
          state={state}
          onRetry={retry}
          onPrevious={previous}
          onNext={next}
          onLimitChange={changeLimit}
          onSelectEstablishment={openDetails}
        />
      </div>
      {selectedEstablishment && (
        <DiscoveryDetailsDrawer
          establishment={selectedEstablishment}
          onClose={closeDetails}
          returnFocusTo={detailsTrigger}
        />
      )}
    </section>
  );
}
