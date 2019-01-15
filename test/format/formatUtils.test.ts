import * as assert from "assert";
import { appendFormatted, DefaultIndentUnit, formatAtEndOf, insertFormatted } from "../../lib/format/formatUtils";

describe("formatUtils", () => {

    describe("formatPoint", () => {

        it("should work with empty string", () => {
            const input = "";
            const fp = formatAtEndOf(input);
            assert.deepStrictEqual(fp, { depth: 0, indentUnit: DefaultIndentUnit });
        });
    });

    describe("insertFormatted", () => {

        it("should insert in empty string", () => {
            const input = "";
            const r = insertFormatted(input, 0, "a=b");
            assert.strictEqual(r, "a=b");
        });

        it("should insert with indentation", () => {
            const input = `package la.la;

class Foo {
    public String blah = "deblah";
}`;
            const afterLastDeclaration = input.lastIndexOf(";") + 2;
            const r = insertFormatted(input, afterLastDeclaration, "public int code = 4;\n")

            assert(r.includes("\n    public int code = 4;\n"), r);
        })

    });

    describe("appendFormatted", () => {

        it("should insert after empty string", () => {
            const left = "";
            const r = appendFormatted(left, "a=b");
            assert.strictEqual(r, "a=b");
        });

        it("should insert after non-empty string", () => {
            const left = "left";
            const r = appendFormatted(left, "a=b");
            assert.strictEqual(r, "lefta=b");
        });

        describe("tab support", () => {

            it("should append indented", () => {
                const left = "public class Foo\n\tint i = 0;";
                const r = appendFormatted(left, "\nint j = 1;\n");
                assert.strictEqual(r, left + "\n\tint j = 1;\n");
            });

            it("should append double indented", () => {
                const left = "public class Foo\n\tint i = 0;";
                const r = appendFormatted(left, "\nint j = 1;\n\tx\n");
                assert.strictEqual(r, left + "\n\tint j = 1;\n\t\tx\n");
            });

        });

        describe("space... support", () => {
            const indent = "   ";

            it("should append indented", () => {
                const left = `public class Foo\n${indent}int i = 0;`;
                const r = appendFormatted(left, "\nint j = 1;\n");
                assert.strictEqual(r, left + `\n${indent}int j = 1;\n`);
            });

            it("should insert double indented", () => {
                const left = `public class Foo\n${indent}int i = 0;`;
                const r = appendFormatted(left, "\nint j = 1;\n\tx\n");
                assert.strictEqual(r, left + `\n${indent}int j = 1;\n${indent}${indent}x\n`);
            });

        });

    });

});
