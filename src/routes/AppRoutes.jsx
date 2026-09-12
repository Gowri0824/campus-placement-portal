import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ROLES } from "../constants/roles";
import { ROUTES } from "../constants/routes";
import AdminLayout from "../layouts/AdminLayout";
import StudentLayout from "../layouts/StudentLayout";
import RecruiterLayout from "../layouts/RecruiterLayout";
import AdminDashboard from "../pages/admin/AdminDashboard";
import AuditLogs from "../pages/admin/AuditLogs";
import ApplicationsManagement from "../pages/admin/ApplicationsManagement";
import CompaniesManagement from "../pages/admin/CompaniesManagement";
import EligibleStudents from "../pages/admin/EligibleStudents";
import PlacementDrivesManagement from "../pages/admin/PlacementDrivesManagement";
import StudentsManagement from "../pages/admin/StudentsManagement";
import Login from "../pages/auth/Login";
import Signup from "../pages/auth/Signup";
import RecruiterDashboard from "../pages/recruiter/RecruiterDashboard";
import MyCompany from "../pages/recruiter/MyCompany";
import CompanyDrives from "../pages/recruiter/CompanyDrives";
import RecruiterApplicants from "../pages/recruiter/RecruiterApplicants";
import MyApplications from "../pages/student/MyApplications";
import PlacementDrives from "../pages/student/PlacementDrives";
import Profile from "../pages/student/Profile";
import StudentDashboard from "../pages/student/StudentDashboard";
import ProtectedRoute from "./ProtectedRoute";
import RecruiterManagement from "../pages/admin/RecruiterManagement";
import PasswordSetup from "../pages/auth/PasswordSetup";

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to={ROUTES.LOGIN} replace />} />

        <Route path={ROUTES.LOGIN} element={<Login />} />
        <Route path={ROUTES.SIGNUP} element={<Signup />} />
        <Route path={ROUTES.PASSWORD_SETUP} element={<PasswordSetup />} />

        <Route element={<ProtectedRoute allowedRoles={[ROLES.STUDENT]} />}>
          <Route path={ROUTES.STUDENT_ROOT} element={<StudentLayout />}>
            <Route
              index
              element={<Navigate to={ROUTES.STUDENT_DASHBOARD} replace />}
            />
            <Route path="dashboard" element={<StudentDashboard />} />
            <Route path="profile" element={<Profile />} />
            <Route path="drives" element={<PlacementDrives />} />
            <Route path="applications" element={<MyApplications />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={[ROLES.RECRUITER]} />}>
          <Route path={ROUTES.RECRUITER_ROOT} element={<RecruiterLayout />}>
            <Route index element={<Navigate to={ROUTES.RECRUITER_DASHBOARD} replace />} />
            <Route path="dashboard" element={<RecruiterDashboard />} />
            <Route path="company" element={<MyCompany />} />
            <Route path="drives" element={<CompanyDrives />} />
            <Route path="applicants" element={<RecruiterApplicants />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={[ROLES.ADMIN]} />}>
          <Route path={ROUTES.ADMIN_ROOT} element={<AdminLayout />}>
            <Route
              index
              element={<Navigate to={ROUTES.ADMIN_DASHBOARD} replace />}
            />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="students" element={<StudentsManagement />} />
            <Route path="companies" element={<CompaniesManagement />} />
            <Route path="drives" element={<PlacementDrivesManagement />} />
            <Route path="eligible-students" element={<EligibleStudents />} />
            <Route path="applications" element={<ApplicationsManagement />} />
            <Route path="recruiters" element={<RecruiterManagement />} />
            <Route path="audit-logs" element={<AuditLogs />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to={ROUTES.LOGIN} replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;
