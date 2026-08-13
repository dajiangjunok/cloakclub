import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "64px",
          height: "64px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#24334b",
          background: "#ffe58a",
          border: "6px solid #24334b",
          fontSize: "38px",
          fontWeight: 900
        }}
      >
        C
      </div>
    ),
    size
  );
}
