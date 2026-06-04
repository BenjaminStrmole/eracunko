"use client";

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
      className="mt-6 w-full rounded-lg border border-red-500/30 px-4 py-3 text-left text-red-300 hover:bg-red-500/10"
    >
      🚪 Odjava
    </button>
  );
}