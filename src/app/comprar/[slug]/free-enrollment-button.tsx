"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { enrollFreeCourseAction } from "@/app/(student)/app/actions";
import { Button } from "@/components/ui/button";

export function FreeEnrollmentButton({
  className,
  courseId,
}: {
  className?: string;
  courseId: string;
}): React.JSX.Element {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        const formData = new FormData(event.currentTarget);

        startTransition(async () => {
          const result = await enrollFreeCourseAction(formData);
          if (result.ok) {
            router.push(`/app/cursos/${result.courseId}`);
            return;
          }
          setError(result.message);
        });
      }}
    >
      <input name="courseId" type="hidden" value={courseId} />
      <Button className="w-full" loading={isPending} type="submit">
        Inscrever-se gratuitamente
      </Button>
      {error ? (
        <p className="mt-3 text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
