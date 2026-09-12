import { useRecruiterCompany } from "../../hooks/useRecruiterCompany";
import RecruiterCompanyDetails from "../../components/recruiter/RecruiterCompanyDetails";
import RecruiterCompanyFeedback from "../../components/recruiter/RecruiterCompanyFeedback";

export default function MyCompany() {
  const companyState = useRecruiterCompany();
  return (
    <section className="recruiter-page">
      <header className="recruiter-page-header">
        <h1>My Company</h1>
        <button type="button" onClick={companyState.refresh} disabled={companyState.isLoading}>Reload</button>
      </header>
      <RecruiterCompanyFeedback {...companyState} />
      {companyState.company && <RecruiterCompanyDetails company={companyState.company} />}
    </section>
  );
}
