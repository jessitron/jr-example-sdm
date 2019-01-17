import { CodeTransform } from '@atomist/sdm';
import { Project, astUtils } from '@atomist/automation-client';
import { microgrammar, Grammar, Microgrammar } from '@atomist/microgrammar';
import { MicrogrammarBasedFileParser } from '@atomist/automation-client/lib/tree/ast/microgrammar/MicrogrammarBasedFileParser';


export function renameMethodTransform(opts: {
    globPatterns?: string,
    oldMethodName: string,
    newMethodName: string,
}): CodeTransform {
    return async (p: Project) => {

        const pathExpression = `//methodCall//methodName[@value='${opts.oldMethodName}']`;
        const parseWith = new MicrogrammarBasedFileParser("match", "methodCall",
            methodCallsGrammar(opts.oldMethodName) as Microgrammar<MethodCall>);

        const oldMethodNames = astUtils.matchIterator(p, {
            globPatterns: opts.globPatterns || "**/*.java",
            pathExpression,
            parseWith,
        });

        let edited = false;
        for await (const mc of oldMethodNames) {
            edited = true;
            mc.$value = opts.newMethodName;
        }

        return { edited, success: true, target: p };
    }
}

const javaIdentifierPattern = /[a-zA-Z_$][a-zA-Z0-9_$]*/;

type MethodCall = {
    variable: string,
    methodName: string,
}

export function methodCallsGrammar(methodName: string): Grammar<MethodCall> {
    return microgrammar<MethodCall>({
        phrase: "${variable}.${methodName}(", terms:
        {
            variable: javaIdentifierPattern,
            methodName: methodName,
        }
    })
}