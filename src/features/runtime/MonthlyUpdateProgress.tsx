import type { RuntimeStatusResponse } from "../../types/api";
import type { RuntimeTransportState } from "./runtimeTypes";
import { formatBytes, stageLabel } from "./bootstrapPresentation";
import { updateProgressDetails, updateStageLabel } from "./monthlyUpdatePresentation";

export function MonthlyUpdateProgress({ runtime, transport }: { runtime: RuntimeStatusResponse; transport: RuntimeTransportState }) {
  const { update } = runtime;
  const details = updateProgressDetails(update);
  return <div className="monthly-update-panel__body" role="status" aria-live="polite">
    <p className="monthly-update-panel__stage"><strong>{updateStageLabel(update.stage)}</strong></p>
    {update.target_competence && <p>Competência: {update.target_competence}</p>}
    {transport !== "fresh" && <p className="monthly-update-panel__notice">{transport === "stale" ? "Os dados de progresso estão desatualizados." : "Não foi possível atualizar o progresso agora. Os valores são da última confirmação."}</p>}
    {update.stage === "DOWNLOAD" && <>
      {details.files && <p>Arquivo {details.files[0]} de {details.files[1]}</p>}
      {details.bytes && <div><p>Arquivo atual: {formatBytes(details.bytes[0], "")} de {formatBytes(details.bytes[1], "")}</p><progress aria-label="Progresso do arquivo atual da atualização" value={details.bytes[0]} max={details.bytes[1]} /> <span>{Math.round(details.bytes[0] / details.bytes[1] * 100)}%</span></div>}
    </>}
    {update.stage === "PROCESSING" && <>
      {details.internalStage && <p>Etapa interna: {stageLabel(details.internalStage, "Processando dados")}</p>}
      {details.shards && <p>Shard {details.shards[0]} de {details.shards[1]}</p>}
      {details.items && details.unit && <p>{details.items[0].toLocaleString("pt-BR")} de {details.items[1].toLocaleString("pt-BR")} {details.unit}</p>}
    </>}
    {(update.stage === "LOADING_CANDIDATE" || update.stage === "VALIDATING_CANDIDATE") && details.items && details.unit && <p>{details.items[0].toLocaleString("pt-BR")} de {details.items[1].toLocaleString("pt-BR")} {details.unit}</p>}
  </div>;
}
