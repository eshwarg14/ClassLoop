import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-md w-full bg-surface border border-confusion-danger/30 rounded-2xl p-6 text-center shadow-xl">
            <div className="w-12 h-12 rounded-full bg-confusion-danger/15 text-confusion-danger flex items-center justify-center mx-auto mb-4 border border-confusion-danger/30">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-base font-bold text-foreground font-heading mb-1">
              Observatory Interface Exception
            </h2>
            <p className="text-xs text-muted mb-4 leading-relaxed">
              An unexpected render error occurred in this view.
            </p>
            {this.state.error && (
              <pre className="text-[11px] font-mono text-left bg-raised p-3 rounded-lg overflow-x-auto text-confusion-danger mb-5 border border-border">
                {this.state.error.message}
              </pre>
            )}
            <Button variant="primary" onClick={this.handleReset} className="w-full">
              <RefreshCw className="w-4 h-4 mr-2" />
              Reload View
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
