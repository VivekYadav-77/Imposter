import { afterEach, describe, expect, it, vi } from "vitest";

describe("game sound alerts", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("uses the emergency meeting vibration pattern even when sound is muted", async () => {
    const vibrate = vi.fn();
    vi.stubGlobal("window", {
      localStorage: { getItem: () => "false" },
    });
    vi.stubGlobal("navigator", { vibrate });

    const { playMeetingAlert } = await import("../../src/client/audio/game-sounds");
    playMeetingAlert();

    expect(vibrate).toHaveBeenCalledOnce();
    expect(vibrate).toHaveBeenCalledWith([300, 100, 300, 140, 520, 120, 300]);
  });

  it("provides distinct lobby and game-start sound identities", async () => {
    const { gameSoundLabels } = await import("../../src/client/audio/game-sounds");

    expect(gameSoundLabels["player-join"]).toBe("Player joined");
    expect(gameSoundLabels["game-start"]).toBe("Game started");
    expect(gameSoundLabels.meeting).toBe("Meeting alert");
  });
});
