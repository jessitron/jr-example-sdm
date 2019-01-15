import * as _ from "lodash";

/**
 * Formatting information at a particular point in a file
 */
export interface FormatPoint {
    indentUnit: string;
    depth: number;
}

export const DefaultIndentUnit = "   ";

/**
 * Find the format in the file at the given point
 * @param {string} s
 * @param {number} offset
 * @return {FormatPoint}
 */
export function formatAt(s: string, offset: number): FormatPoint {
    let indentUnit: string = determineIndentUnit(s);
    const beforeOffset = s.substr(0, offset);
    let lastLine = _.last(beforeOffset.split("\n").filter(s => s.trim().length > 0)) || "";
    const depth = determineDepth(indentUnit, lastLine);
    return {
        indentUnit,
        depth,
    };
}

function determineDepth(indentUnit: string, line: string) {
    let depth = 0;
    var lastLine = line.slice();
    while (lastLine.startsWith(indentUnit)) {
        ++depth;
        lastLine = lastLine.slice(indentUnit.length);
    }
    return depth;
}

function determineIndentUnit(s: string) {
    const lines = s.split("\n");
    let indentUnit: string;
    if (s.includes("\t")) {
        indentUnit = "\t";
    } else {
        let spaceLine = lines.find(l => l.startsWith(" "));
        if (spaceLine) {
            indentUnit = "";
            while (spaceLine.startsWith(" ")) {
                indentUnit += " ";
                spaceLine = spaceLine.slice(1);
            }
        } else {
            indentUnit = DefaultIndentUnit;
        }
    }
    return indentUnit;
}

/**
 * FormatPoint at the end of the given string
 * @param {string} s
 * @return {FormatPoint}
 */
export function formatAtEndOf(s: string): FormatPoint {
    return formatAt(s, s.length - 1);
}

/**
 * Insert the given formatted string into the original string at the given offset
 * @param {string} s string to insert into
 * @param {number} offset offset within the string to insert at
 * @param {string} what formatted string to insert. The string should use tabs
 * in place of indentation units. It does not need to worry about any existing level of
 * indentation, as this will be computed automatically.
 * The tab will be converted to whatever indentation unit the input string
 * uses.
 * @return {string}
 */
export function insertFormatted(s: string, offset: number, what: string): string {
    const fp = formatAt(s, offset);
    return insertAt(s, offset, indent(what, fp));
}

/**
 * Append to given string, detecting and honoring its formatting
 * @param left string to append to
 * @param what to append
 * @return {string}
 */
export function appendFormatted(left: string, what: string): string {
    const fp = formatAtEndOf(left);
    return left + indent(what, fp);
}

/**
 * Indent the given content appropriately. it should have its
 * own internal indentation
 * @return {string}
 */
export function indent(what: string, formatPoint: FormatPoint): string {
    return what
        .replace("\t", formatPoint.indentUnit)
        .split("\n")
        .map(line => {
            if (line === "") {
                // Don't pad an empty line
                return line;
            }
            let pad = "";
            for (let i = 0; i < formatPoint.depth; i++) {
                pad += formatPoint.indentUnit;
            }
            return pad + line;
        })
        .join("\n");
}

/**
 * Insert at the given position
 * @param {number} position
 * @param {string} what
 * @return {Promise<void>}
 */
export function insertAt(oldContent: string, position: number, what: string): string {
    return oldContent.substr(0, position) + what + oldContent.substr(position);
}
