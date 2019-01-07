import {
    CodeInspection
} from "@atomist/sdm";
import { Project, SourceLocation } from "@atomist/automation-client";
import { gatherFromMatches } from "@atomist/automation-client/lib/tree/ast/astUtils";
import { Java9FileParser } from "@atomist/antlr";

type Thing = {
    where: SourceLocation,
    text: string
}

export const inspectClientGetOutsideOfTry: CodeInspection<Thing[]> =
    async (project: Project): Promise<Thing[]> => {
        const ast = await Java9FileParser.toAst(project.findFileSync("src/main/Something.java"));

        return gatherFromMatches(project, Java9FileParser, "src/main/**/*.java",
            `//variableInitializer/expression//identifier[@Value='client']
               `, m => {
                return {
                    where: m.sourceLocation,
                    text: m.$value
                }
            })
    }