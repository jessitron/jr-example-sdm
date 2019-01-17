import { InMemoryProject, Project } from '@atomist/automation-client';
import * as assert from "assert";
import { renameMethodTransform } from '../lib/machine/renameMethod';
import { TransformResult, CodeTransform } from '@atomist/sdm';

const commonParams = { oldMethodName: "oldMethodName" };

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