import { Component, Suspense } from "react";
import { useLocation } from "react-router-dom";
import StatusMessage from "../components/common/StatusMessage";

class RouteErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <StatusMessage type="error">
          <p>Unable to load this page. Check your connection and reload.</p>
          <button type="button" onClick={() => window.location.reload()}>Reload page</button>
        </StatusMessage>
      );
    }
    return this.props.children;
  }
}

export default function RouteContent({ children }) {
  const { pathname } = useLocation();
  return (
    <RouteErrorBoundary key={pathname}>
      <Suspense fallback={<StatusMessage>Loading page...</StatusMessage>}>
        {children}
      </Suspense>
    </RouteErrorBoundary>
  );
}
