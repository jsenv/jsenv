this.code = transpile`(function(value) {
    var [a,] = value;
    return a;
})`;
this.pass = function(fn) {
    var value = 0;
    var result = fn([value]);
    return result === value;
};
this.solution = 'inherit';
