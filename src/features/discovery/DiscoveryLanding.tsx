import { Bookmark, ListChecks } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSegmentCatalog } from "../../components/segmentCatalog";
import { SentinelApiError } from "../../services/apiClient";
import type { SavedSearch } from "../../services/sentinelApi";
import type { DiscoveryEstablishment } from "../../types/api";
import { createCommercialGroupSnapshot, validateCommercialGroup } from "./commercialGroupUtils";
import { EMPTY_COMMERCIAL_GROUP_FORM } from "./commercialGroupTypes";
import { DiscoveryCriteria, type CriteriaErrors } from "./DiscoveryCriteria";
import { DiscoveryDetailsDrawer } from "./DiscoveryDetailsDrawer";
import {
  draftChanges,
  draftQueryKind,
  submittedFormValues,
  submittedSpec,
} from "./discoveryQuery";
import { DiscoveryResultsArea } from "./DiscoveryResultsArea";
import {
  EMPTY_FORM,
  type DiscoveryDraft,
  type DiscoveryFamily,
  type DiscoverySubmission,
  type QueryKind,
  type ResultsState,
  type SubmittedQuery,
} from "./discoveryTypes";
import { createFilteredSnapshot, validateFilters } from "./discoveryUtils";
import { EMPTY_NEIGHBORS_FORM } from "./neighborsTypes";
import { createNeighborsSnapshot, validateNeighbors } from "./neighborsUtils";
import { EMPTY_RADIUS_FORM, type RadiusFormValues } from "./radiusTypes";
import { createRadiusSnapshot, validateRadius } from "./radiusUtils";
import { EMPTY_ROOT_BRANCHES_FORM, type RootBranchesFormValues } from "./rootBranchesTypes";
import { createRootBranchesSnapshot, validateRootBranches } from "./rootBranchesUtils";
import { runDiscoveryQuery } from "./runDiscoveryQuery";
import { SavedSearchesDrawer } from "./SavedSearchesDrawer";
import { savedSearchKindLabel, type EditableDiscoverySearch } from "./savedSearches";
import { useDiscoveryExport } from "./useDiscoveryExport";
import { NARROW_VIEWPORT_QUERY, useMediaQuery } from "./useMediaQuery";
import { WorklistsPanel } from "./WorklistsPanel";

interface SelectedContext {
  establishment: DiscoveryEstablishment;
  includeDiscarded: boolean;
}

export type DiscoveryLifecycleError =
  | "base_setup_required"
  | "base_initializing"
  | "base_unavailable";

export interface DiscoveryLandingProps {
  onLifecycleError?: (code: DiscoveryLifecycleError) => void;
}

const isLifecycleError = (code: string): code is DiscoveryLifecycleError =>
  code === "base_setup_required" ||
  code === "base_initializing" ||
  code === "base_unavailable";

const INITIAL_DRAFT: DiscoveryDraft = {
  family: "filters",
  proximityType: "radius",
  structureType: "root",
  filters: EMPTY_FORM,
  radius: EMPTY_RADIUS_FORM,
  neighbors: EMPTY_NEIGHBORS_FORM,
  root: EMPTY_ROOT_BRANCHES_FORM,
  group: EMPTY_COMMERCIAL_GROUP_FORM,
  includeDiscarded: false,
};

