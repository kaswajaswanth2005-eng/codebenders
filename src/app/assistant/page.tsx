import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { AssistantPanel } from "@/components/assistant/assistant-panel";
import { getAssistantStatus } from "@/lib/services/assistant";

export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  const status = await getAssistantStatus();
  if (!status.businessExists) redirect("/setup");
  return (
    <AppShell>
      <div className="h-[calc(100dvh-10rem)] min-h-[560px] md:h-[calc(100dvh-3rem)]">
        <AssistantPanel initialStatus={status} />
      </div>
    </AppShell>
  );
}
