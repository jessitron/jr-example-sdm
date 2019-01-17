import { CodeTransform } from '@atomist/sdm';
import { Project, astUtils } from '@atomist/automation-client';
import { microgrammar, Grammar, Microgrammar } from '@atomist/microgrammar';
import { MicrogrammarBasedFileParser } from '@atomist/automation-client/lib/tree/ast/microgrammar/MicrogrammarBasedFileParser';

export function renameMethodTransform(opts: {
    globPatterns: string,
    oldMethodName: string,
    newMethodName: string,
    className: string,
}): CodeTransform {
    return async (p: Project) => {
        const { oldMethodName } = opts;
        let edited = false;
        for (const fh of await variableDeclarationFileHits(p, opts)) {
            for (const variableName of fh.matches.map(mr => mr.$value)) {
                for await (const mc of matchMethodCalls(p, fh.file.path, { oldMethodName, variableName })) {
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

function matchMethodCalls(p: Project, path: string, opts: {
    oldMethodName: string,
    variableName: string,
}) {
    const pathExpression = `//methodCall
    [/variableName[@value='${opts.variableName}']]
    /methodName[@value='${opts.oldMethodName}']`;
    const parseWith = new MicrogrammarBasedFileParser("match", "methodCall",
        methodCallsGrammar(opts.oldMethodName) as Microgrammar<MethodCall>);

    return astUtils.matchIterator(p, {
        globPatterns: path,
        pathExpression,
        parseWith,
    });
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

async function variableDeclarationFileHits(p: Project, opts: { globPatterns: string, className: string }) {
    const variableDeclarationsPathExpression = `//variableOfClass
    [/className[@value='${opts.className}']]
    /variableName`;
    const variableDeclarationsParser = new MicrogrammarBasedFileParser("match", "variableOfClass",
        variableDeclarationGrammar(opts.className) as Microgrammar<VariableDeclaration>);

    return astUtils.findFileMatches(p,
        variableDeclarationsParser,
        opts.globPatterns,
        variableDeclarationsPathExpression
    );
}