import {
  BookOpen01Icon,
  Certificate01Icon,
  HelpCircleIcon,
  Home01Icon,
  Settings01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuLink,
} from "@/components/ui/sidebar";
import type { getStudentCourses } from "@/features/courses/server";
import { route } from "@/lib/routes";

type StudentCourses = Awaited<ReturnType<typeof getStudentCourses>>;

function SettingsItem(): React.JSX.Element {
  return (
    <SidebarMenuItem>
      <SidebarMenuLink
        href={route("/app/configuracoes")}
        tooltip="Configurações"
      >
        <HugeiconsIcon
          aria-hidden="true"
          icon={Settings01Icon}
          size={18}
          strokeWidth={1.5}
        />
        <span>Configurações</span>
      </SidebarMenuLink>
    </SidebarMenuItem>
  );
}

export function StudentNavigation({
  courses,
}: {
  courses: StudentCourses;
}): React.JSX.Element {
  return (
    <>
      <SidebarGroup>
        <SidebarGroupLabel>Menu</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuLink href={route("/app")} tooltip="Início">
                <HugeiconsIcon
                  aria-hidden="true"
                  icon={Home01Icon}
                  size={18}
                  strokeWidth={1.5}
                />
                <span>Início</span>
              </SidebarMenuLink>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuLink
                href={route("/app/certificados")}
                tooltip="Certificados"
              >
                <HugeiconsIcon
                  aria-hidden="true"
                  icon={Certificate01Icon}
                  size={18}
                  strokeWidth={1.5}
                />
                <span>Certificados</span>
              </SidebarMenuLink>
            </SidebarMenuItem>
            <SettingsItem />
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      {courses.length ? (
        <SidebarGroup>
          <SidebarGroupLabel>Meus cursos</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {courses.map((course) => (
                <SidebarMenuItem key={course.courseId}>
                  <SidebarMenuLink
                    className="h-auto py-2"
                    href={route(`/app/cursos/${course.courseId}`)}
                    tooltip={course.title}
                  >
                    <HugeiconsIcon
                      aria-hidden="true"
                      icon={BookOpen01Icon}
                      size={18}
                      strokeWidth={1.5}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{course.title}</span>
                      <span className="block text-muted-foreground text-xs">
                        {course.progressPercent}% concluído
                      </span>
                    </span>
                  </SidebarMenuLink>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ) : null}
      <SidebarGroup>
        <SidebarGroupLabel>Suporte</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuLink href={route("/app/ajuda")} tooltip="Ajuda">
                <HugeiconsIcon
                  aria-hidden="true"
                  icon={HelpCircleIcon}
                  size={18}
                  strokeWidth={1.5}
                />
                <span>Ajuda</span>
              </SidebarMenuLink>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </>
  );
}
