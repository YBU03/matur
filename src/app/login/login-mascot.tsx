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
        className={`login-mascot-frame ${pose === "success" ? "login-mascot-success" : "login-mascot-float"}`}
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
            sizes="(max-height: 700px) 104px, 176px"
            className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-300 ${p === pose ? "opacity-100" : "opacity-0"}`}
          />
        ))}
      </div>
      <p
        key={pose}
        role="status"
        aria-live="polite"
        className="login-mascot-message"
      >
        <span className="sr-only">{MASCOT_MESSAGES[pose]}</span>
        <span aria-hidden="true">
          {Array.from(MASCOT_MESSAGES[pose]).map((letter, index) => (
            <span
              key={index}
              className="login-chat-letter"
              style={{ animationDelay: `${index * 18}ms` }}
            >
              {letter}
            </span>
          ))}
        </span>
      </p>
    </div>
  );
}
