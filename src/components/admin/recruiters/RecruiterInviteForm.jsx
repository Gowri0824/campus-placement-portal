export default function RecruiterInviteForm({ form, companies, disabled, isSaving, onFieldChange, onSubmit }) {
  return (
    <form className="provisioning-form" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
      <h2>Invite Recruiter</h2>
      <fieldset disabled={disabled || isSaving}>
        <label>Full Name
          <input name="fullName" autoComplete="name" value={form.fullName} required maxLength={120}
            onChange={(event) => onFieldChange("fullName", event.target.value)} />
        </label>
        <label>Email
          <input name="email" type="email" autoComplete="email" value={form.email} required maxLength={254}
            onChange={(event) => onFieldChange("email", event.target.value)} />
        </label>
        <label>Company
          <select name="companyId" value={form.companyId} required
            onChange={(event) => onFieldChange("companyId", event.target.value)}>
            <option value="">Select company</option>
            {companies.map((company) => <option key={company.id} value={company.id}>{company.company_name}</option>)}
          </select>
        </label>
      </fieldset>
      <button type="submit" disabled={disabled || isSaving}>{isSaving ? "Inviting..." : "Invite Recruiter"}</button>
    </form>
  );
}
