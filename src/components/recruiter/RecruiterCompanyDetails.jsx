import { getSafeHttpUrl } from "../../utils/urls";

export default function RecruiterCompanyDetails({ company }) {
  const websiteUrl = getSafeHttpUrl(company.website);
  return (
    <section className="recruiter-company-details" aria-labelledby="company-name">
      <h2 id="company-name">{company.company_name}</h2>
      <dl>
        <div>
          <dt>Website</dt>
          <dd>{websiteUrl ? (
            <a href={websiteUrl} target="_blank" rel="noopener noreferrer">{company.website}</a>
          ) : company.website || "Not provided"}</dd>
        </div>
        <div><dt>Location</dt><dd>{company.location || "Not provided"}</dd></div>
      </dl>
      <h3>Description</h3>
      <p className="recruiter-description">{company.description || "Not provided"}</p>
    </section>
  );
}