/** Valida o rascunho do tipo visível e produz a consulta imutável a submeter. */
function buildQuery(kind: QueryKind, draft: DiscoveryDraft): { errors: CriteriaErrors; query: SubmittedQuery | null } {
  const include = draft.includeDiscarded;
  if (kind === "filtered") {
    const errors = validateFilters(draft.filters);
    return Object.keys(errors).length
      ? { errors: { filtered: errors }, query: null }
      : { errors: {}, query: { kind, snapshot: createFilteredSnapshot(draft.filters, include) } };
  }
  if (kind === "radius") {
    const errors = validateRadius(draft.radius);
    return Object.keys(errors).length
      ? { errors: { radius: errors }, query: null }
      : { errors: {}, query: { kind, snapshot: createRadiusSnapshot(draft.radius, include) } };
  }
  if (kind === "neighbors") {
    const errors = validateNeighbors(draft.neighbors);
    return Object.keys(errors).length
      ? { errors: { neighbors: errors }, query: null }
      : { errors: {}, query: { kind, snapshot: createNeighborsSnapshot(draft.neighbors, include) } };
  }
  if (kind === "root") {
    const errors = validateRootBranches(draft.root);
    return Object.keys(errors).length
      ? { errors: { root: errors }, query: null }
      : { errors: {}, query: { kind, snapshot: createRootBranchesSnapshot(draft.root, include) } };
  }
  const errors = validateCommercialGroup(draft.group);
  return Object.keys(errors).length
    ? { errors: { group: errors }, query: null }
    : { errors: {}, query: { kind, snapshot: createCommercialGroupSnapshot(draft.group, include) } };
}

/** Aplica ao rascunho os valores editáveis equivalentes a uma definição. */
function applyEditable(draft: DiscoveryDraft, editable: EditableDiscoverySearch): DiscoveryDraft {
  const next = { ...draft, includeDiscarded: editable.includeDiscarded };
  if (editable.mode === "filtered") return { ...next, family: "filters", filters: editable.values };
  if (editable.mode === "radius") return { ...next, family: "proximity", proximityType: "radius", radius: editable.values };
  if (editable.mode === "neighbors") return { ...next, family: "proximity", proximityType: "neighbors", neighbors: editable.values };
  if (editable.mode === "root") return { ...next, family: "structure", structureType: "root", root: editable.values };
  return { ...next, family: "structure", structureType: "group", group: editable.values };
}

