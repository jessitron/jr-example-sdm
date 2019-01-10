import * as assert from "assert";
import { InMemoryProject, InMemoryProjectFile } from "@atomist/automation-client";
import { CodeTransform, TransformResult } from "@atomist/sdm";
import { normalizeWhitespace } from "../normalizeWhitespace";
import { wrapInTry, fluentBuilderInvocation, lhsEquals, target, tryFinally } from "../../lib/machine/clientGetOutsideOfTry";

const SomeRandomJavaFile = `package com.jessitron.hg;

import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import static org.springframework.web.bind.annotation.RequestMethod.GET;

@RestController
class HorseguardsController {

    @RequestMapping(method = GET, path = "/")
    public String root() {
        return "App running: Served from " + getClass().getName();
    }

    @RequestMapping(method = GET, path = "hello/{name}")
    public String person(@PathVariable String name) {
        return "Hello " + name + "!";
    }

    @RequestMapping(method = GET, path = "kitties/{qyt}")
    public String kitties(@PathVariable Integer qty) {
        return "So many kitties" + qty;
    }

}
`

const OffendingJavaFile = `package com.jessitron.hg;

import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import sun.net.www.http.HttpClient;

import java.io.IOException;

import static org.springframework.web.bind.annotation.RequestMethod.GET;

@RestController
class HorseguardsController {

    @RequestMapping(method = GET, path = "/")
    public String root() throws IOException {

        HorseguardsClient client = new HorseguardsClient();

        String response = client.get("https://bananas.com")
            .execute();

        return "App running: Served from " + getClass().getName();
    }

    @RequestMapping(method = GET, path = "hello/{name}")
    public String person(@PathVariable String name) {

        HorseguardsClient client = new HorseguardsClient();

        String reponse = null;
        try {
            response = client.get("https://bananas.com")
                .execute();
        } finally {
            // this is what it is supposed to look like
            if (response != null) {
                response.close();
            }
        }

        return "App running: Served from " + getClass().getName();
        return "Hello " + name + "!";
    }

    @RequestMapping(method = GET, path = "kitties/{qyt}")
    public String kitties(@PathVariable Integer qty) {
        return "So many kitties" + qty;
    }

}
`
describe("inspectClientGetOutsideOfTry", () => {
    it("doesn't care about an empty project", async () => {
        const p = InMemoryProject.of();
        const result = await wrapInTry(p, {
            globPatterns: "**/*.java",
            initialMethodCall: "client.get",
            finallyContent: () => " abquatulate(); ",
        });
        assert(!result.edited);
    });

    it("doesn't care about a random java file", async () => {
        const p = InMemoryProject.of({ path: "src/main/Something.java", content: SomeRandomJavaFile });
        const result = await wrapInTry(p, {
            globPatterns: "**/*.java",
            initialMethodCall: "client.get",
            finallyContent: () => " abquatulate(); "
        });
        assert(!result.edited);
    });

    it("does care about call to client.get", async () => {
        const p = InMemoryProject.of({ path: "src/main/Something.java", content: OffendingJavaFile });
        const result = await wrapInTry(p, {
            globPatterns: "**/*.java",
            initialMethodCall: "client.get",
            finallyContent: () => " abquatulate(); "
        });
        assert(result.edited)
    });

    it("contains the thing wrapped in tryFinally", async () => {
        const shouldContain = `try {
             String response = client.get("https://bananas.com")
                                     .execute(); 
        } finally { 
            if (response != null) { 
                response.close()
             }
        }`;
        const p = InMemoryProject.of({ path: "src/main/Something.java", content: OffendingJavaFile });
        const result = await wrapInTry(p, {
            globPatterns: "**/*.java",
            initialMethodCall: "client.get",
            finallyContent: () => "if (response != null) { response.close() }"
        });
        assert(result.edited)
        const newContent = p.findFileSync("src/main/Something.java").getContentSync();

        assert(normalizeWhitespace(newContent).includes(normalizeWhitespace(shouldContain)), newContent);
    });

    it("Wraps a stored response", async () => {
        const before = `public String storingResponse() throws IOException {

        HorseguardsClient client = new HorseguardsClient();

        HorseguardsResponse response = client.get("https://bananas.com")
                .execute();

        return "App running: Served from " + getClass().getName() +
                " got " + response.statusCode();
    }`;
        const after = `
    public String storingResponse() throws IOException {

        HorseguardsClient client = new HorseguardsClient();

        HorseguardsResponse response = null;
        try {
            response = client.get("https://bananas.com")
                    .execute();
        } finally {
            if (response != null) {
                response.close();
            }
        }

        return "App running: Served from " + getClass().getName() +
                " got " + response.statusCode();
    }`;

        const actual = await transformJavaMethod(before, p => wrapInTry(p, {
            globPatterns: "**/*.java",
            initialMethodCall: "client.get",
            finallyContent: () => `if (response != null) {
                response.close();
            }`
        }));

        assert.strictEqual(normalizeWhitespace(actual), normalizeWhitespace(after));

    })

});


async function transformJavaMethod(methodDefinition: string, transform: CodeTransform): Promise<string> {
    const prefix = `package la.la.la;

class Foo {`;
    const suffix = "\n}\n";
    const p = InMemoryProject.of({
        path: "src/main/Something.java",
        content: prefix + methodDefinition + suffix
    });
    const result = await transform(p, undefined);
    assert((result as TransformResult).edited)
    const newContent = p.findFileSync("src/main/Something.java").getContentSync();

    return newContent.slice(prefix.length, newContent.length - suffix.length);
}

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
            const replacement = `int statusCode = ; try { ${toMatch} } finally { absquatulate(); }`;


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
            assert.strictEqual(normalizeWhitespace(fromTry), normalizeWhitespace(fromTryExpected));
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
