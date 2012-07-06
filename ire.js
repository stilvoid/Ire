#!/usr/bin/env node 

var fs = require("fs");
var readline = require("readline");

var Block = require("./block");
var pp = require("./pp");

var DEBUG=false;

var code = null, i, addprint = false, filename;

// Handle options
for(i=2; i<process.argv.length; i++) {
    if(/^--?e/.test(process.argv[i])) {
        i++;

        code = process.argv[i];
    } else if(/^--?p/.test(process.argv[i])) {
        addprint = true;
    } else {
        filename = process.argv[i];
    }
}

if(code === null) {
    if(filename) {
        code = fs.readFileSync(process.argv[process.argv.length - 1], "utf8");
    } else {
        console.error("Missing filename");
        process.exit(1);
    }
}

if(addprint) {
    code += "\n//$0\\n/btp";
}

// Run code through the preprocessor
code = pp(code);

if(DEBUG) {
    console.log(code);
}

// Prepare blocks

var parent_block = null;
var main = new Block();
var indent = [""];

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

while(main.parent_block !== null) {
    main = main.parent_block;
}

if(DEBUG) {
    console.log("Main");
    main.print(true);
    console.log("\nStarting\n");
}

// Execute the code!

if(process.stdin.isTTY) {
    // Interactive mode
    main.execute("");
} else {
    // Loop over stdin
    var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdin
    });

    rl.on("line", function(line) {
        rl.pause();

        line = line.replace(/\n$/, "");

        main.execute(line, false, function() {
            rl.pause();
        });
    });
}
