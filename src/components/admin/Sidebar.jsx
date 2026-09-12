import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { ROUTES } from "../../constants/routes";
import { useAuth } from "../../hooks/useAuth";

const menuItems = [
    { label: "Dashboard", path: ROUTES.ADMIN_DASHBOARD },
    { label: "Students", path: ROUTES.ADMIN_STUDENTS },
    { label: "Companies", path: ROUTES.ADMIN_COMPANIES },
    { label: "Recruiters", path: ROUTES.ADMIN_RECRUITERS },
    { label: "Placement Drives", path: ROUTES.ADMIN_DRIVES },
    { label: "Eligible Students", path: ROUTES.ADMIN_ELIGIBLE_STUDENTS },
    { label: "Applications", path: ROUTES.ADMIN_APPLICATIONS },
];

function Sidebar() {
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [logoutError, setLogoutError] = useState("");
    const navigate = useNavigate();
    const { signOut } = useAuth();

    const handleLogout = async () => {
        setLogoutError("");
        setIsLoggingOut(true);

        try {
            await signOut();
            navigate(ROUTES.LOGIN, { replace: true });
        } catch (error) {
            setLogoutError(error.message || "Unable to log out.");
            setIsLoggingOut(false);
        }
    };

    return (
        <aside className="sidebar">

            <h2>Admin Panel</h2>

            <ul>
                {menuItems.map((item) => (
                    <li key={item.label}>
                        {item.path ? (
                            <NavLink
                                to={item.path}
                                style={({ isActive }) => ({
                                    color: isActive ? "#2563eb" : "inherit",
                                    fontWeight: isActive ? 700 : 500,
                                    textDecoration: "none",
                                })}
                            >
                                {item.label}
                            </NavLink>
                        ) : (
                            <span>{item.label}</span>
                        )}
                    </li>
                ))}
                <li>
                    <button
                        type="button"
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        style={styles.logoutButton}
                    >
                        {isLoggingOut ? "Logging out..." : "Logout"}
                    </button>
                </li>
            </ul>

            {logoutError && (
                <p role="alert" style={styles.error}>
                    {logoutError}
                </p>
            )}

        </aside>
    );
}

const styles = {
    logoutButton: {
        border: 0,
        padding: 0,
        background: "transparent",
        color: "#dc2626",
        font: "inherit",
        fontWeight: 700,
        cursor: "pointer",
    },
    error: {
        margin: "12px 0 0",
        color: "#991b1b",
        fontSize: "13px",
        lineHeight: 1.4,
    },
};

export default Sidebar;
