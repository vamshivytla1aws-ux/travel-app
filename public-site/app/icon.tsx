import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#e8c878", background: "#07111f", border: "2px solid #b89646", fontSize: 24, fontWeight: 800 }}>JB</div>, size);
}
