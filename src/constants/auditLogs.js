import { ROLES } from "./roles";

export const AUDIT_ACTION_LABELS = Object.freeze({
  "application.status_changed": "Application status changed",
  "recruiter.provisioned": "Recruiter provisioned",
  "recruiter.invitation_requested": "Recruiter invitation requested",
});
export const AUDIT_ACTOR_ROLES = Object.freeze([ROLES.ADMIN, ROLES.RECRUITER]);
export const AUDIT_PAGE_SIZE = 50;
