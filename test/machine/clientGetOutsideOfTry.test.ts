import * as assert from "assert";
import { InMemoryProject } from "@atomist/automation-client";
import { CodeTransform, TransformResult } from "@atomist/sdm";
import { normalizeWhitespace } from "../normalizeWhitespace";
import { wrapInTry, lhsEquals, target, tryFinally } from "../../lib/machine/clientGetOutsideOfTry";

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

const commonOptions = {
    globPatterns: "**/*.java",
    beginningOfCall: "client.get(",
    endOfCall: "execute()",
    returnType: "HorseguardsResponse",
    returnVariableName: "response",
    finallyContent: (v: string) => `if (${v} != null) { ${v}.close(); }`,
};

describe("inspectClientGetOutsideOfTry", () => {
    it("doesn't care about an empty project", async () => {
        const p = InMemoryProject.of();
        const result = await wrapInTry(p, commonOptions);
        assert(!result.edited);
    });

    it("doesn't care about a random java file", async () => {
        const p = InMemoryProject.of({ path: "src/main/Something.java", content: SomeRandomJavaFile });
        const result = await wrapInTry(p, commonOptions);
        assert(!result.edited);
    });

    it("does care about call to client.get", async () => {
        const p = InMemoryProject.of({ path: "src/main/Something.java", content: OffendingJavaFile });
        const result = await wrapInTry(p, commonOptions);
        assert(result.edited)
    });

    it("contains the thing wrapped in tryFinally", async () => {
        const before = `  HorseguardsClient client = new HorseguardsClient();

        String response = client.get("https://bananas.com")
            .execute();

        return "App running: Served from " + getClass().getName();`
        const after = `String response = null;
        try {
             response = client.get("https://bananas.com")
                                     .execute(); 
        } finally { 
            if (response != null) { 
                response.close()
             }
        }`;
        const result = await transformJavaMethodBody(before, p => wrapInTry(p, commonOptions));

        assert(normalizeWhitespace(result), normalizeWhitespace(after));
    });

    it("Wraps a stored response", async () => {
        const before = `
        HorseguardsClient client = new HorseguardsClient();

        HorseguardsResponse response = client.get("https://bananas.com")
                .execute();

        return "App running: Served from " + getClass().getName() +
                " got " + response.statusCode();`;

        const after = `
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
                " got " + response.statusCode();`;

        const actual = await transformJavaMethodBody(before, p => wrapInTry(p, commonOptions));

        assert.strictEqual(normalizeWhitespace(actual), normalizeWhitespace(after));

    });

    it("Should work when the return value is unused", async () => {
        const before = `
        client.get("https://bananas.com")
                .execute();
`;
        const after = `
        HorseguardsResponse response = null;
        try {
            response = client.get("https://bananas.com")
                    .execute();
        } finally {
            if (response != null) {
                response.close();
            }
        }
`;
        const actual = await transformJavaMethodBody(before, p => wrapInTry(p, commonOptions));

        assert.strictEqual(normalizeWhitespace(actual), normalizeWhitespace(after));

    });

    it.skip("Should work when statusCode is stored in a var that is not declared right there", async () => {
        // this gets hard, and is probably not necessary
        const before = `
        int statusCode = 4000005;

        statusCode = client.get("https://bananas.com")
                .execute().statusCode();
`;
        const after = `
        int statusCode = 4000005;

        HorseguardsResponse response = null;
        try {
            response = client.get("https://bananas.com")
                    .execute();
        } finally {
            if (response != null) {
                response.close();
            }
        }
        statusCode = response.statusCode();
`;
        const actual = await transformJavaMethodBody(before, p => wrapInTry(p, commonOptions));

        assert.strictEqual(normalizeWhitespace(actual), normalizeWhitespace(after));

    })

});


async function transformJavaMethodBody(methodDefinition: string, transform: CodeTransform): Promise<string> {
    const prefix = `package la.la.la;

class Foo {
    public void callMe() {
`;
    const suffix = "\n    }\n}\n";
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
            const mg = target("client.get", "yo");
            assert.strictEqual(mg.findMatches(input).length, 0);
        });

        it("should find one match", () => {
            const input = `int statusCode = client.get("http://example.org") 
                                     .execute() 
                                    .statusCode();    
        return statusCode;`;
            const mg = target("client.get", "statusCode()");
            const matches = mg.findMatches(input);
            assert.strictEqual(matches.length, 1);
            assert.strictEqual(matches[0].invocation.beginningOfCall, "client.get");
            assert(matches[0].invocation.rest.includes("execute"));
            assert(matches[0].$matched.startsWith("int statusCode ="));
            assert(matches[0].$matched.endsWith(".statusCode();"));
        });

        it("should not match wrong initial call", () => {
            const input = `int statusCode = client.notGet("http://example.org") 
                                     .execute() 
                                    .statusCode();    
        return statusCode;`;
            const mg = target("client.get", "execute");
            assert.strictEqual(mg.findMatches(input).length, 0);
        });

    });

    describe("targeting within project", () => {

        it("should pull out response variable", async () => {
            const toStoreAsResponse = `client.get("http://example.org")
                .execute()`;
            const methodBody = `int statusCode = ${toStoreAsResponse}.statusCode();
            return statusCode;`
            const replacement = `HorseguardsResponse response = null; 
            try {
                response = ${toStoreAsResponse};
            } finally {
                absquatulate(response);
            }
            int statusCode = response.statusCode();
            return statusCode;`;


            const result = await transformJavaMethodBody(methodBody, p => wrapInTry(p, {
                globPatterns: "**/*.java",
                beginningOfCall: "client.get(",
                endOfCall: "execute()",
                returnType: "HorseguardsResponse",
                returnVariableName: "response",
                finallyContent: () => "absquatulate(response);",
            }))

            assert.strictEqual(normalizeWhitespace(result), normalizeWhitespace(replacement));
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
