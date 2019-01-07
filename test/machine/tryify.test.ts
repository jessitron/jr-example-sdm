import { targetBuilder, tryFinally } from "../../lib/machine/tryify";
import * as assert from "assert";

describe("tryify", () => {

    describe("targetBuilder", () => {

        it("should not match", () => {
            const input = "nothing to see here";
            const mg = targetBuilder("client.get");
            assert.strictEqual(mg.findMatches(input).length, 0);
        });

        it("should find one match", () => {
            const input = `int statusCode = client.get("http://example.org") 
                                     .execute() 
                                    .statusCode();    
        return statusCode;`;
            const mg = targetBuilder("client.get");
            const matches = mg.findMatches(input);
            assert.strictEqual(matches.length, 1);
            assert.strictEqual(matches[0].methodCall, "client.get");
            assert(matches[0].fluency.includes("execute"));
            assert(matches[0].$matched.startsWith("client.get"));
            assert(matches[0].$matched.endsWith(".statusCode();"));
        });

        it("should not match wrong initial call", () => {
            const input = `int statusCode = client.notGet("http://example.org") 
                                     .execute() 
                                    .statusCode();    
        return statusCode;`;
            const mg = targetBuilder("client.get");
            assert.strictEqual(mg.findMatches(input).length, 0);
        });

    });

    describe("The grammar to find try-finally", () => {
        it("Should match a try/finally with no catch", () => {
            const input = `// blah blah
            try {
                response = client.get();
            } finally {
                response.close();
            }`;
            const result = tryFinally().findMatches(input);

            assert.strictEqual(result.length, 1);
        })

        it("Should find a try/catch/finally", () => {
            const input = `// blah blah
            try {
                response = client.get();
            } catch (Exception e) {
                // blah
            } finally {
                response.close();
            }`;
            const result = tryFinally().findMatches(input);

            assert.strictEqual(result.length, 1);
        })
    })

});