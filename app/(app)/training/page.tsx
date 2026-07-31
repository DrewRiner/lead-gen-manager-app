import { PageHeader } from "@/components/page-header";
import { VideoGuidesList } from "@/components/video-guides-list";

export const metadata = { title: "Training — LeadGen" };
export const dynamic = "force-dynamic";

export default function TrainingPage() {
  return (
    <div>
      <PageHeader
        title="Training"
        description="Setup walkthroughs for the team and VAs — CallRail, Engine Evolve forms, and automations. Watch top to bottom."
      />
      <VideoGuidesList />
    </div>
  );
}
