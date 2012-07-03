var fs = require("fs");

if(process.argv.length < 3) {
    console.error("Missing filename");
    process.exit(1);
}

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
                this.code.replacement = parts[1];
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

Block.prototype.perform_match = function(data, callback) {
    var match = this.code.match.exec(data);

    if(this.code.hasOwnProperty("replacement")) {
        var replacement = match[0].replace(this.code.match, this.code.replacement);

        if(this.code.flags.contains("n")) {
            if(!num_expr_re.test(replacement)) {
                console.error("Invalid expression:", replacement);
                process.exit(1);
            }

            replacement = eval(replacement);
        }

        data = data.substring(0, match.index) + replacement + data.substring(match.index + match[0].length);

        match = replacement;
    } else {
        match = match[0];
    }

    if(this.code.flags.contains("w")) {
        match = data;
    }

    // Now the actions
    if(this.code.flags.contains("p")) {
        console.log(match);
    }

    this.execute_children(data, callback);
};

Block.prototype.execute_children = function(data, callback) {
    for(var i=0; i<this.children.length; i++) {
        (function(child) {
            var old_callback = callback;

            callback = function(d) {
                child.execute(d, false, old_callback);
            };
        }(this.children[this.children.length - i - 1]));
    }

    callback(data);
};

Block.prototype.execute = function(data, by_ref, callback) {
    var do_children = false;

    var old_callback = callback;

    callback = callback || function(){
        if(DEBUG) {
            console.log("EOL");
        }
    };

    if(DEBUG) {
        console.log("LINE:", this.line);
    }

    // Handle temporary data
    if(this.code.flags.contains("t")) {
        callback = function() {
            old_callback(data);
        };
    }

    if(this.code.hasOwnProperty("ref")) {
        if(by_ref) {
            if(DEBUG) {
                console.log("Call: ", this.code.ref);
            }

            this.execute_children(data, callback);
        } else {
            if(DEBUG) {
                console.log("Skip");
            }

            callback(data);
        }
    } else if(this.code.hasOwnProperty("import_ref")) {
        if(DEBUG) {
            console.log("Incl:", this.code.import_ref);
        }

        refs[this.code.import_ref].execute(data, true, callback);
    } else {
        if(DEBUG) {
            this.print(false, "Exec: ");
        }

        if(this.code.match.test(data)) {
            if(this.code.flags.contains("o")) {
                process.stdin.on("data", function(data) {
                    process.stdin.removeAllListeners("data");

                    this.perform_match(data, callback);
                });
            } else {
                this.perform_match(data, callback);
            }
        } else {
            callback(data);
        }
    }
};

Block.prototype.print = function(recursive, indent) {
    indent = indent || "";

    var line = indent;

    if(this.code.hasOwnProperty("import_ref")) {
        line += "IMPORT " + this.code.import_ref;
    } else if(this.code.hasOwnProperty("ref")) {
        line += "REF " + this.code.ref;
    } else {
        line += this.code.match.source;
        
        if(this.code.hasOwnProperty("replacement")) {
            line += " -> " + this.code.replacement;
        }

        if(this.code.flags.length > 0) {
            line += " (" + this.code.flags.join(", ") + ")";
        }
    }

    console.log(line);

    if(recursive) {
        this.children.forEach(function(child) {
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
