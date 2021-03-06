// tslint:disable:no-invalid-template-strings
import { astUtils, Project } from "@atomist/automation-client";
import { GlobOptions } from "@atomist/automation-client/lib/project/util/projectUtils";
import { notWithin } from "@atomist/automation-client/lib/tree/ast/matchTesters";
import { MicrogrammarBasedFileParser } from "@atomist/automation-client/lib/tree/ast/microgrammar/MicrogrammarBasedFileParser";
import { Microgrammar, optional, takeUntil, zeroOrMore } from "@atomist/microgrammar";
import { parenthesizedExpression } from "@atomist/microgrammar/lib/matchers/lang/cfamily/CBlock";
import { JavaBlock } from "@atomist/microgrammar/lib/matchers/lang/cfamily/java/JavaBody";
import { PatternMatch } from "@atomist/microgrammar/lib/PatternMatch";
import { CodeTransform, TransformResult } from "@atomist/sdm";

/**
 * Wrap the function in a try
 * @param {Project} p
 * @return {Promise<void>}
 */
export async function wrapInTry(p: Project,
    opts: {
        globPatterns: GlobOptions,
        beginningOfCall: string,
        endOfCall: string,
        returnType: string,
        returnVariableName: string,
        finallyContent: (varname: string) => string,
    }): Promise<TransformResult> {
    // This will benefit from optimized parsing: Only files containing the @value will be parsed
    const pathExpression = `//unsafeCall[//beginningOfCall[@value='${opts.beginningOfCall}']]`;
    const parseWith = new MicrogrammarBasedFileParser("match", "unsafeCall",
        unsafeCallMicrogrammar(opts.beginningOfCall, opts.endOfCall));

    const unsafeCalls = astUtils.matchIterator<UnsafeCall>(p, {
        globPatterns: opts.globPatterns,
        pathExpression,
        parseWith,
        testWith: notWithin(tryFinally()),
    });
    let edited = false;
    for await (const unsafeCall of unsafeCalls) {
        edited = true;
        unsafeCall.$value = wrappedCall(opts, unsafeCall);
    }
    return { edited, success: true, target: p };
}

function wrappedCall(opts: {
    returnType: string,
    returnVariableName: string,
    finallyContent: (varname: string) => string,
}, uc: UnsafeCall): string {
    const moreCallsAreMade = (typeof uc.restOfStatement === "string" && uc.restOfStatement.length > 0);

    const ResponseType = opts.returnType; // capitalized to make it look like what it represents
    const response = moreCallsAreMade ?
        opts.returnVariableName :
        storesReturnValue(uc) ?
            uc.beforeMethodCall.varname :
            opts.returnVariableName;
    const init = javaInitialValue(ResponseType);
    const originalCall = (uc.invocation as unknown as PatternMatch).$matched;
    const cleanup = opts.finallyContent(response);
    const restOfStuff = moreCallsAreMade ?
        `${uc.beforeMethodCall.declaredType} ${uc.beforeMethodCall.varname} = ${response}${uc.restOfStatement};` :
        "";

    return `${ResponseType} ${response} = ${init};
    try {
        ${response} = ${originalCall};
    } finally {
        ${cleanup}
    }
    ${restOfStuff}`;
}

function storesReturnValue(uc: UnsafeCall): boolean {
    return !!(uc.beforeMethodCall && uc.beforeMethodCall.varname);
}

function javaInitialValue(type: string): string {
    switch (type) {
        case "int":
            return "-1";
        default:
            return "null";
    }
}
export interface UnsafeCall {
    beforeMethodCall: { declaredType: string, varname: string };
    invocation: Invocation;
    restOfStatement: string;
}
export interface Invocation {
    beginningOfCall: string;
    rest: string;
    endOfCall: string;
}
// TODO correct that
const JavaIdentifier = /[a-zA-Z0-9]+/;

export function lhsEquals(): Microgrammar<{ declaredType: string, varname: string }> {
    return Microgrammar.fromString<{ declaredType: string, varname: string }>("${declaredType} ${varname} =", {
        declaredType: JavaIdentifier,
        varname: JavaIdentifier,
    });
}

/**
 * Match target of form:
 *
 * int returnCode = <beginningOfCall>...<endOfCall>...;
 *
 * where "int" can be any type, and "returnCode" can be any variable name.
 * The whole "int returnCode =" part is optional.
 *
 * @param {string} initialMethodCall
 * @return {Microgrammar<UnsafeCall>}
 */
export function unsafeCallMicrogrammar(beginningOfCall: string, endOfCall: string): Microgrammar<UnsafeCall> {
    return Microgrammar.fromDefinitions<UnsafeCall>({
        beforeMethodCall: optional(lhsEquals()),
        invocation: Microgrammar.fromDefinitions<Invocation>({
            beginningOfCall,
            rest: takeUntil(endOfCall),
            endOfCall,
        }),
        restOfStatement: takeUntil(";"),
        end: ";",
    });
}

export const Catch = Microgrammar.fromDefinitions({
    _catch: "catch",
    clause: parenthesizedExpression(),
    block: JavaBlock,
});

export function tryFinally(): Microgrammar<{ tryBlock: string, finallyBlock: string }> {
    return Microgrammar.fromString<{ tryBlock: string, finallyBlock: string }>("try ${tryBlock} ${catches} finally ${finallyBlock}", {
        tryBlock: JavaBlock,
        catches: zeroOrMore(Catch),
        finallyBlock: JavaBlock,
    });
}

export const closeAllClientResponses: CodeTransform =
    async p => {
        return wrapInTry(p, {
            globPatterns: "**/*.java",
            beginningOfCall: "client.get(",
            endOfCall: "execute()",
            returnType: "HorseguardsResponse", // Change this to match your library of interest
            returnVariableName: "response",
            finallyContent: (v: string) => `if (${v} != null) { ${v}.close(); }`,
        });
    };
