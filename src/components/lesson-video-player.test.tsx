/**
 * @vitest-environment jsdom
 */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LessonVideoPlayer } from "./lesson-video-player";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const {
  recordLessonWatchProgressAction,
  replace,
  refresh,
  startLessonWatchSessionAction,
  toastInfo,
} = vi.hoisted(() => ({
  recordLessonWatchProgressAction: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  startLessonWatchSessionAction: vi.fn(),
  toastInfo: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, refresh }),
}));
vi.mock("@/app/(student)/app/actions", () => ({
  recordLessonWatchProgressAction,
  startLessonWatchSessionAction,
}));
vi.mock("sonner", () => ({ toast: { info: toastInfo } }));
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
    vi.clearAllMocks();
    recordLessonWatchProgressAction.mockResolvedValue({
      completed: false,
      courseId: "course-1",
      linearProgressBlocked: false,
      nextLessonId: null,
      trackingSessionActive: true,
      watchedPercent: 0,
    });
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

  const renderPlayer = async (
    isLinearProgressBlocked = false
  ): Promise<Window> => {
    startLessonWatchSessionAction.mockResolvedValueOnce({
      isLinearProgressBlocked,
      resumePositionSeconds: 0,
      trackingSessionId: "server-session-1",
      watchedPercent: 0,
    });

    act(() => {
      root.render(
        <LessonVideoPlayer
          durationSeconds={300}
          initialPositionSeconds={0}
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

    await act(async () => {
      await Promise.resolve();
    });

    const iframe = container.querySelector("iframe");
    if (!iframe?.contentWindow) {
      throw new Error("Expected the player iframe to be available.");
    }

    return iframe.contentWindow;
  };

  const dispatchPlayerEvent = (
    source: Window,
    eventName: string,
    currentTime: number
  ): void => {
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: {
            currentTime,
            duration: 300,
            event: eventName,
            paused: false,
          },
          origin: "https://player.jmvstream.com",
          source,
        })
      );
    });
  };

  const flushProgressUpdate = async (): Promise<void> => {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  };

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

  it("shows a toast instead of a persistent notice when reopening blocked progress", async () => {
    await renderPlayer(true);

    expect(container.textContent).not.toContain(
      "Para concluir automaticamente"
    );
    expect(toastInfo).toHaveBeenCalledWith(
      "Para concluir automaticamente, volte ao começo do trecho pulado e reproduza dali.",
      {
        duration: 7000,
        id: "lesson-video-linear-progress-lesson-1",
      }
    );
  });

  it("shows a toast when a video seek blocks automatic completion", async () => {
    recordLessonWatchProgressAction.mockResolvedValue({
      completed: false,
      courseId: "course-1",
      linearProgressBlocked: true,
      nextLessonId: null,
      trackingSessionActive: true,
      watchedPercent: 0,
    });
    const playerWindow = await renderPlayer();

    for (const currentTime of [120, 150]) {
      dispatchPlayerEvent(playerWindow, "jmvplayerout-skip", currentTime);
      await flushProgressUpdate();
    }

    const toastOptions = {
      duration: 7000,
      id: "lesson-video-linear-progress-lesson-1",
    };
    expect(toastInfo).toHaveBeenNthCalledWith(
      1,
      "Para concluir automaticamente, volte ao começo do trecho pulado e reproduza dali.",
      toastOptions
    );
    expect(toastInfo).toHaveBeenNthCalledWith(
      2,
      "Para concluir automaticamente, volte ao começo do trecho pulado e reproduza dali.",
      toastOptions
    );
    expect(container.textContent).not.toContain(
      "Para concluir automaticamente"
    );
  });

  it("does not show a toast when a seek leaves linear progress unblocked", async () => {
    const playerWindow = await renderPlayer();
    dispatchPlayerEvent(playerWindow, "jmvplayerout-skip", 10);
    await flushProgressUpdate();

    expect(recordLessonWatchProgressAction).toHaveBeenCalledTimes(1);
    expect(toastInfo).not.toHaveBeenCalled();
  });

  it("does not show a toast when seeking backward while progress is blocked", async () => {
    recordLessonWatchProgressAction.mockResolvedValue({
      completed: false,
      courseId: "course-1",
      linearProgressBlocked: true,
      nextLessonId: null,
      trackingSessionActive: true,
      watchedPercent: 0,
    });
    const playerWindow = await renderPlayer();

    dispatchPlayerEvent(playerWindow, "jmvplayerout-status", 200);
    await flushProgressUpdate();
    dispatchPlayerEvent(playerWindow, "jmvplayerout-skip", 120);
    await flushProgressUpdate();

    expect(recordLessonWatchProgressAction).toHaveBeenCalledTimes(2);
    expect(toastInfo).not.toHaveBeenCalled();
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
