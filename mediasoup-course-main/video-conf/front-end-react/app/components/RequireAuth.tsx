import { useLocation, useNavigate } from "react-router";
import { useAuth } from "./AuthProvider";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const from = location.state?.from?.pathname || "/login";

  if (!auth.user) {
    navigate(from, { replace: true });
  }
  return children;
}
