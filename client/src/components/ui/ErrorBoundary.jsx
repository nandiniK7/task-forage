import { Component } from "react";

/** Last line of defence: a rendering bug shows a recovery screen instead of a blank page. */
export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    console.error("Unhandled UI error:", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-100 px-4 text-center">
        <h1 className="text-xl font-bold text-slate-900">Something went wrong</h1>
        <p className="max-w-md text-sm text-slate-600">An unexpected error occurred. Your data is safe. Reload the page to continue.</p>
        <button type="button" onClick={() => window.location.reload()} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Reload page</button>
      </div>
    );
  }
}
