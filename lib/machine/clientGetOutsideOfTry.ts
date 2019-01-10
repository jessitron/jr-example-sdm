import { CodeTransform, TransformResult } from "@atomist/sdm";
import { Microgrammar, takeUntil, zeroOrMore } from "@atomist/microgrammar";
import { JavaBlock } from "@atomist/microgrammar/lib/matchers/lang/cfamily/java/JavaBody";
import { parenthesizedExpression } from "@atomist/microgrammar/lib/matchers/lang/cfamily/CBlock";
import { astUtils, MatchResult, Project } from "@atomist/automation-client";
import { GlobOptions } from "@atomist/automation-client/lib/project/util/projectUtils";
import { MicrogrammarBasedFileParser } from "@atomist/automation-client/lib/tree/ast/microgrammar/MicrogrammarBasedFileParser";
import { notWithin } from "@atomist/automation-client/lib/tree/ast/matchTesters";

/**
 * Wrap the function in a try
 * @param {Project} p
 * @return {Promise<void>}
 */
export async function wrapInTry(p: Project,
    opts: {
        globPatterns: GlobOptions,
        initialMethodCall: string,
        finallyContent: (tryContent: string) => string,
    }): Promise<TransformResult> {
    // This will benefit from optimized parsing: Only files containing the @value will be parsed
    const pathExpression = `//unsafeCall[//initialMethodCall[@value='${opts.initialMethodCall}']]`;
    const parseWith = new MicrogrammarBasedFileParser("match", "unsafeCall",
        target(opts.initialMethodCall));

    // TODO will be able to type matchIterator with latest automation-client
    const unsafeCalls = astUtils.matchIterator(p, {
        globPatterns: opts.globPatterns,
        pathExpression,
        parseWith,
        testWith: notWithin(tryFinally()),
    });
    let edited = false;
    for await (const unsafeCall of unsafeCalls) {
        edited = true;
        const uc = unsafeCall as any as (Target & MatchResult); // TODO this won't be necessary after upgrading automation-client
        //const unsafeCallValue = unsafeCallTyped.$value.slice(unsafeCallTyped.endOfPreviousExpression.length);
        unsafeCall.$value =
            `${uc.beforeMethodCall.declaredType} ${uc.beforeMethodCall.varname} = ${javaInitialValue(uc.beforeMethodCall.declaredType)};
try {
    ${uc.beforeMethodCall.varname} = ${(uc.fluentBuilderInvocation as FluentBuilderInvocation & MatchResult).$value}
} finally {
    ${opts.finallyContent("")}
}`.replace(/    /g, "\t");
    }

    return { edited, success: true, target: p };
}

function javaInitialValue(type: string): string {
    switch (type) {
        case "int":
            return "-1";
        default:
            return "null";
    }
}

export interface FluentBuilderInvocation {
    initialMethodCall: string;
    fluency: string;
}

/**
 * Match a call of the form
 * client.get("http://example.org")
 * .execute()
 * .statusCode();
 *
 * where client.get is initialMethodCall
 *
 * Don't pull more detail out than needed
 * @param {string} initialMethodCall
 */
export function fluentBuilderInvocation(initialMethodCall: string): Microgrammar<FluentBuilderInvocation> {
    return Microgrammar.fromDefinitions<FluentBuilderInvocation>({
        initialMethodCall,
        param: "(",
        fluency: takeUntil("();"),
        end: "();",
    });
}

export interface Target {
    beforeMethodCall: { declaredType: string, varname: string };
    fluentBuilderInvocation: FluentBuilderInvocation;
}

// TODO correct that
const JavaIdentifier = /[a-zA-Z0-9]+/;

export function lhsEquals(): Microgrammar<{ declaredType: string, varname: string }> {
    return Microgrammar.fromString<{ declaredType: string, varname: string }>("${declaredType} ${varname} =", {
        declaredType: JavaIdentifier, // todo: optional
        varname: JavaIdentifier,
    });
}

/**
 * Match target of form:
 *
 * int returnCode = <fluent builder production>
 *
 * @param {string} initialMethodCall
 * @return {Microgrammar<Target>}
 */
export function target(initialMethodCall: string): Microgrammar<Target> {
    return Microgrammar.fromDefinitions<Target>({
        beforeMethodCall: lhsEquals(), // todo: optional
        fluentBuilderInvocation: fluentBuilderInvocation(initialMethodCall),
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

// it's something like <identifier> = fluentBuilderInvocation; return <identifier>;
//const unsafeStatementGrammar = Microgrammar.fromString();

export const tryify: CodeTransform =
    async p => {
        return p;
    };