import { Component, type ReactNode } from 'react';

export class LandscapeBoundary extends Component<
  { children: ReactNode; fallback: ReactNode; onUnavailable: () => void },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch() {
    this.props.onUnavailable();
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
