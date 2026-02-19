"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { YouTubeEmbed } from "@/components/shared/YouTubeEmbed";

export type GoalFooterItem = {
  scorer: string;
  assists: string[];
  goalTime?: string;
  videoUrl?: string;
};

interface GoalScorersFooterProps {
  items: GoalFooterItem[];
  videoLabel: string;
}

export function GoalScorersFooter({ items, videoLabel }: GoalScorersFooterProps) {
  const [activeVideo, setActiveVideo] = useState<GoalFooterItem | null>(null);

  return (
    <>
      <div className="flex flex-col gap-1 items-start">
        {items.map((goal, i) => (
          <p key={`scorer-${i}`} className="text-xs md:text-sm text-muted-foreground">
            <span className="mr-1">&#127954;</span>
            <span className="font-semibold text-foreground">{goal.scorer}</span>
            {goal.assists.length > 0 && (
              <span className="ml-1 opacity-70">({goal.assists.join(", ")})</span>
            )}
            {goal.goalTime && <span className="ml-2 opacity-80">[{goal.goalTime}]</span>}
            {goal.videoUrl && (
              <Button
                type="button"
                variant="link"
                size="xs"
                data-prevent-card-nav="true"
                className="ml-1 h-auto p-0 text-xs md:text-sm align-baseline"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setActiveVideo(goal);
                }}
              >
                {videoLabel}
              </Button>
            )}
          </p>
        ))}
      </div>

      <Dialog open={Boolean(activeVideo)} onOpenChange={(open) => !open && setActiveVideo(null)}>
        <DialogContent className="w-[96vw] max-w-[96vw] sm:max-w-[96vw] border-0 bg-black p-2 sm:p-3">
          <DialogHeader className="mb-0.5">
            <DialogTitle className="text-sm font-medium text-white/90">
              {videoLabel}
              {activeVideo?.goalTime ? ` [${activeVideo.goalTime}]` : ""}
            </DialogTitle>
          </DialogHeader>
          {activeVideo?.videoUrl && (
            <YouTubeEmbed
              url={activeVideo.videoUrl}
              title={`${activeVideo.scorer} ${activeVideo.goalTime ?? ""}`.trim()}
              rounded={false}
              autoplay
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
