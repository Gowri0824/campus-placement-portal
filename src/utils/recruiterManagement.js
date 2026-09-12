export { validateRecruiterInvitation } from "../../shared/recruiterInvitation.js";

export function mapRecruiterDirectory(profiles, assignments, companies) {
  const companyById = new Map(companies.map((company) => [company.id, company]));
  const assignmentById = new Map(assignments.map((assignment) => [assignment.profile_id, assignment.company_id]));
  const recruiters = profiles.map((profile) => {
    const company = companyById.get(assignmentById.get(profile.id));
    return { ...profile, company_name: company?.company_name || "Company unavailable", hasCompany: Boolean(company) };
  });
  return { recruiters, warning: recruiters.some((recruiter) => !recruiter.hasCompany)
    ? "Some recruiter assignments or companies are unavailable. Ask the project owner to check their records." : "" };
}
