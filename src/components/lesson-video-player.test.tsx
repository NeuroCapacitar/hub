/**
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LessonVideoPlayer } from "./lesson-video-player";

const {
  recordLessonWatchProgressAction,
  replace,
  refresh,
  startLessonWatchSessionAction,
} = vi.hoisted(() => ({
  recordLessonWatchProgressAction: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  startLessonWatchSessionAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));
vi.mock("@/app/(student)/app/actions", () => ({
  recordLessonWatchProgressAction,
  startLessonWatchSessionAction,
}));
vi.mock("@/components/lesson-focus-mode", () => ({
  LessonFocusContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));
vi.mock("@/components/ui/aspect-ratio", () => ({
  AspectRatio: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

describe("LessonVideoPlayer", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    startLessonWatchSessionAction.mockResolvedValue({
      isLinearProgressBlocked: false,
      resumePositionSeconds: 123,
      trackingSessionId: "server-session-1",
      watchedPercent: 41,
    });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("restores persisted position after the JMVStream player reports readiness without recording completion", async () => {
    act(() => {
      root.render(
        <LessonVideoPlayer
          durationSeconds={300}
          initialPositionSeconds={123}
          initialWatchedPercent={41}
          isPreview={false}
          lessonId="lesson-1"
          title="Aula"
          videoDurationSeconds={300}
          videoEmbedUrl="https://player.jmvstream.com/evt/example"
          videoProvider="jmvstream"
        >
          <p>Conteúdo</p>
        </LessonVideoPlayer>
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    const iframe = container.querySelector("iframe");
    if (!iframe?.contentWindow) {
      throw new Error("Expected the player iframe to be available.");
    }

    const contentWindow = iframe.contentWindow;
    const postMessage = vi.spyOn(contentWindow, "postMessage");

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            currentTime: 0,
            duration: 300,
            event: "jmvplayerout-status",
          },
          origin: "https://player.jmvstream.com",
          source: contentWindow,
        })
      );
    });

    expect(postMessage).toHaveBeenCalledWith(
      JSON.stringify({ jump: 123, public_event: "jmvplayer-jump" }),
      "https://player.jmvstream.com"
    );
    expect(startLessonWatchSessionAction).toHaveBeenCalledWith({
      lessonId: "lesson-1",
    });
    expect(recordLessonWatchProgressAction).not.toHaveBeenCalled();
  });

  it("explains how to recover automatic completion after a linear-progress block", () => {
    act(() => {
      root.render(
        <LessonVideoPlayer
          durationSeconds={300}
          initialLinearProgressBlocked
          initialPositionSeconds={123}
          initialWatchedPercent={0}
          isPreview={false}
          lessonId="lesson-1"
          title="Aula"
          videoDurationSeconds={300}
          videoEmbedUrl="https://player.jmvstream.com/evt/example"
          videoProvider="jmvstream"
        >
          <p>Conteúdo</p>
        </LessonVideoPlayer>
      );
    });

    expect(container.textContent).toContain(
      "Para concluir automaticamente, volte ao início"
    );
    expect(container.textContent).toContain(
      "Você também pode concluir a aula manualmente."
    );
  });

  it("explains when a video can only be completed manually until duration is available", () => {
    act(() => {
      root.render(
        <LessonVideoPlayer
          durationSeconds={300}
          initialPositionSeconds={0}
          initialWatchedPercent={0}
          isPreview={false}
          lessonId="lesson-1"
          title="Aula"
          videoDurationSeconds={0}
          videoEmbedUrl="https://player.jmvstream.com/evt/example"
          videoProvider="jmvstream"
        >
          <p>Conteúdo</p>
        </LessonVideoPlayer>
      );
    });

    expect(container.textContent).toContain(
      "A duração do vídeo ainda não foi sincronizada"
    );
    expect(container.textContent).toContain("concluir a aula manualmente");
  });
});
