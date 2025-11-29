import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary to catch Slate.js runtime errors
 * Prevents the entire app from crashing when Slate encounters invalid state
 */
export class SlateErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[SlateErrorBoundary] Caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '16px', color: '#ef4444', backgroundColor: '#fee2e2', borderRadius: '4px' }}>
          <strong>编辑器错误</strong>
          <p>编辑器遇到错误，请刷新页面重试</p>
          <details style={{ marginTop: '8px', fontSize: '12px', color: '#991b1b' }}>
            <summary>错误详情</summary>
            <pre style={{ marginTop: '4px', whiteSpace: 'pre-wrap' }}>
              {this.state.error?.toString()}
            </pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}
