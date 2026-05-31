import { useAuthStore } from "../stores/auth-store";

export function useAuth() {
  const errorMessage = useAuthStore((state) => state.errorMessage);
  const login = useAuthStore((state) => state.login);
  const logout = useAuthStore((state) => state.logout);
  const session = useAuthStore((state) => state.session);
  const status = useAuthStore((state) => state.status);

  return {
    errorMessage,
    isAuthenticated: status === "authenticated",
    isLoading: status === "loading",
    login,
    logout,
    session,
    status,
    username: session?.username ?? null,
  };
}
