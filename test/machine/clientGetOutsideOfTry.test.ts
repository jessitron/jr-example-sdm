import * as assert from "assert";
import { InMemoryProject } from "@atomist/automation-client";
import { inspectClientGetOutsideOfTry } from "../../lib/machine/clientGetOutsideOfTry";

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
        const result = await inspectClientGetOutsideOfTry(p, undefined);
        assert.deepEqual(result, []);
    });

    it("doesn't care about a random java file", async () => {
        const p = InMemoryProject.of({ path: "src/main/Something.java", content: SomeRandomJavaFile });
        const result = await inspectClientGetOutsideOfTry(p, undefined);
        assert.deepEqual(result, []);
    });

    it("does care about call to client.get", async () => {
        const p = InMemoryProject.of({ path: "src/main/Something.java", content: OffendingJavaFile });
        const result = await inspectClientGetOutsideOfTry(p, undefined);
        assert.deepEqual(result, [{ filePath: "src/main/Something.java" }]);
    });
});