export function DiscoveryLanding({ onLifecycleError }: DiscoveryLandingProps) {
  const catalog = useSegmentCatalog();
  const narrow = useMediaQuery(NARROW_VIEWPORT_QUERY);
  const [draft, setDraft] = useState<DiscoveryDraft>(INITIAL_DRAFT);
  const [errors, setErrors] = useState<CriteriaErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [submission, setSubmission] = useState<DiscoverySubmission | null>(null);
  const [results, setResults] = useState<ResultsState>({ kind: "initial" });
  const [succeededId, setSucceededId] = useState<number | null>(null);
  const [limit, setLimit] = useState(50);
  const [selected, setSelected] = useState<SelectedContext | null>(null);
  const [detailsTrigger, setDetailsTrigger] = useState<HTMLElement | null>(null);
  const [savedOpen, setSavedOpen] = useState(false);
  const [savedTrigger, setSavedTrigger] = useState<HTMLElement | null>(null);
  const [worklistsOpen, setWorklistsOpen] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const submissionIdRef = useRef(0);
  const submissionRef = useRef<DiscoverySubmission | null>(null);
  const lastRequestRef = useRef<{ limit: number; offset: number }>({ limit: 50, offset: 0 });
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);
  const focusResultsPendingRef = useRef(false);
  const discoveryExport = useDiscoveryExport();

  const abortInFlight = () => {
    requestIdRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
  };

  /** Executa sempre uma consulta submetida; nunca lê o formulário. */
  const execute = async (target: DiscoverySubmission, requestLimit: number, offset: number) => {
    setSelected(null);
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const requestId = ++requestIdRef.current;
    lastRequestRef.current = { limit: requestLimit, offset };
    setResults({ kind: "loading" });
    try {
      const result = await runDiscoveryQuery(target.query, requestLimit, offset, controller.signal);
      if (requestId === requestIdRef.current && !controller.signal.aborted) {
        setResults({ kind: "success", result });
        setSucceededId(target.id);
      }
    } catch (error) {
      if (requestId !== requestIdRef.current || controller.signal.aborted) return;
      const code = error instanceof SentinelApiError ? error.code : "network_error";
      if (isLifecycleError(code)) {
        setResults({ kind: "initial" });
        onLifecycleError?.(code);
      } else if (code !== "request_aborted") {
        setResults({ kind: "error", code });
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

  useEffect(() => {
    if (!focusResultsPendingRef.current || results.kind === "loading") return;
    focusResultsPendingRef.current = false;
    resultsHeadingRef.current?.focus();
  }, [results.kind]);

  const submitQuery = (query: SubmittedQuery) => {
    const next: DiscoverySubmission = {
      id: ++submissionIdRef.current,
      query,
      spec: submittedSpec(query),
      submittedAt: new Date(),
    };
    discoveryExport.cancel();
    submissionRef.current = next;
    setSubmission(next);
    setNotice(null);
    void execute(next, limit, 0);
  };

  const submit = () => {
    const { errors: validation, query } = buildQuery(draftQueryKind(draft), draft);
    setErrors(validation);
    if (query) submitQuery(query);
  };

  const changeFamily = (family: DiscoveryFamily) => {
    if (family === draft.family) return;
    // Trocar de família não busca; só aborta a request em voo da consulta submetida.
    if (results.kind === "loading") {
      abortInFlight();
      setResults({ kind: "cancelled" });
    }
    setDraft((current) => ({ ...current, family }));
  };

  const retry = () => {
    const target = submissionRef.current;
    if (!target) return;
    void execute(target, lastRequestRef.current.limit, lastRequestRef.current.offset);
  };

  const paginate = (direction: -1 | 1) => {
    const target = submissionRef.current;
    if (results.kind !== "success" || !target) return;
    const pagination = results.result.page.pagination;
    if (direction === 1 && !pagination.has_more) return;
    void execute(target, pagination.limit, Math.max(0, pagination.offset + direction * pagination.limit));
  };

  const changeLimit = (next: number) => {
    setLimit(next);
    if (submissionRef.current) void execute(submissionRef.current, next, 0);
  };

  const undo = () => {
    if (!submission) return;
    const editable = submittedFormValues(submission);
    if (!editable) return;
    setDraft((current) => applyEditable(current, editable));
    setErrors({});
  };

  const openDetails = (item: DiscoveryEstablishment) => {
    if (document.activeElement instanceof HTMLElement) setDetailsTrigger(document.activeElement);
    setSelected({
      establishment: item,
      includeDiscarded: submissionRef.current?.query.snapshot.includeDiscarded ?? false,
    });
  };

  const openRootBranchesFromDrawer = (establishment: DiscoveryEstablishment, includeDiscarded: boolean) => {
    const values: RootBranchesFormValues = { identifierKind: "cnpj", identifierValue: establishment.cnpj_full };
    setSelected(null);
    setDraft((current) => ({ ...current, family: "structure", structureType: "root", root: values, includeDiscarded }));
    setErrors({});
    focusResultsPendingRef.current = true;
    submitQuery({ kind: "root", snapshot: createRootBranchesSnapshot(values, includeDiscarded) });
  };

  const openSavedSearches = () => {
    if (document.activeElement instanceof HTMLElement) setSavedTrigger(document.activeElement);
    setSavedOpen(true);
  };

  const closeSavedSearches = useCallback(() => setSavedOpen(false), []);

  const loadSavedSearch = (editable: EditableDiscoverySearch, item: SavedSearch) => {
    setDraft((current) => applyEditable(current, editable));
    setErrors({});
    setSavedOpen(false);
    setNotice(`Critérios de “${item.name}” (${savedSearchKindLabel[item.search.kind]}) carregados. Revise e clique em Buscar; a pesquisa salva não é alterada.`);
  };

  const changes = draftChanges(draft, submission, catalog.nameOf);
  const otherKindVisible = submission !== null && draftQueryKind(draft) !== submission.query.kind;
  const overlayOpen = selected !== null || savedOpen;

  return (
    <section className="discovery" aria-labelledby="discovery-title">
      <div
        className="discovery-content"
        inert={overlayOpen ? true : undefined}
        aria-hidden={overlayOpen ? true : undefined}
      >
        <div className="page-intro">
          <div className="page-intro__text">
            <h1 id="discovery-title">Buscar empresas</h1>
            <p className="page-intro__hint">
              Descubra estabelecimentos na base pública de CNPJ por filtros, proximidade ou estrutura.
            </p>
          </div>
          <div className="page-intro__actions" role="group" aria-label="Pesquisas salvas e listas">
            <button
              type="button"
              className="toolbar-action"
              aria-haspopup="dialog"
              aria-expanded={savedOpen}
              aria-controls="saved-searches-panel"
              onClick={openSavedSearches}
            >
              <Bookmark aria-hidden="true" size={16} />
              <span>Pesquisas salvas</span>
            </button>
            <button
              type="button"
              className={`toolbar-action ${worklistsOpen ? "toolbar-action--active" : ""}`}
              aria-expanded={worklistsOpen}
              aria-controls="worklists-panel"
              onClick={() => setWorklistsOpen((current) => !current)}
            >
              <ListChecks aria-hidden="true" size={16} />
              <span>Listas de trabalho</span>
            </button>
          </div>
        </div>
        <DiscoveryCriteria
          draft={draft}
          errors={errors}
          changes={changes}
          searching={results.kind === "loading"}
          catalog={catalog}
          notice={notice}
          onFamilyChange={changeFamily}
          onProximityTypeChange={(proximityType) => setDraft((current) => ({ ...current, proximityType }))}
          onStructureTypeChange={(structureType) => setDraft((current) => ({ ...current, structureType }))}
          onFiltersChange={(field, value) => {
            setDraft((current) => ({ ...current, filters: { ...current.filters, [field]: value } }));
            setErrors((current) => ({ ...current, filtered: { ...current.filtered, [field]: undefined, filters: undefined } }));
          }}
          onRadiusChange={(field, value) => {
            setDraft((current) => ({ ...current, radius: { ...current.radius, [field]: value } as RadiusFormValues }));
            setErrors((current) => ({ ...current, radius: { ...current.radius, [field]: undefined } }));
          }}
          onNeighborsChange={(field, value) => {
            setDraft((current) => ({ ...current, neighbors: { ...current.neighbors, [field]: value } }));
            setErrors((current) => ({ ...current, neighbors: { ...current.neighbors, [field]: undefined } }));
          }}
          onRootChange={(field, value) => {
            setDraft((current) => ({ ...current, root: { ...current.root, [field]: value } }));
            setErrors((current) => ({ ...current, root: {} }));
          }}
          onGroupChange={(field, value) => {
            setDraft((current) => ({ ...current, group: { ...current.group, [field]: value } }));
            setErrors((current) => ({ ...current, group: {} }));
          }}
          onIncludeDiscardedChange={(includeDiscarded) => setDraft((current) => ({ ...current, includeDiscarded }))}
          onUndo={undo}
          onSubmit={submit}
        />
        <WorklistsPanel
          search={null}
          generation={0}
          open={worklistsOpen}
          panelId="worklists-panel"
        />
        <DiscoveryResultsArea
          submission={submission}
          results={results}
          actionsAvailable={submission !== null && succeededId === submission.id}
          changes={changes}
          otherKindVisible={otherKindVisible}
          narrow={narrow}
          segmentName={catalog.nameOf}
          focusRef={resultsHeadingRef}
          exportState={discoveryExport.state}
          onExport={(format, search) => void discoveryExport.start(format, search)}
          onUndo={undo}
          onSearchWithChanges={submit}
          onRetry={retry}
          onPrevious={() => paginate(-1)}
          onNext={() => paginate(1)}
          onLimitChange={changeLimit}
          onSelect={openDetails}
          onOpenSavedSearches={openSavedSearches}
          onOpenWorklists={() => setWorklistsOpen(true)}
        />
      </div>
      {selected && (
        <DiscoveryDetailsDrawer
          key={selected.establishment.cnpj_full}
          establishment={selected.establishment}
          includeDiscarded={selected.includeDiscarded}
          onClose={() => setSelected(null)}
          onOpenRootBranches={openRootBranchesFromDrawer}
          returnFocusTo={detailsTrigger}
        />
      )}
      {savedOpen && (
        <SavedSearchesDrawer
          onClose={closeSavedSearches}
          onLoad={loadSavedSearch}
          returnFocusTo={savedTrigger}
          segmentName={catalog.nameOf}
        />
      )}
    </section>
  );
}
