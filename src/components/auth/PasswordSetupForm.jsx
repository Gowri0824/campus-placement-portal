export default function PasswordSetupForm({ state }) {
  return (
    <form className="provisioning-form" onSubmit={(event) => { event.preventDefault(); state.submit(); }}>
      {!state.saved && <fieldset disabled={state.isSaving}>
        <label>New Password
          <input type="password" autoComplete="new-password" value={state.password} required minLength={8}
            onChange={(event) => state.setPassword(event.target.value)} />
        </label>
        <label>Confirm Password
          <input type="password" autoComplete="new-password" value={state.confirmation} required minLength={8}
            onChange={(event) => state.setConfirmation(event.target.value)} />
        </label>
      </fieldset>}
      <button type="submit" disabled={state.isSaving}>
        {state.isSaving ? "Please wait..." : state.saved ? "Sign Out and Return to Login" : "Set Password"}
      </button>
    </form>
  );
}
