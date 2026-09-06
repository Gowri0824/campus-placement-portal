import { APPLICATION_STATUS } from "../../../constants/applicationStatuses";
import { getStatusBadgeStyle } from "./applicationStyles";

export default function ApplicationStatusBadge({ status }) {
  return <span style={getStatusBadgeStyle(status)}>{status || APPLICATION_STATUS.APPLIED}</span>;
}
