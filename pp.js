var DEBUG = false;

var REF_RE = /^\>\w+/;
var IMPORT_RE = /^\<\w+?\>/;

function get_statement(code) {
    var pattern,
        match,
        statement,
        separator;

    if(match = REF_RE.exec(code)) {
        return [match[0], code.replace(REF_RE, "")];
    } else if(match = IMPORT_RE.exec(code)) {
        return [match[0], code.replace(IMPORT_RE, "")];
    } else {
        // Try to get a command
        separator = code[0];

        pattern = "^(#.*?(?:(?:#.*?)?#[a-z]+)?)[ \\t]*([\\n;]|$)";
        pattern = pattern.replace(/#/, separator);
        pattern = new RegExp(pattern);

        match = pattern.exec(code);

        if(match) {
            return [match[1], code.replace(match[1], "")];
        }
    }

    return null;
}

function format(code) {
    var out = [];
    var indent = [""];
    var brackets = 0;

    var indent_re;

    var match;

    var statement;

    while(code.length > 0) {
        if(DEBUG) {
            console.log("CODE:", JSON.stringify(code));
        }

        // See if we're entering a bracket
        if(/^\s*\{/.test(code)) {
            brackets++;
            code = code.replace(/^\s*\{\s*/m, "");
        }

        // If we're in a bracket, just strip whitespace
        if(brackets > 0) {
            code = code.replace(/^\s+/m, "");

            while(/^\}/.test(code)) {
                brackets--;
                code = code.replace(/^\}\s+/m, "");
            }
        } else {
            indent_re = new RegExp("^" + indent.join(""));

            if(DEBUG) {
                console.log("INDT:", indent);
            }

            // See if we need to ascend
            while(!indent_re.test(code)) {
                if(DEBUG) {
                    console.log("Going up");
                }

                indent.pop();
                indent_re = new RegExp("^" + indent.join(""));
            }

            // See if we're ascending
            code = code.replace(indent_re, "");

            indent_re = /^\s+/;
            match = indent_re.exec(code); 
            if(match) {
                if(DEBUG) {
                    console.log("Going down");
                }

                indent.push(match[0]);
                code = code.replace(indent_re, "");
            }
        }

        if(DEBUG) {
            console.log("READ:", JSON.stringify(code));
        }
            
        statement = get_statement(code);

        if(statement) {
            if(DEBUG) {
                console.log(indent.length + brackets);
            }

            out.push(Array(indent.length + brackets).join("\t") + statement[0]);
            code = statement[1].replace(/^([ \t]*[\n;])*/, "");

            if(DEBUG) {
                console.log("STMT:", statement);
                console.log("OUT :", out);
            }
        } else {
            if(code.length > 0) {
                console.log("Invalid syntax:", code);
            }

            if(DEBUG) {
                console.log("SKIP");
            }
        }
    }

    return out;
}

module.exports = format;
