import { formatDate } from "../../utils/dates";
import { canPreviewApplicantResume } from "../../utils/recruiterApplicants";

export default function RecruiterApplicantDetails({ application, resume }) {
  const student = application.student;
  if (!student) return <p className="recruiter-muted">Student details are unavailable or no longer authorized.</p>;
  const opening = resume.openingStudentId === student.id;
  const fields = [
    ["Full Name", student.full_name], ["Email", student.email], ["Roll Number", student.roll_number],
    ["Branch", student.branch], ["CGPA", student.cgpa], ["Graduation Year", student.graduation_year],
    ["Skills", student.skills], ["Applied", formatDate(application.applied_at)],
  ];
  return (
    <div className="recruiter-applicant-details" id={`applicant-details-${application.id}`}>
      <h3>Applicant Details</h3>
      <dl>{fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? "Not available"}{value === "" && "Not available"}</dd></div>)}</dl>
      {!student.resume_path ? <p className="recruiter-muted">Resume not available</p>
        : !canPreviewApplicantResume(application) ? <p className="recruiter-muted">Resume access is unavailable for this application status.</p>
          : <a href={resume.studentId === student.id ? resume.access?.url || "#" : "#"}
            target="_blank" rel="noopener noreferrer" aria-disabled={Boolean(resume.openingStudentId)}
            onClick={(event) => resume.openResume(application, event)}>{opening ? "Opening resume..." : "View Resume"}</a>}
    </div>
  );
}
