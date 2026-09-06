import { Outlet, useLocation } from "react-router-dom";
import Navigation from "../components/admin/Navigation";
import Sidebar from "../components/admin/Sidebar";
import { ADMIN_ROUTE_TITLES } from "../constants/routes";

function AdminLayout() {
  const location = useLocation();
  const title = ADMIN_ROUTE_TITLES[location.pathname] || "Admin Dashboard";

  return (
    <div className="admin-layout">
      <Sidebar />
      <main className="admin-content" style={styles.content}>
        <Navigation title={title} />
        <Outlet />
      </main>
    </div>
  );
}

const styles = {
  content: {
    minHeight: "100vh",
    background: "#f5f7fb",
    padding: "32px",
  },
};

export default AdminLayout;
