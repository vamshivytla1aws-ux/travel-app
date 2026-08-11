import { describe, expect, it } from "vitest";
import { getAppDateTimeInputDefaults } from "@/lib/timezone";

describe("getAppDateTimeInputDefaults", () => {
  it("uses the dashboard business timezone instead of the server timezone", () => {
    expect(getAppDateTimeInputDefaults(new Date("2026-08-11T20:00:00.000Z"))).toEqual({
      date: "2026-08-12",
      time: "01:30",
    });
  });
});
