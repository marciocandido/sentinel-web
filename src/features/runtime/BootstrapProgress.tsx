import type { RuntimeStatusResponse } from "../../types/api";
import type { RuntimeTransportState } from "./runtimeTypes";
import { formatBytes, phaseIndex, progressPair, progressUnitLabel, shardPair, stageLabel } from "./bootstrapPresentation";

const phases = ["Descoberta", "Download", "Processamento", "Carga da base útil", "Validação"];
export function BootstrapProgress({ runtime, transport }: { runtime: RuntimeStatusResponse; transport: RuntimeTransportState }) {
  const { base } = runtime;
  const current = phaseIndex(base);
  const progress = base.progress;
  const bytes = progressPair(progress, "bytes_received", "bytes_total");
  const files = progressPair(progress, "file_index", "file_total");
  const items = progressPair(progress, "completed", "total");
  const shards = shardPair(progress);
  const unit = progressUnitLabel(progress?.unit);
  return <section className="runtime-panel"><h1>Preparando base da Receita</h1>{base.preparing_competence && <p>Competência: {base.preparing_competence}</p>}{transport !== "fresh" && <p role="status">{transport === "stale" ? "Os dados de progresso estão desatualizados." : "Não foi possível atualizar o progresso agora. Os valores abaixo são da última confirmação."}</p>}<ol>{phases.map((phase, index) => <li key={phase}>{phase}: {index < current ? "Concluída" : index === current ? "Em andamento" : "Aguardando"}</li>)}</ol>{base.state === "PROCESSING" && <><p>{stageLabel(base.current_stage, "Processando dados")}</p>{shards && <p>Shard {shards[0]} de {shards[1]}</p>}{items && unit && <p>{items[0].toLocaleString("pt-BR")} de {items[1].toLocaleString("pt-BR")} {unit}</p>}</>}{base.state === "LOADING" && <><p>{stageLabel(base.current_stage, "Carregando base útil")}</p>{items && unit && <p>{items[0].toLocaleString("pt-BR")} de {items[1].toLocaleString("pt-BR")} {unit}</p>}</>}{base.state === "VALIDATING" && <p>Validando base carregada</p>}{base.state === "DOWNLOADING" && <>{files && <p>Arquivo {files[0]} de {files[1]}</p>}{bytes && <><p>Arquivo atual: {formatBytes(bytes[0], "")} de {formatBytes(bytes[1], "")}</p><progress aria-label="Progresso do arquivo atual" value={bytes[0]} max={bytes[1]} /> <span>{Math.round(bytes[0] / bytes[1] * 100)}%</span></>}</>}</section>;
}
