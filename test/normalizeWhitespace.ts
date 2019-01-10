import * as assert from "assert";

export function normalizeWhitespace(str: string): string {
    return str.replace(/\s+/g, " ").trim();
}

describe("normalizeWhitespace", () => {
    it("replaces each whitespace patch with a single space", () => {
        const input = `  some stuff
     and then more stuff;  
           and yet more
           `;

        const expected = "some stuff and then more stuff; and yet more";
        assert.strictEqual(normalizeWhitespace(input), expected);
    })
})