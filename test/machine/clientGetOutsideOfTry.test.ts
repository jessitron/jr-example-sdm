import * as assert from "assert";
import { InMemoryProject } from "@atomist/automation-client";
import { inspectClientGetOutsideOfTry } from "../../lib/machine/clientGetOutsideOfTry";
import { wrapInTry } from "../../lib/machine/tryify";
import { CodeTransform, TransformResult } from "@atomist/sdm";

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
    public String storingResponseCorrectly() throws IOException {

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

        assert(normalizeWhitespace(actual).includes(normalizeWhitespace(after)), actual);

    })

});

function normalizeWhitespace(str: string): string {
    return str.replace(/\s+/g, " ").trim();
}

async function transformJavaMethod(methodDefinition: string, transform: CodeTransform): Promise<string> {
    const p = InMemoryProject.of({
        path: "src/main/Something.java", content: `package la.la.la;

class Foo {
    ${methodDefinition}
}
` });
    const result = await transform(p, undefined);
    assert((result as TransformResult).edited)
    const newContent = p.findFileSync("src/main/Something.java").getContentSync();

    return newContent;
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