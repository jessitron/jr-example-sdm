import { CodeTransform } from "@atomist/sdm";
import { Microgrammar, takeUntil, zeroOrMore, Concat } from "@atomist/microgrammar";

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

// TODO try to be compatible with microgrammar JavaBlock
export const JavaBlock = Microgrammar.fromDefinitions<{content: string}>({
    _lpar: "{",
    content: takeUntil("}"),
    _rpar: "}",
});

// TODO also from microgrammar
export const parenthesizedExpression = Microgrammar.fromDefinitions<{content: string}>({
    _lpar: "(",
    content: takeUntil(")"),
    _rpar: ")",
});

export const Catch = Microgrammar.fromDefinitions({
    _catch: "catch",
    clause: parenthesizedExpression,
    block: JavaBlock,
});

export function tryFinally(): Microgrammar<{ tryBlock: string, finallyBlock: string }> {
    return Microgrammar.fromString("try ${tryBlock} ${catches} finally ${finallyBlock}", {
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