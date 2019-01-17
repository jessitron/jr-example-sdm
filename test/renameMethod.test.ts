import { InMemoryProject } from '@atomist/automation-client';
import * as assert from "assert";
import { renameMethodTransform, methodCallsGrammar } from '../lib/machine/renameMethod';
import { TransformResult, CodeTransform } from '@atomist/sdm';

const commonParams = { oldMethodName: "oldMethodName", newMethodName: "updatedMethodName" };

describe("renames a method", () => {

    it("does nothing on an empty project", async () => {
        const p = InMemoryProject.of();
        const result = await (renameMethodTransform(
            commonParams)(p, undefined)) as TransformResult;
        assert(!result.edited);
    });

    it("does nothing when the method to rename is not called", async () => {
        const result = await transformJavaMethod(`public void Foo() { something.else(); }`,
            renameMethodTransform(commonParams))

        assert(!result.edited);
    })

    it("changes the method when it is called", async () => {
        const result = await transformJavaMethod(`public void Foo() { 
            something.${commonParams.oldMethodName}();
    }`,
            renameMethodTransform(commonParams))

        assert(result.edited);
        assert.strictEqual(result.newMethodDefinition, `public void Foo() { 
            something.${commonParams.newMethodName}();
    }`)
    })
});

async function transformJavaMethod(methodDefinition: string, transform: CodeTransform): Promise<{
    edited: boolean,
    newMethodDefinition: string
}> {
    const prefix = `package la.la.la;

class Foo {
`;
    const suffix = "\n}\n";
    const p = InMemoryProject.of({
        path: "src/main/Something.java",
        content: prefix + methodDefinition + suffix,
    });
    const result = await transform(p, undefined);
    const newContent = p.findFileSync("src/main/Something.java").getContentSync();

    return {
        edited: (result as TransformResult).edited,
        newMethodDefinition: newContent.slice(prefix.length, newContent.length - suffix.length)
    };
}

// test the microgrammar
describe("method calls", () => {


    it("should not match wrong name", () => {
        const input = "blah.somethingElse()";
        const mg = methodCallsGrammar("oldMethodName");
        assert.strictEqual(mg.findMatches(input).length, 0);
    });

    it("should match", () => {
        const input = "blah.oldMethodName()";
        const mg = methodCallsGrammar("oldMethodName");
        assert.strictEqual(mg.findMatches(input).length, 1);
    });
});

