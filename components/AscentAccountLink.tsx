"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchCurrentUser, ASCENT_AUTH_CHANGED, type AscentUser } from "@/lib/ascent-auth-client";

export default function AscentAccountLink() {
  const [user, setUser] = useState<AscentUser | null | undefined>(undefined);

  useEffect(() => {
    function load() {
      fetchCurrentUser()
        .then(setUser)
        .catch(() => setUser(null));
    }
    load();
    window.addEventListener(ASCENT_AUTH_CHANGED, load);
    return () => window.removeEventListener(ASCENT_AUTH_CHANGED, load);
  }, []);

  if (user === undefined) {
    return <span className="ascent-account-link ascent-account-link-pending" />;
  }

  if (user) {
    return (
      <Link
        className="ascent-account-link"
        href="/ascentgames/account"
        title="Your profile"
      >
        {user.displayName}
      </Link>
    );
  }

  return (
    <Link className="ascent-account-link" href="/ascentgames/account">
      Sign in
    </Link>
  );
}
