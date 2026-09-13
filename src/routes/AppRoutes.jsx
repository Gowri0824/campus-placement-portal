import { lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ROLES } from "../constants/roles";
import { ROUTES } from "../constants/routes";
import AdminLayout from "../layouts/AdminLayout";
import StudentLayout from "../layouts/StudentLayout";
import RecruiterLayout from "../layouts/RecruiterLayout";
import Login from "../pages/auth/Login";
import ProtectedRoute from "./ProtectedRoute";
import RouteContent from "./RouteContent";

// Login stays eager; feature code loads only after its route passes the role guard.
const AdminDashboard = lazy(() => import("../pages/admin/AdminDashboard"));
const AuditLogs = lazy(() => import("../pages/admin/AuditLogs"));
const ApplicationsManagement = lazy(() => import("../pages/admin/ApplicationsManagement"));
const CompaniesManagement = lazy(() => import("../pages/admin/CompaniesManagement"));
const EligibleStudents = lazy(() => import("../pages/admin/EligibleStudents"));
const PlacementDrivesManagement = lazy(() => import("../pages/admin/PlacementDrivesManagement"));
const StudentsManagement = lazy(() => import("../pages/admin/StudentsManagement"));
const RecruiterManagement = lazy(() => import("../pages/admin/RecruiterManagement"));
const Signup = lazy(() => import("../pages/auth/Signup"));
const PasswordSetup = lazy(() => import("../pages/auth/PasswordSetup"));
const RecruiterDashboard = lazy(() => import("../pages/recruiter/RecruiterDashboard"));
const MyCompany = lazy(() => import("../pages/recruiter/MyCompany"));
const CompanyDrives = lazy(() => import("../pages/recruiter/CompanyDrives"));
const RecruiterApplicants = lazy(() => import("../pages/recruiter/RecruiterApplicants"));
const MyApplications = lazy(() => import("../pages/student/MyApplications"));
const PlacementDrives = lazy(() => import("../pages/student/PlacementDrives"));
const Profile = lazy(() => import("../pages/student/Profile"));
const StudentDashboard = lazy(() => import("../pages/student/StudentDashboard"));

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to={ROUTES.LOGIN} replace />} />

        <Route path={ROUTES.LOGIN} element={<Login />} />
        <Route path={ROUTES.SIGNUP} element={<RouteContent><Signup /></RouteContent>} />
        <Route path={ROUTES.PASSWORD_SETUP} element={<RouteContent><PasswordSetup /></RouteContent>} />

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
