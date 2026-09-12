import { Link } from "react-router-dom";
import { ROUTES } from "../../constants/routes";
import RecruiterCompanyFeedback from "./RecruiterCompanyFeedback";

export default function RecruiterAccountSummary({ fullName, email, companyState }) {
  return (
    <section className="recruiter-account" aria-labelledby="recruiter-account-heading">
      <h2 id="recruiter-account-heading">Account</h2>
      <dl>
        <div><dt>Full Name</dt><dd>{fullName}</dd></div>
        <div><dt>Email</dt><dd>{email}</dd></div>
        <div><dt>Company</dt><dd>{companyState.company
          ? <Link to={ROUTES.RECRUITER_COMPANY}>{companyState.company.company_name}</Link>
          : companyState.isLoading ? "Loading..." : "Unavailable"}</dd></div>
      </dl>
      <RecruiterCompanyFeedback {...companyState} />
    </section>
  );
}
