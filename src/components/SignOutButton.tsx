"use client";

import { useRouter } from "next/navigation";

export default function SignOutButton({ redirectTo = "/" }: { redirectTo?: string }) {
  const router = useRouter();
  return (
    <button
      className="btn btn-secondary btn-small"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push(redirectTo);
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
