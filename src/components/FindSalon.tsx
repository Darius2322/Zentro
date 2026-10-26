"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function FindSalon() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function go(e: React.FormEvent) {
    e.preventDefault();
    // Accept a bare name ("glow-beauty") or a pasted address ending in /b/glow-beauty.
    const match = value.trim().toLowerCase().match(/(?:\/b\/)?([a-z0-9-]+)\/?$/);
    if (!match) {
      setError("Enter the name from your salon's booking address, for example glow-beauty.");
      return;
    }
    setError(null);
    router.push(`/b/${match[1]}`);
  }

  return (
    <form onSubmit={go}>
      {error && <p className="error-banner">{error}</p>}
      <div className="field">
        <label htmlFor="salon-name">Salon booking name</label>
        <input
          id="salon-name"
          type="text"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="glow-beauty"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
        />
        <p className="field-hint">It is the last part of the booking address your salon gave you.</p>
      </div>
      <button className="btn" type="submit">
        Go to booking page
      </button>
    </form>
  );
}
