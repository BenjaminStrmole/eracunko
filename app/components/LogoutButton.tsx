"use client";

import { LogOut } from "lucide-react";

export default function LogoutButton() {
  async function handleLogout() {
    await fetch("/api/auth/logout", {
      method: "POST",
    });

    window.location.href = "/login";
  }

  return (
    <button
      onClick={handleLogout}
      className="mt-6 flex w-full items-center gap-3 rounded-2xl border border-red-500/20 px-3.5 py-3 text-left text-sm font-medium text-red-500 hover:bg-red-500/10"
    >
      <LogOut className="h-4.5 w-4.5" aria-hidden="true" />
      Odjava
    </button>
  );
}
