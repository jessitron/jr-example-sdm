import { CodeTransform, TransformResult } from "@atomist/sdm";
import { Microgrammar, takeUntil, zeroOrMore } from "@atomist/microgrammar";
import { JavaBlock } from "@atomist/microgrammar/lib/matchers/lang/cfamily/java/JavaBody";
import { parenthesizedExpression } from "@atomist/microgrammar/lib/matchers/lang/cfamily/CBlock";
import { astUtils, Project } from "@atomist/automation-client";
import { GlobOptions } from "@atomist/automation-client/lib/project/util/projectUtils";
import { MicrogrammarBasedFileParser } from "@atomist/automation-client/lib/tree/ast/microgrammar/MicrogrammarBasedFileParser";

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
    const pathExpression = `//unsafeCall[/initialMethodCall[@value='${opts.initialMethodCall}']]`;
    const parseWith = new MicrogrammarBasedFileParser("match", "unsafeCall",
        targetBuilder(opts.initialMethodCall));

    const unsafeCalls = astUtils.matchIterator(p, {
        globPatterns: opts.globPatterns,
        pathExpression,
        parseWith,
    });
    let edited = false;
    for await (const unsafeCall of unsafeCalls) {
        edited = true;
        unsafeCall.$value = `try { ${unsafeCall.$value} } finally { ${opts.finallyContent(unsafeCall.$value)} }`;
    }

    return { edited, success: true, target: p }
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
export function targetBuilder(initialMethodCall: string): Microgrammar<{ initialMethodCall: string, fluency: string }> {
    return Microgrammar.fromDefinitions<{ initialMethodCall: string, fluency: string }>({
        initialMethodCall: initialMethodCall,
        param: "(",
        fluency: takeUntil("();"),
        end: "();",
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

// it's something like <identifier> = targetBuilder; return <identifier>;
//const unsafeStatementGrammar = Microgrammar.fromString();

export const tryify: CodeTransform =
    async p => {
        return p;
    };