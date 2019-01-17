import { CodeTransform } from '@atomist/sdm';
import { Project, astUtils } from '@atomist/automation-client';
import { microgrammar, Grammar, Microgrammar } from '@atomist/microgrammar';
import { MicrogrammarBasedFileParser } from '@atomist/automation-client/lib/tree/ast/microgrammar/MicrogrammarBasedFileParser';


export function renameMethodTransform(opts: {
    globPatterns?: string,
    oldMethodName: string,
    newMethodName: string,
    className: string,
}): CodeTransform {
    return async (p: Project) => {

        const globPatterns = opts.globPatterns || "**/*.java";

        const variableDeclarationsPathExpression = `//variableOfClass[/className[@value='${opts.className}']]/variableName`;
        const variableDeclarationsParser = new MicrogrammarBasedFileParser("match", "variableOfClass",
            variableDeclarationGrammar(opts.className) as Microgrammar<VariableDeclaration>);

        const fileHits = await astUtils.findFileMatches(p,
            variableDeclarationsParser,
            globPatterns,
            variableDeclarationsPathExpression
        );

        let edited = false;
        for (const fh of fileHits) {
            const variableNames = fh.matches.map(mr => mr.$value)

            for (const v of variableNames) {
                const pathExpression = `//methodCall[/variableName[@value='${v}']]/methodName[@value='${opts.oldMethodName}']`;
                const parseWith = new MicrogrammarBasedFileParser("match", "methodCall",
                    methodCallsGrammar(opts.oldMethodName) as Microgrammar<MethodCall>);

                const oldMethodNames = astUtils.matchIterator(p, {
                    globPatterns: fh.file.path,
                    pathExpression,
                    parseWith,
                });

                for await (const mc of oldMethodNames) {
                    edited = true;
                    console.log("Setting a match to new method name")
                    mc.$value = opts.newMethodName;
                }
            }
        }

        return { edited, success: true, target: p };
    }
}

const javaIdentifierPattern = /[a-zA-Z_$][a-zA-Z0-9_$]*/;

type MethodCall = {
    variableName: string,
    methodName: string,
}

export function methodCallsGrammar(methodName: string): Grammar<MethodCall> {
    return microgrammar<MethodCall>({
        phrase: "${variableName}.${methodName}(", terms:
        {
            variableName: javaIdentifierPattern,
            methodName: methodName,
        }
    })
}

type VariableDeclaration = {
    className: string,
    variableName: string,
}

export function variableDeclarationGrammar(classOfInterest: string): Grammar<VariableDeclaration> {
    return microgrammar<VariableDeclaration>({
        phrase: "${className} ${variableName}",
        terms: {
            className: classOfInterest,
            variableName: javaIdentifierPattern,
        }
    })
}

