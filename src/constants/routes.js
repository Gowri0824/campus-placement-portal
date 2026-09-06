import { ROLES } from "./roles";

export const ROUTES = Object.freeze({
  LOGIN: "/login",
  SIGNUP: "/signup",
  STUDENT_ROOT: "/student",
  STUDENT_DASHBOARD: "/student/dashboard",
  STUDENT_PROFILE: "/student/profile",
  STUDENT_DRIVES: "/student/drives",
  STUDENT_APPLICATIONS: "/student/applications",
  ADMIN_ROOT: "/admin",
  ADMIN_DASHBOARD: "/admin/dashboard",
  ADMIN_STUDENTS: "/admin/students",
  ADMIN_COMPANIES: "/admin/companies",
  ADMIN_DRIVES: "/admin/drives",
  ADMIN_ELIGIBLE_STUDENTS: "/admin/eligible-students",
  ADMIN_APPLICATIONS: "/admin/applications",
  RECRUITER_DASHBOARD: "/recruiter/dashboard",
});

export const ROLE_HOME_PATHS = Object.freeze({
  [ROLES.ADMIN]: ROUTES.ADMIN_DASHBOARD,
  [ROLES.STUDENT]: ROUTES.STUDENT_DASHBOARD,
  [ROLES.RECRUITER]: ROUTES.RECRUITER_DASHBOARD,
});

export const ADMIN_ROUTE_TITLES = Object.freeze({
  [ROUTES.ADMIN_DASHBOARD]: "Admin Dashboard",
  [ROUTES.ADMIN_STUDENTS]: "Students Management",
  [ROUTES.ADMIN_COMPANIES]: "Companies Management",
  [ROUTES.ADMIN_DRIVES]: "Placement Drives Management",
  [ROUTES.ADMIN_ELIGIBLE_STUDENTS]: "Eligible Students",
  [ROUTES.ADMIN_APPLICATIONS]: "Applications Management",
});

export function getRoleHomePath(role) {
  return ROLE_HOME_PATHS[role] || null;
}
