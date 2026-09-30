import { redirect } from "next/navigation";
import { PanelLayout } from "@/components/panel-layout";
import { StudentNavigation } from "@/components/student-navigation";
import { isPreviewRole } from "@/features/courses/preview";
import { getStudentCourses } from "@/features/courses/server";
import { route } from "@/lib/routes";
import { requireSession } from "@/lib/session";
import { getStudentDashboardGreeting } from "@/lib/student-dashboard-greeting";

export default async function StudentLayout({
  children,
}: Readonly<{ children: React.ReactNode }>): Promise<React.JSX.Element> {
  const session = await requireSession();

  if (!(session.role === "student" || isPreviewRole(session.role))) {
    redirect(route("/admin"));
  }

  const courses =
    session.role === "student" ? await getStudentCourses(session.user.id) : [];
  const studentDashboardGreeting =
    session.role === "student"
      ? getStudentDashboardGreeting(session.user.name)
      : undefined;

  return (
    <PanelLayout
      navContent={<StudentNavigation courses={courses} />}
      {...(studentDashboardGreeting ? { studentDashboardGreeting } : {})}
      userEmail={session.user.email}
      userImage={session.user.image}
      userName={session.user.name}
      userRole={session.role}
    >
      {children}
    </PanelLayout>
  );
}
