"use client";

import Image from "next/image";

export type MascotPose = "welcome" | "focus" | "password" | "success";
export const MASCOT_MESSAGES: Record<MascotPose, string> = {
  welcome: "Sugeng rawuh! 👋 Monggo, isi username dan password dulu yaa 😊",
  focus: "Isi username-mu dulu yaa 😊",
  password: "Tenang, rahasiamu aman! 🔒",
  success: "Matur nuwun! Sugeng makarya! 🎉",
};

export function LoginMascot({ pose }: { pose: MascotPose }) {
  return (
    <div className="login-mascot-area text-center" data-pose={pose}>
      <div
        className={`login-mascot-frame mx-auto ${pose === "success" ? "login-mascot-success" : "login-mascot-float"}`}
        aria-hidden="true"
      >
        {(["welcome", "focus", "password", "success"] as const).map((p) => (
          <Image
            key={p}
            src={`/mascot/login/matur-${p}.webp`}
            alt=""
            width={320}
            height={320}
            priority={p === "welcome"}
            loading={p === "welcome" ? undefined : "eager"}
            onError={(event) => {
              event.currentTarget.style.visibility = "hidden";
            }}
            sizes="(max-height: 700px) 104px, 192px"
            className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ${p === pose ? "opacity-100" : "opacity-0"}`}
          />
        ))}
      </div>
      <p
        key={pose}
        role="status"
        aria-live="polite"
        className="login-mascot-message mx-auto mt-3 flex min-h-16 max-w-sm items-center justify-center rounded-2xl border border-matur-200 bg-white px-4 py-2 text-sm leading-relaxed text-kopi-900 shadow-sm"
      >
        {MASCOT_MESSAGES[pose]}
      </p>
    </div>
  );
}
