import { NavLink, Outlet } from "react-router-dom";
import StatusMessage from "../components/common/StatusMessage";
import { ROUTES } from "../constants/routes";
import { useRecruiterWorkspace } from "../hooks/useRecruiterWorkspace";
import RouteContent from "../routes/RouteContent";
import "../styles/recruiter.css";

export default function RecruiterLayout() {
  const workspace = useRecruiterWorkspace();
  return (
    <div className="recruiter-layout">
      <aside className="recruiter-sidebar">
        <h2>Recruiter Panel</h2>
        <nav aria-label="Recruiter navigation">
          <NavLink to={ROUTES.RECRUITER_DASHBOARD}>Dashboard</NavLink>
          <NavLink to={ROUTES.RECRUITER_COMPANY}>My Company</NavLink>
          <NavLink to={ROUTES.RECRUITER_DRIVES}>Company Drives</NavLink>
          <NavLink to={ROUTES.RECRUITER_APPLICANTS}>Applicants</NavLink>
        </nav>
        <button type="button" onClick={workspace.logout} disabled={workspace.isLoggingOut}>
          {workspace.isLoggingOut ? "Logging out..." : "Logout"}
        </button>
        <StatusMessage type="error">{workspace.error}</StatusMessage>
      </aside>
      <main className="recruiter-content"><RouteContent><Outlet context={workspace} /></RouteContent></main>
    </div>
  );
}
