import { CodeTransform } from '@atomist/sdm';
import { Project } from '@atomist/automation-client';


export function renameMethodTransform(params: { oldMethodName: string }): CodeTransform {
    return async (p: Project) => {
        return { edited: false, success: true, target: p };
    }
}