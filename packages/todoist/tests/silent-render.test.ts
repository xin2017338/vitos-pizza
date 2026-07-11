import { describe, expect, it } from "vitest";
import { silentRender } from "../src/silent-render.ts";

describe("silentRender", () => {
	it("uses self shell and emits empty call/result components", () => {
		expect(silentRender.renderShell).toBe("self");
		expect(silentRender.renderCall().render(80)).toEqual([]);
		expect(silentRender.renderResult().render(80)).toEqual([]);
	});
});
