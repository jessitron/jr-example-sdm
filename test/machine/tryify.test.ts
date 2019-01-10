import { fluentBuilderInvocation, lhsEquals, target, tryFinally, wrapInTry } from "../../lib/machine/tryify";
import * as assert from "assert";
import { InMemoryProject, InMemoryProjectFile } from "@atomist/automation-client";

import { astUtils } from "@atomist/automation-client";
import { MicrogrammarBasedFileParser } from "@atomist/automation-client/lib/tree/ast/microgrammar/MicrogrammarBasedFileParser";

describe("tryify", () => {

    describe("fluentBuilderInvocation", () => {

        it("should not match", () => {
            const input = "nothing to see here";
            const mg = fluentBuilderInvocation("client.get");
            assert.strictEqual(mg.findMatches(input).length, 0);
        });

        it("should find one match", () => {
            const input = `int statusCode = client.get("http://example.org") 
                                     .execute() 
                                    .statusCode();    
        return statusCode;`;
            const mg = fluentBuilderInvocation("client.get");
            const matches = mg.findMatches(input);
            assert.strictEqual(matches.length, 1);
            assert.strictEqual(matches[0].initialMethodCall, "client.get");
            assert(matches[0].fluency.includes("execute"));
            assert(matches[0].$matched.startsWith("client.get"));
            assert(matches[0].$matched.endsWith(".statusCode();"));
        });

        it("should not match wrong initial call", () => {
            const input = `int statusCode = client.notGet("http://example.org") 
                                     .execute() 
                                    .statusCode();    
        return statusCode;`;
            const mg = fluentBuilderInvocation("client.get");
            assert.strictEqual(mg.findMatches(input).length, 0);
        });

    });

    describe("lhs equals", () => {

        it("should match", () => {
            const input = "int statusCode =";
            const mg = lhsEquals();
            assert.strictEqual(mg.findMatches(input).length, 1);
        });

    });

    describe("target expression", () => {

        it("should not match", () => {
            const input = "nothing to see here";
            const mg = target("client.get");
            assert.strictEqual(mg.findMatches(input).length, 0);
        });

        it("should find one match", () => {
            const input = `int statusCode = client.get("http://example.org") 
                                     .execute() 
                                    .statusCode();    
        return statusCode;`;
            const mg = target("client.get");
            const matches = mg.findMatches(input);
            assert.strictEqual(matches.length, 1);
            assert.strictEqual(matches[0].fluentBuilderInvocation.initialMethodCall, "client.get");
            assert(matches[0].fluentBuilderInvocation.fluency.includes("execute"));
            assert(matches[0].$matched.startsWith("int statusCode ="));
            assert(matches[0].$matched.endsWith(".statusCode();"));
        });

        it("should not match wrong initial call", () => {
            const input = `int statusCode = client.notGet("http://example.org") 
                                     .execute() 
                                    .statusCode();    
        return statusCode;`;
            const mg = target("client.get");
            assert.strictEqual(mg.findMatches(input).length, 0);
        });

    });

    describe("targeting within project", () => {

        it("should replace", async () => {
            const toMatch = `int statusCode = client.get("http://example.org") 
                                     .execute() 
                                    .statusCode();`;
            const replacement = `try { ${toMatch} } finally { absquatulate(); }`;
            const java1 = new InMemoryProjectFile("src/main/java/Thing.java",
                `public class Thing { ${toMatch} }`);
            const p = InMemoryProject.of(java1);

            const globPatterns = "src/main/java/**/*.java";
            await wrapInTry(p, {
                globPatterns,
                initialMethodCall: "client.get",
                finallyContent: () => "absquatulate();",
            });

            const java1Now = await p.getFile(java1.path);
            const contentNow = java1Now.getContentSync();
            console.log("NOW=" + contentNow);
            const fromTry = contentNow.substr(contentNow.indexOf("try"));
            const fromTryExpected = replacement.substr(replacement.indexOf("try")) + " }";
            assert.strictEqual(fromTry, fromTryExpected);
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
        });

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
        });
    });

});
