import { CodeTransform } from '@atomist/sdm';
import { Project } from '@atomist/automation-client';
import { microgrammar } from '@atomist/microgrammar';


export function renameMethodTransform(params: { oldMethodName: string }): CodeTransform {
    return async (p: Project) => {



        return { edited: false, success: true, target: p };
    }
}

const javaIdentifierPattern = /[a-zA-Z_$][a-zA-Z0-9_$]*/;

export function methodCalls(methodName: string) {
    return microgrammar({
        phrase: "${variable}.${methodName}(", terms:
        {
            variable: javaIdentifierPattern,
            methodName: methodName,
        }
    })
}