import { Link } from "react-router-dom";
import StatusMessage from "../../components/common/StatusMessage";
import PasswordSetupForm from "../../components/auth/PasswordSetupForm";
import { usePasswordSetup } from "../../hooks/usePasswordSetup";
import { ROUTES } from "../../constants/routes";
import "../../styles/accountProvisioning.css";

export default function PasswordSetup() {
  const state = usePasswordSetup();
  return (
    <main className="password-setup">
      <section>
        <h1>Set Your Password</h1>
        {state.email && <p>{state.email}</p>}
        <StatusMessage type="error">{state.error}</StatusMessage>
        <StatusMessage type="success">{state.saved && "Password saved. Sign out to continue to login."}</StatusMessage>
        {state.isLoading ? <p role="status">Checking invitation...</p> : state.canSave
          ? <PasswordSetupForm state={state} />
          : <p>Open the secure link in your invitation email. If it has expired, contact your administrator.</p>}
        <p><Link to={ROUTES.LOGIN}>Return to Login</Link></p>
      </section>
    </main>
  );
}
