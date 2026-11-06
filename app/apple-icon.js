import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// The icon: a photo strip with four frames on a dark rounded square.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#111111",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 74,
            height: 148,
            background: "#ffffff",
            borderRadius: 8,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: 8,
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ height: 29, background: "#f25f5c", borderRadius: 3, opacity: 1 - i * 0.18 }} />
          ))}
        </div>
      </div>
    ),
    size
  );
}
