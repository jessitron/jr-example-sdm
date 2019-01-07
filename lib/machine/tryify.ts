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

export function tryFinally(): Microgrammar<{ tryBlock: string, finallyBlock: string }> {
    // return Microgrammar.fromString("try ${tryBlock} finally ${finallyBlock}", {
    //     tryBlock: JavaBlock,
    //     //catch: zeroOrMore(Microgrammar.fromString("} catch ($catchClause) {")),
    //     //catchClause: takeUntil(")"),
    //     finallyBlock: JavaBlock,
    // });
    return Microgrammar.fromDefinitions( {
        _try: "try",
        tryBlock: JavaBlock,
        _finally: "finally",
        //catch: zeroOrMore(Microgrammar.fromString("} catch ($catchClause) {")),
        //catchClause: takeUntil(")"),
        finallyBlock: JavaBlock,
    });
}

// it's something like <identifier> = targetBuilder; return <identifier>;
//const unsafeStatementGrammar = Microgrammar.fromString();

export const tryify: CodeTransform =
    async p => {
        return p;
    };