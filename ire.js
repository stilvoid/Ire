var fs = require("fs");
var readline = require("readline");

var Block = require("./block");
var pp = require("./pp");

var DEBUG=false;

var code, i;

// Handle options
for(i=0; i<process.argv.length; i++) {
    if(/^--?e/.test(process.argv[i])) {
        i++;

        code = process.argv[i];
    }
}

if(!code) {
    if(process.argv.length < 3) {
        console.error("Missing filename");
        process.exit(1);
    } else {
        code = fs.readFileSync(process.argv[process.argv.length - 1], "utf8");
    }
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
        output: process.stdout
    });

    rl.on("line", function(line) {
        main.execute(line, false, function() {
            rl.resume();
        });
    });
}
