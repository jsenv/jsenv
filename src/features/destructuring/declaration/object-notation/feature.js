this.code = transpile`(function(value) {
    var {a} = value;
    return a;
})`;
this.pass = function(fn) {
    var value = 1;
    var result = fn({a: value});
    return result === value;
};
this.solution = 'inherit';
