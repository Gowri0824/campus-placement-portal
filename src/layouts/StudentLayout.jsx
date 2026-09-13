import { Outlet } from "react-router-dom";
import RouteContent from "../routes/RouteContent";

function StudentLayout() {
  return <RouteContent><Outlet /></RouteContent>;
}

export default StudentLayout;
