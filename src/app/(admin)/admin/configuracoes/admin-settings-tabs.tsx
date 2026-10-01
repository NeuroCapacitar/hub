"use client";

import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type AdminSettingsTab = "perfil" | "certificados" | "plataforma";

const isAdminSettingsTab = (value: string | null): value is AdminSettingsTab =>
  value === "perfil" || value === "certificados" || value === "plataforma";

const settingsTabsListClassName =
  "!h-auto grid w-full grid-cols-2 gap-1 p-1 sm:flex";
const settingsTabsTriggerClassName = "flex-1 py-1.5";

export function AdminSettingsTabs({
  certificates,
  defaultTab,
  platform,
  profile,
}: {
  certificates: ReactNode;
  defaultTab: AdminSettingsTab;
  platform: ReactNode;
  profile: ReactNode;
}): React.JSX.Element {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const urlTab = isAdminSettingsTab(requestedTab) ? requestedTab : defaultTab;
  const [selectedTab, setSelectedTab] = useState(urlTab);

  useEffect(() => {
    setSelectedTab(urlTab);
  }, [urlTab]);

  const updateSelectedTab = (value: string): void => {
    if (!isAdminSettingsTab(value)) {
      return;
    }

    setSelectedTab(value);
    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.set("tab", value);
    const currentUrl = new URL(window.location.href);
    currentUrl.search = nextSearchParams.toString();
    window.history.replaceState(
      null,
      "",
      `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`
    );
  };

  return (
    <Tabs
      className="w-full gap-12"
      onValueChange={updateSelectedTab}
      value={selectedTab}
    >
      <TabsList
        aria-label="Seções das configurações"
        className={settingsTabsListClassName}
      >
        <TabsTrigger className={settingsTabsTriggerClassName} value="perfil">
          Perfil
        </TabsTrigger>
        <TabsTrigger
          className={settingsTabsTriggerClassName}
          value="certificados"
        >
          Certificados
        </TabsTrigger>
        <TabsTrigger
          className={settingsTabsTriggerClassName}
          value="plataforma"
        >
          Plataforma
        </TabsTrigger>
      </TabsList>

      <TabsContent className="mt-0" forceMount value="perfil">
        {profile}
      </TabsContent>
      <TabsContent className="mt-0" forceMount value="certificados">
        {certificates}
      </TabsContent>
      <TabsContent className="mt-0" value="plataforma">
        {platform}
      </TabsContent>
    </Tabs>
  );
}
