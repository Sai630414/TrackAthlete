import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary caught an error]:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset);
      }
      return (
        <div className="p-6 my-4 bg-[#fff3f0] border border-[#efcbc3] rounded-2xl text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-[#e07050] mx-auto" />
          <h3 className="font-bold text-sm text-[#173235]">
            {this.props.title || 'An error occurred while loading this section'}
          </h3>
          <p className="text-xs text-[#526668] max-w-md mx-auto">
            {this.state.error?.message || 'Something went wrong rendering this component.'}
          </p>
          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={this.handleReset}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#194e42] text-white text-xs font-bold hover:bg-[#143d34] transition cursor-pointer shadow-xs"
            >
              <RefreshCw size={12} /> Try Again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#2f6d5a] text-[#194e42] text-xs font-bold hover:bg-[#e2eee4] transition cursor-pointer shadow-xs"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
