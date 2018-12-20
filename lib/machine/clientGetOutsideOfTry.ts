import {
    CodeInspection
} from "@atomist/sdm";
import { Project } from "@atomist/automation-client";

type Thing = {
    filePath: string
}

export const inspectClientGetOutsideOfTry: CodeInspection<Thing[]> =
    async (project: Project): Promise<Thing[]> => {
        return [];
    }