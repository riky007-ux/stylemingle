"use client";

import { useRef } from "react";

export default function WardrobePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    await fetch("/api/wardrobe/upload", {
      method: "POST",
      body: formData,
    });

    alert("Upload request sent");
  }

  async function handleChooseFromLibrary() {
    const res = await fetch("/api/wardrobe/items");
    const data = await res.json();
    console.log("Wardrobe items:", data);
    alert(`Fetched ${data.length ?? 0} items`);
  }

  return (
    <div style={{ padding: "24px" }}>
      <h1>Wardrobe</h1>

      <div style={{ marginTop: "16px" }}>
        <button onClick={handleUploadClick}>
          Upload New Item
        </button>

        <button
          onClick={handleChooseFromLibrary}
          style={{ marginLeft: "12px" }}
        >
          Choose from Library
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />
    </div>
  );
}
