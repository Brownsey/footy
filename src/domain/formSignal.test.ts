import { describe, expect, it } from "vitest";

import { gradeForm } from "./formSignal";

describe("gradeForm", () => {
  it("grades a strong positive higher than a mild one", () => {
    expect(gradeForm("Stormed through qualifying, unbeaten")).toBe(2);
    expect(gradeForm("Won a comfortable group")).toBe(1);
  });

  it("nets opposing signals and stays neutral when none present", () => {
    expect(gradeForm("Topped the group but stuttered late")).toBe(-1);
    expect(gradeForm("Played three friendlies")).toBe(0);
  });

  it("is bounded to [-2, 2]", () => {
    expect(gradeForm("perfect unbeaten dominant demolished")).toBe(2);
    expect(gradeForm("poor wobbly stuttered")).toBe(-2);
  });
});
