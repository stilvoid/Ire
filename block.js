var readline = require("readline");

var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdin
});

rl.pause();

var DEBUG=false;

var label_re=/^>.+/;
var import_re=/^<.+>$/;

var num_expr_re=/^[\s\d\-\+\*\/\(\)]+$/;

var re_flags = ["g", "i", "m"];

Array.prototype.contains = function(a) {
    return this.indexOf(a) !== -1;
};

function re_filter(a) {
    return re_flags.contains(a);
}

function action_filter(a) {
    return !re_flags.contains(a);
}

var literals = [
    [/\\n/g, "\n"],
    [/\\r/g, "\r"],
    [/\\t/g, "\t"]
];

function make_literal(string) {
    var out = string;

    literals.forEach(function(literal) {
        out = out.replace(literal[0], literal[1]);
    });

    return out;
}

var refs = {};

function Block(line, parent_block) {
    line = line || "/";

    if(DEBUG) {
        this.line = line;
    }

    this.parent_block = parent_block || null;

    this.children = [];

    // Parse the code
    this.code = {
        flags: []
    };

    if(label_re.test(line)) {
        this.code.ref = line.replace(/^>/, "");
        refs[this.code.ref] = this;
    } else if(import_re.test(line)) {
        this.code.import_ref = line.replace(/^</, "").replace(/>$/, "");
    } else {
        var separator = line[0];
        var parts = line.split(separator);

        parts.splice(0, 1);

        if(parts.length > 1) {
            this.code.flags = parts[parts.length - 1].split("");
            
            if(parts.length > 2) {
                this.code.replacement = make_literal(parts[1]);
            }
        }

        if(this.code.flags.contains("b")) {
            if(!/^\^/.test(parts[0])) {
                parts[0] = "^.*" + parts[0];
            }

            if(!/\$$/.test(parts[0])) {
                parts[0] += ".*$";
            }
        }

        this.code.match = new RegExp(parts[0], this.code.flags.filter(re_filter).join(""));

        this.code.flags = this.code.flags.filter(action_filter);
    }
}

Block.prototype.add_child = function(line) {
    this.children.push(new Block(line, this));
};

Block.prototype.perform_match = function(pattern, replacement, data, callback) {
    var block = this,
        match,
        result;

    pattern.lastIndex = 0;
    match = pattern.exec(data);
    pattern.lastIndex = 0;

    if(DEBUG) {
        console.log("DATA:", data);
        console.log("PATT:", pattern);
        console.log("MATCH:", match);
    }

    if(replacement) {
        if(match) {
            replacement = replacement.replace(/\$0/g, match[0]);

            if(DEBUG) {
                console.log("REPL:", replacement);
            }

            result = match[0].replace(pattern, replacement);
            pattern.lastIndex = 0;

            if(DEBUG) {
                console.log("RESULT:", result);
            }

            if(block.code.flags.contains("n")) {
                if(!num_expr_re.test(result)) {
                    console.error("Invalid expression:", result);
                    process.exit(1);
                }

                result = eval(result);
            }

            data = data.replace(pattern, result);
        } else {
            result = replacement.replace(/\$0/g, data);

            data = result;
        }
    } else {
        if(match) {
            result = match[0];
        } else {
            result = data;
        }
    }

    if(block.code.flags.contains("w")) {
        result = data;
    }

    // Now the actions
    if(block.code.flags.contains("p")) {
        process.stdout.write(result);
    }

    block.execute_children(data, callback);
};

Block.prototype.execute_children = function(data, callback) {
    var block = this,
        i;

    for(i=0; i<block.children.length; i++) {
        (function(child) {
            var old_callback = callback;

            callback = function(d) {
                child.execute(d, false, old_callback);
            };
        }(block.children[block.children.length - i - 1]));
    }

    callback(data);
};

Block.prototype.execute = function(data, by_ref, callback) {
    var block=this,
        old_callback = callback;

    callback = callback || function(){
        if(DEBUG) {
            console.log("EOL");
        }

        // Close now and don't allow stdin to overflow
        rl.close();
        process.exit(0);
    };

    if(DEBUG) {
        console.log("LINE:", block.line);
    }

    // Handle temporary data
    if(block.code.flags.contains("t")) {
        callback = function() {
            old_callback(data);
        };
    }

    if(block.code.hasOwnProperty("ref")) {
        if(by_ref) {
            if(DEBUG) {
                console.log("Call: ", block.code.ref);
            }

            block.execute_children(data, callback);
        } else {
            if(DEBUG) {
                console.log("Skip");
            }

            callback(data);
        }
    } else if(block.code.hasOwnProperty("import_ref")) {
        if(DEBUG) {
            console.log("Incl:", block.code.import_ref);
        }

        refs[block.code.import_ref].execute(data, true, callback);
    } else {
        if(DEBUG) {
            block.print(false, "Exec: ");
            console.log("With data:", data);

            console.log("FIND:", block.code.match, block.code.match.test(data));
            block.code.match.lastIndex = 0;
        }

        if(block.code.flags.contains("r")) {
            rl.resume();
            
            rl.on("line", function(chunk) {
                var replacement = block.code.replacement;
                if(replacement) {
                    replacement = replacement.replace(/\$\-/g, chunk);
                }

                rl.pause();
                rl.removeAllListeners("line");

                if(DEBUG) {
                    console.log("STDIN:", replacement + ".");
                }

                if(block.code.match.test(data)) {
                    if(block.code.flags.contains("o")) {
                        callback(data);
                    } else {
                        block.perform_match(block.code.match, replacement, data, callback);
                    }
                } else {
                    if(block.code.flags.contains("o")) {
                        block.perform_match(/^.*$/, replacement, data, callback);
                    } else {
                        callback(data);
                    }
                }
            });
        } else {
            if(block.code.match.test(data)) {
                if(block.code.flags.contains("o")) {
                    callback(data);
                } else{
                    block.perform_match(block.code.match, block.code.replacement, data, callback);
                }
            } else {
                if(block.code.flags.contains("o")) {
                    block.perform_match(/^.*$/, block.code.replacement, data, callback);
                } else{
                    callback(data);
                }
            }
        }
    }
};

Block.prototype.print = function(recursive, indent) {
    var block = this;

    indent = indent || "";

    var line = indent;

    if(block.code.hasOwnProperty("import_ref")) {
        line += "IMPORT " + block.code.import_ref;
    } else if(block.code.hasOwnProperty("ref")) {
        line += "REF " + block.code.ref;
    } else {
        line += block.code.match.source;
        
        if(block.code.hasOwnProperty("replacement")) {
            line += " -> " + block.code.replacement;
        }

        if(block.code.flags.length > 0) {
            line += " (" + block.code.flags.join(", ") + ")";
        }
    }

    console.log(line);

    if(recursive) {
        block.children.forEach(function(child) {
            child.print(true, indent + "\t");
        });
    }
};

module.exports = Block;
