import { StringEnum } from "@earendil-works/pi-ai";
import { type TSchema, Type } from "typebox";

export const WebSearchParams: TSchema = Type.Object({
	query: Type.String({
		description: "Search query (natural language works best)",
	}),
	numResults: Type.Optional(
		Type.Number({
			description: "Number of results (1-20, default 5)",
			default: 5,
		}),
	),
	backend: Type.Optional(
		StringEnum(["auto", "exa_mcp", "firecrawl", "tavily", "brave"] as const, {
			description:
				"Search backend. 'auto' tries enabled backends in order (default).",
			default: "auto",
		}),
	),
});

export type WebSearchInput = {
	query: string;
	numResults?: number;
	backend?: "auto" | "exa_mcp" | "firecrawl" | "tavily" | "brave";
};

export const WebReadParams: TSchema = Type.Object({
	url: Type.String({
		description: "HTTP(S) URL to fetch as markdown",
	}),
});

export type WebReadInput = {
	url: string;
};
