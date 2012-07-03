# Ire

## Irregular Regular Expressions

A sort of scripting language thingy based around regular expressions

## Syntax

Ire expects a single statement per line

Statements can be indented after another statement to show dependency or grouping.

A statement can be either:

* A reference marker
* An import statement
* A command

### Reference markers

    >myref
        # some code to run
        # if myref is later imported

To give a name to a block of code, use a reference marker. The code under the marker will not be executed immediately, but can be called by an include statement

### Import statements

    <myref>

Import statements simply execute a block that has been marked with the reference marker of the same name.

### Commands

A command can be in one of three formats:

* SEPARATOR regexp
* SEPARATOR regexp SEPARATOR flags
* SEPARATOR regexp SEPARATOR replacement SEPARATOR flags

`SEPARATOR` can be any charater except < or > (to avoid confusion with refs and imports)

`regexp` is a regular expression to match against the current data. If it matches, any indented block following this command will be executed.

`replacement` is a string to replace the matched portion of the data with. Use $1, $2, etc. to refer back to capture groups in `regexp`.

`flags` is a string of letters each of which modifies the behaviour of either the `regexp` or `replacement` or performs an action.

#### List of currently supported flags
* `p` - print
    * print the result to standard output

* `w` - whole
    * actions perform on the entire data string, not just the part that matched

* `b` - bound
    * treat `regexp` as if it started with `^.*` and ended with `.*$` (i.e. match the whole of the data) - implies `w`

* `t` - temporary
    * only apply the `replacement` for this block

* `n` - numeric
    * treat `replacement` as a numeric expression and evaluate it

* `i` - insensitive
    * apply the `regexp` case-insensitively

* `r` - read
    * read a line from standard input and make it available in the replacement string as $-

* `o` - opposite
    * count as a match only if `regexp` does not match the data string

#### Not yet implemented/tested flags
* `e` - exit
    * exit block

* `l` - loop
    * repeat block

* `g` - global
    * apply the `replacement` as many times as the `regexp` can be made to match

* `m` - multi-line
    * treat new-line characters as white-space

## Examples

There's no better way to understand something that by looking at a few examples. Here goes...

### Hello, world

Everyone's favourite program

    # Print out "Hello, world"
    //Hello, world/p

Programs start off with an empty data string. The simple program above works by matching nothing (this will match against any string) and replacing it will "Hello, world" and then `p`rinting the result.

If you were to include this as part of a larger program, you would want:

    # Print out "Hello, world"
    //Hello, world/btp

The `b` means that the entire data string is replaced by "Hello, world" and the `t` means that the change is not permanent and only applies for this line.

Note that the comment line (`# print out "Hello, world"`) is actually also a command. It uses `#` as it's separator and then looks for something that matches ` Print out "Hello, world"`. Even if the data string did happen to match, it doesn't perform any action on it so it effectively gets ignored.
