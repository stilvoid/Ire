var fs = require("fs");
var readline = require("readline");

if(process.argv.length < 3) {
    console.error("Missing filename");
    process.exit(1);
}

var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
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

        this.code.match = new RegExp(parts[0], this.code.flags.filter(re_filter));

        this.code.flags = this.code.flags.filter(action_filter);
    }
}

Block.prototype.add_child = function(line) {
    this.children.push(new Block(line, this));
};

Block.prototype.perform_match = function(pattern, replacement, data, callback) {
    var block = this,
        match = pattern.exec(data),
        result;

    if(replacement) {
        if(match) {
            replacement = replacement.replace(/\$0/g, match[0]);

            result = match[0].replace(pattern, replacement);

            if(block.code.flags.contains("n")) {
                if(!num_expr_re.test(result)) {
                    console.error("Invalid expression:", result);
                    process.exit(1);
                }

                result = eval(result);
            }

            data = data.replace(pattern, result);
        } else {
            result = data.replace(pattern, replacement);

            data = result
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
        console.log(result);
    }

    block.execute_children(data, callback);
};

Block.prototype.execute_children = function(data, callback) {
    var block = this,
        i;

    for(var i=0; i<block.children.length; i++) {
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
        }

        if(block.code.flags.contains("r")) {
            rl.question("", function(chunk) {
                var replacement = block.code.replacement;
                if(replacement) {
                    replacement = replacement.replace(/\$\-/g, chunk.replace(/[\r\n]+$/, ""));
                }

                rl.pause();

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

// Read the file
var code = fs.readFileSync(process.argv[2], "utf8").split("\n");
code = code.filter(function(a) {
    return a.length > 0;
});

if(DEBUG) {
    console.log(code);
}

var parent_block = null;

var main = new Block();

var indent = [""];

// Prepare blocks
code.forEach(function(line) {
    if(DEBUG) {
        console.log("Line is:", line)
    }

    while(!new RegExp("^" + indent.join("")).test(line)) {
        main = main.parent_block;

        indent.pop();

        if(DEBUG) {
            console.log("Going up");
        }
    }

    line = line.replace(new RegExp("^" + indent.join("")), "");

    if(/^\s/.test(line)) {
        // Descend
        indent.push(line.replace(/\S.*$/, ""));

        line = line.replace(/^\s+/, "");

        main = main.children[main.children.length - 1];

        if(DEBUG) {
            console.log("Descending");
        }
    }

    main.add_child(line);
});

if(DEBUG) {
    main.print(true);
    console.log("\nStarting\n");
}

main.execute("");
