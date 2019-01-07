import { CodeTransform } from "@atomist/sdm";
import { Microgrammar, takeUntil, zeroOrMore } from "@atomist/microgrammar";

/**
 * Match a call of the form
 * client.get("http://example.org")
 * .execute()
 * .statusCode();
 *
 * Don't pull more detail out than needed
 * @param {string} methodCall
 * @return {Microgrammar<{methodCall: string; fluency: string}>}
 */
export function targetBuilder(methodCall: string): Microgrammar<{ methodCall: string, fluency: string }> {
    return Microgrammar.fromDefinitions({
        methodCall,
        param: "(",
        fluency: takeUntil("();"),
        end: "();",
    });
}

export function tryFinally(): Microgrammar<{ tryBlock: string, finallyBlock: string }> {
    return Microgrammar.fromString("try { $tryBlock } finally { $finallyBlock }", {
        try: "try {",
        tryBlock: takeUntil("}"),
        catch: zeroOrMore(Microgrammar.fromString("} catch ($catchClause) {")),
        catchClause: takeUntil(")"),
        finally: "} finally {",
        finallyBlock: takeUntil("}"),
        end: "}",
    });
}

// it's something like <identifier> = targetBuilder; return <identifier>;
//const unsafeStatementGrammar = Microgrammar.fromString();

export const tryify: CodeTransform =
    async p => {
        return p;
    };