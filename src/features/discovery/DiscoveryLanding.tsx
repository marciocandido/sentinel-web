import { useEffect, useRef, useState } from "react";
import { SentinelApiError } from "../../services/apiClient";
import {
  searchEstablishmentsByRadius,
  searchEstablishmentsByRegion,
  searchEstablishmentsBySegment,
} from "../../services/sentinelApi";
import type { DiscoveryEstablishment } from "../../types/api";
import { DiscoveryDetailsDrawer } from "./DiscoveryDetailsDrawer";
import { DiscoveryModeSwitcher } from "./DiscoveryModeSwitcher";
import { DiscoveryResults } from "./DiscoveryResults";
import { DiscoverySearchForm } from "./DiscoverySearchForm";
import { RadiusResults } from "./RadiusResults";
import { RadiusSearchForm } from "./RadiusSearchForm";
import {
  EMPTY_FORM,
  type DiscoveryFormValues,
  type DiscoverySearchSnapshot,
  type DiscoveryViewState,
  type SearchMode,
  type ValidationErrors,
} from "./discoveryTypes";
import { createSnapshot, validateSearch } from "./discoveryUtils";
import {
  EMPTY_RADIUS_FORM,
  type RadiusFormValues,
  type RadiusSearchSnapshot,
  type RadiusValidationErrors,
  type RadiusViewState,
} from "./radiusTypes";
import { createRadiusSnapshot, validateRadius } from "./radiusUtils";

type LastRequest =
  | {
      kind: "standard";
      snapshot: DiscoverySearchSnapshot;
      limit: number;
      offset: number;
    }
  | {
      kind: "radius";
      snapshot: RadiusSearchSnapshot;
      limit: number;
      offset: number;
    };

