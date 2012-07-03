var fs = require("fs");

var Block = require("./block");
var pp = require("./pp");

if(process.argv.length < 3) {
    console.error("Missing filename");
    process.exit(1);
}

var DEBUG=false;

// Read the file
var code = fs.readFileSync(process.argv[2], "utf8");

code = pp(code);

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
    console.log("Main");
    main.print(true);
    console.log("\nStarting\n");
}

main.execute("");
