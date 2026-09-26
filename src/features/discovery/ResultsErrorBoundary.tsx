import { Component, type ReactNode } from "react";

interface ResultsErrorBoundaryProps {
  // Uma nova busca (novo estado/dados) descarta a falha anterior.
  resetKey: unknown;
  fallback: (reset: () => void) => ReactNode;
  children: ReactNode;
}

interface ResultsErrorBoundaryState {
  failed: boolean;
  resetKey: unknown;
}

// Isola falhas de render/efeito da área de resultados ou do mapa para que não
// desmontem shell, sidebar e filtros. O erro continua registrado pelo React.
export class ResultsErrorBoundary extends Component<
  ResultsErrorBoundaryProps,
  ResultsErrorBoundaryState
> {
  state: ResultsErrorBoundaryState = {
    failed: false,
    resetKey: this.props.resetKey,
  };

  static getDerivedStateFromError(): Partial<ResultsErrorBoundaryState> {
    return { failed: true };
  }

  static getDerivedStateFromProps(
    props: ResultsErrorBoundaryProps,
    state: ResultsErrorBoundaryState,
  ): Partial<ResultsErrorBoundaryState> | null {
    return Object.is(props.resetKey, state.resetKey)
      ? null
      : { failed: false, resetKey: props.resetKey };
  }

  reset = () => this.setState({ failed: false });

  render() {
    return this.state.failed
      ? this.props.fallback(this.reset)
      : this.props.children;
  }
}
