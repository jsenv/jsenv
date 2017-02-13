this.code = transpile`(function(foo, ...rest) {
    foo = 10;
    return arguments;
})`,
this.pass = function(fn) {
    var first = 1;
    var second = 2;
    var result = fn(first, second);
    return this.sameValues(result, [first, second]);
};
this.solution = 'none';
