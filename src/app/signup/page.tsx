"use client";

import { SignupForm } from "@/components/signup-form";
import logo from "../../../public/Gemini_Generated_Image_dq88xxdq88xxdq88.webp";
import Image from "next/image";

export default function SignupPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <a href="#" className="flex items-center gap-2 self-center font-medium">
          <div className="flex size-6 items-center justify-center rounded-md text-primary-foreground">
            <Image
              src={logo}
              alt="Janitorial Appointment logo"
              className="w-full h-full"
            />
          </div>
          Mail Pilot.
          <br /> by Janitorial Appointment
        </a>
        <SignupForm />
      </div>
    </div>
  );
}
