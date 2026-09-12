import { useEffect, useState } from "react";
import { useAuth } from "./useAuth";
import { ROLES } from "../constants/roles";
import { fetchAuditLogs } from "../services/auditLogsService";

export function useAuditLogs() {
  const { user, role } = useAuth();
  const profileId = user?.id;
  const canRead = Boolean(profileId && role === ROLES.ADMIN);
  const [request, setRequest] = useState({ action: "", role: "", page: 0, version: 0 });
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!canRead) return;
    let active = true;
    fetchAuditLogs(request).then(
      (data) => { if (active) setResult({ profileId, request, ...data }); },
      (error) => { if (active) setResult({ profileId, request, error: error.message || "Unable to load audit logs." }); },
    );
    return () => { active = false; };
  }, [profileId, canRead, request]);

  const current = canRead && result?.profileId === profileId && result.request === request ? result : null;
  return {
    events: current?.events || [], warning: current?.warning || "", error: current?.error || "",
    isLoading: canRead && !current, hasNext: Boolean(current?.hasNext), filters: request,
    setFilter: (field, value) => {
      if (field === "action" || field === "role") setRequest((previous) => ({ ...previous, [field]: value, page: 0 }));
    },
    previousPage: () => setRequest((previous) => ({ ...previous, page: Math.max(0, previous.page - 1) })),
    nextPage: () => { if (current?.hasNext) setRequest((previous) => ({ ...previous, page: previous.page + 1 })); },
    refresh: () => setRequest((previous) => ({ ...previous, page: 0, version: previous.version + 1 })),
  };
}