export function DiscoveryLanding() {
  const [mode, setMode] = useState<SearchMode>("segment");
  const [values, setValues] = useState<DiscoveryFormValues>(EMPTY_FORM);
  const [radiusValues, setRadiusValues] =
    useState<RadiusFormValues>(EMPTY_RADIUS_FORM);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [radiusErrors, setRadiusErrors] =
    useState<RadiusValidationErrors>({});
  const [state, setState] = useState<DiscoveryViewState>({ kind: "initial" });
  const [radiusState, setRadiusState] = useState<RadiusViewState>({
    kind: "initial",
  });
  const [limit, setLimit] = useState(50);
  const [selected, setSelected] =
    useState<DiscoveryEstablishment | null>(null);
  const [detailsTrigger, setDetailsTrigger] =
    useState<HTMLElement | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const submittedRef = useRef<DiscoverySearchSnapshot | null>(null);
  const radiusSubmittedRef = useRef<RadiusSearchSnapshot | null>(null);
  const lastRef = useRef<LastRequest | null>(null);

  const beginRequest = () => {
    setSelected(null);
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    return { controller, requestId: ++requestIdRef.current };
  };

  const executeStandard = async (
    snapshot: DiscoverySearchSnapshot,
    requestLimit: number,
    offset: number,
  ) => {
    const { controller, requestId } = beginRequest();
    lastRef.current = {
      kind: "standard",
      snapshot,
      limit: requestLimit,
      offset,
    };
    setState({ kind: "loading" });
    try {
      const page =
        snapshot.mode === "segment"
          ? await searchEstablishmentsBySegment(
              {
                segmentId: snapshot.segmentId,
                uf: snapshot.uf,
                codigoTom: snapshot.codigoTom,
                porteCodigo: snapshot.porteCodigo,
                capitalMin: snapshot.capitalMin,
                capitalMax: snapshot.capitalMax,
                limit: requestLimit,
                offset,
              },
              { signal: controller.signal },
            )
          : await searchEstablishmentsByRegion(
              {
                segmentId: snapshot.segmentId,
                uf: snapshot.uf,
                codigoTom: snapshot.codigoTom,
                codigoIbge: snapshot.codigoIbge,
                municipioNome: snapshot.municipioNome,
                limit: requestLimit,
                offset,
              },
              { signal: controller.signal },
            );
      if (requestId === requestIdRef.current && !controller.signal.aborted) {
        setState({ kind: "success", page });
      }
    } catch (error) {
      if (requestId !== requestIdRef.current || controller.signal.aborted) return;
      const code =
        error instanceof SentinelApiError ? error.code : "network_error";
      if (code !== "request_aborted") setState({ kind: "error", code });
    }
  };

  const executeRadius = async (
    snapshot: RadiusSearchSnapshot,
    requestLimit: number,
    offset: number,
  ) => {
    const { controller, requestId } = beginRequest();
    lastRef.current = {
      kind: "radius",
      snapshot,
      limit: requestLimit,
      offset,
    };
    setRadiusState({ kind: "loading" });
    try {
      const page = await searchEstablishmentsByRadius(
        {
          origin: snapshot.origin,
          radiusKm: snapshot.radiusKm,
          segmentId: snapshot.segmentId,
          resultUf: snapshot.resultUf,
          limit: requestLimit,
          offset,
        },
        { signal: controller.signal },
      );
      if (requestId === requestIdRef.current && !controller.signal.aborted) {
        setRadiusState({ kind: "success", page, snapshot });
      }
    } catch (error) {
      if (requestId !== requestIdRef.current || controller.signal.aborted) return;
      const code =
        error instanceof SentinelApiError ? error.code : "network_error";
      if (code !== "request_aborted") {
        setRadiusState({ kind: "error", code });
      }
    }
  };

  useEffect(
    () => () => {
      requestIdRef.current += 1;
      controllerRef.current?.abort();
    },
    [],
  );

  const changeMode = (next: SearchMode) => {
    if (next === mode) return;
    requestIdRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    submittedRef.current = null;
    radiusSubmittedRef.current = null;
    lastRef.current = null;
    setSelected(null);
    setMode(next);
    setErrors({});
    setRadiusErrors({});
    setState({ kind: "initial" });
    setRadiusState({ kind: "initial" });
  };

  const submit = () => {
    const validation = validateSearch(mode, values);
    setErrors(validation);
    if (Object.keys(validation).length) return;
    const snapshot = createSnapshot(mode, values);
    submittedRef.current = snapshot;
    void executeStandard(snapshot, limit, 0);
  };

  const submitRadius = () => {
    const validation = validateRadius(radiusValues);
    setRadiusErrors(validation);
    if (Object.keys(validation).length) return;
    const snapshot = createRadiusSnapshot(radiusValues);
    radiusSubmittedRef.current = snapshot;
    void executeRadius(snapshot, limit, 0);
  };

  const retry = () => {
    const request = lastRef.current;
    if (!request) return;
    if (request.kind === "radius") {
      void executeRadius(request.snapshot, request.limit, request.offset);
    } else {
      void executeStandard(request.snapshot, request.limit, request.offset);
    }
  };

  const paginate = (direction: -1 | 1) => {
    if (
      mode === "radius" &&
      radiusState.kind === "success" &&
      radiusSubmittedRef.current
    ) {
      const pagination = radiusState.page.pagination;
      if (direction === 1 && !pagination.has_more) return;
      void executeRadius(
        radiusSubmittedRef.current,
        pagination.limit,
        Math.max(0, pagination.offset + direction * pagination.limit),
      );
    } else if (state.kind === "success" && submittedRef.current) {
      const pagination = state.page.pagination;
      if (direction === 1 && !pagination.has_more) return;
      void executeStandard(
        submittedRef.current,
        pagination.limit,
        Math.max(0, pagination.offset + direction * pagination.limit),
      );
    }
  };

  const changeLimit = (next: number) => {
    setLimit(next);
    if (mode === "radius" && radiusSubmittedRef.current) {
      void executeRadius(radiusSubmittedRef.current, next, 0);
    } else if (submittedRef.current) {
      void executeStandard(submittedRef.current, next, 0);
    }
  };

  const openDetails = (item: DiscoveryEstablishment) => {
    if (document.activeElement instanceof HTMLElement) {
      setDetailsTrigger(document.activeElement);
    }
    setSelected(item);
  };

  return (
    <section className="discovery" aria-labelledby="discovery-title">
      <div
        className="discovery-content"
        inert={selected ? true : undefined}
        aria-hidden={selected ? true : undefined}
      >
        <div className="page-intro">
          <p className="eyebrow">Discovery</p>
          <h1 id="discovery-title">Buscar empresas</h1>
          <p>Pesquise por segmento, região ou raio geográfico.</p>
        </div>
        <article className="search-card" aria-labelledby="search-card-title">
          <div>
            <h2 id="search-card-title">Critérios da busca</h2>
            <p className="muted">
              Informe apenas filtros suportados pelo modo selecionado.
            </p>
          </div>
          <div className="discovery-form">
            <DiscoveryModeSwitcher mode={mode} onChange={changeMode} />
          </div>
          {mode === "radius" ? (
            <RadiusSearchForm
              values={radiusValues}
              errors={radiusErrors}
              searching={radiusState.kind === "loading"}
              onChange={(field, value) => {
                setRadiusValues(
                  (current) =>
                    ({ ...current, [field]: value }) as RadiusFormValues,
                );
                setRadiusErrors((current) => ({
                  ...current,
                  [field]: undefined,
                }));
              }}
              onSubmit={submitRadius}
            />
          ) : (
            <DiscoverySearchForm
              mode={mode}
              values={values}
              errors={errors}
              searching={state.kind === "loading"}
              onValueChange={(field, value) => {
                setValues((current) => ({ ...current, [field]: value }));
                setErrors((current) => ({
                  ...current,
                  [field]: undefined,
                  region: undefined,
                }));
              }}
              onSubmit={submit}
            />
          )}
        </article>
        {mode === "radius" ? (
          <RadiusResults
            state={radiusState}
            onRetry={retry}
            onPrevious={() => paginate(-1)}
            onNext={() => paginate(1)}
            onLimitChange={changeLimit}
            onSelect={openDetails}
          />
        ) : (
          <DiscoveryResults
            state={state}
            onRetry={retry}
            onPrevious={() => paginate(-1)}
            onNext={() => paginate(1)}
            onLimitChange={changeLimit}
            onSelectEstablishment={openDetails}
          />
        )}
      </div>
      {selected && (
        <DiscoveryDetailsDrawer
          key={selected.cnpj_full}
          establishment={selected}
          onClose={() => setSelected(null)}
          returnFocusTo={detailsTrigger}
        />
      )}
    </section>
  );
}
