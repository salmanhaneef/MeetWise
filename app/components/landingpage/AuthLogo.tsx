import Image from "next/image";

export default function AuthLogo() {
  return (
    <div className="flex items-center gap-2">
      <Image
        src="/meetwise-logo.png"
        alt="MeetWise Logo"
        width={28}
        height={28}
      />
      <span className="text-white text-lg font-semibold">
        MeetWise
      </span>
    </div>
  );
}
